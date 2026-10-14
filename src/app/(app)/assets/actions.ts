"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAssets } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ASSET_CATEGORIES, normalizeAssetCategory } from "@/lib/asset-categories";
import { parseExitReturnCondition } from "@/lib/offboarding";
import { createDisposalCaseInternal } from "@/lib/disposal-create";
import { openRepairForReturnedAsset } from "@/lib/maintenance-create";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import {
  isAssetAvailableForIndividualAssignment,
  canAllocateQuantity,
  isCustodyOpen,
  computeAvailableQuantityAfterReturn,
  validatePlacement,
} from "@/lib/assets";
import type { AssetCustodyTargetType, AssetInspectionResult, AssetTrackingType } from "@/generated/prisma/enums";

export async function createFixedAsset(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssets(session)) return t("common.forbidden");

  const assetCode = (formData.get("assetCode") as string)?.trim();
  const assetName = (formData.get("assetName") as string)?.trim();
  const categoryRaw = (formData.get("category") as string)?.trim();
  const category = normalizeAssetCategory(categoryRaw);
  if (categoryRaw && !category) return `Kategori harus salah satu dari: ${ASSET_CATEGORIES.join(", ")}.`;
  const modelBrand = (formData.get("modelBrand") as string)?.trim() || null;
  const specification = (formData.get("specification") as string)?.trim() || null;
  const assetNumber = (formData.get("assetNumber") as string)?.trim() || null;
  const trackingTypeRaw = formData.get("trackingType") as string;
  if (!assetCode || !assetName) return "Kode aset dan nama aset wajib diisi.";
  if (!["INDIVIDUAL", "QUANTITY_TRACKED"].includes(trackingTypeRaw)) return "Tipe pelacakan tidak valid.";
  const trackingType = trackingTypeRaw as AssetTrackingType;

  let totalQuantity: number | null = null;
  if (trackingType === "QUANTITY_TRACKED") {
    const totalQuantityRaw = (formData.get("totalQuantity") as string)?.trim();
    totalQuantity = totalQuantityRaw ? Number(totalQuantityRaw) : NaN;
    if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) {
      return "Jumlah total wajib diisi dengan angka lebih dari 0 untuk aset yang dilacak per kuantitas.";
    }
  }

  const purchaseDateRaw = (formData.get("purchaseDate") as string)?.trim();
  const purchaseCostRaw = (formData.get("purchaseCost") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  const existing = await prisma.fixedAsset.findUnique({ where: { assetCode } });
  if (existing) return `Kode aset "${assetCode}" sudah digunakan.`;

  const asset = await prisma.fixedAsset.create({
    data: {
      assetCode,
      assetName,
      category,
      modelBrand,
      specification,
      assetNumber,
      trackingType,
      totalQuantity,
      availableQuantity: totalQuantity,
      purchaseDate: purchaseDateRaw ? new Date(purchaseDateRaw) : null,
      purchaseCost: purchaseCostRaw ? Number(purchaseCostRaw) : null,
      notes,
      createdByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "FixedAsset",
    recordId: asset.id,
    reason: `Created asset "${assetName}" (${assetCode})`,
  });

  revalidatePath("/assets");
  redirect(`/assets/${asset.id}`);
}

interface CustodyTarget {
  targetType: AssetCustodyTargetType;
  employeeId?: string;
  orgUnitId?: string;
  locationId?: string;
}

// Shared by all three assign-to-* actions below — one asset, one target,
// same validation/quantity/evidence handling regardless of which kind of
// custodian it is. Custody becomes Active immediately on assignment for
// every target type — per direct user request, no employee-acknowledgement
// gate.
async function createCustody(
  assetId: string,
  target: CustodyTarget,
  session: Awaited<ReturnType<typeof requireSession>>,
  formData: FormData
): Promise<string | undefined> {
  if (!canManageAssets(session)) return t("common.forbidden");
  const placementError = validatePlacement(target.targetType, target.locationId);
  if (placementError) return placementError;

  const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
  if (!asset) return "Aset tidak ditemukan.";
  if (!asset.activeFlag) return "Aset ini sudah tidak aktif dalam katalog.";

  const conditionAtHandover = (formData.get("conditionAtHandover") as string)?.trim() || null;
  const quantityRaw = (formData.get("quantity") as string)?.trim();

  let quantity = 1;
  if (asset.trackingType === "QUANTITY_TRACKED") {
    quantity = quantityRaw ? Number(quantityRaw) : NaN;
    if (!canAllocateQuantity(asset.availableQuantity ?? 0, quantity)) {
      return `Jumlah yang diminta melebihi stok tersedia (${asset.availableQuantity ?? 0}).`;
    }
  } else {
    // Core control: "One active individual asset cannot have two active
    // custody records" — status AVAILABLE already implies this, but check
    // directly too as defense in depth against a stale status.
    if (!isAssetAvailableForIndividualAssignment(asset.status)) {
      return "Aset ini sedang tidak tersedia (sudah dalam masa penggunaan/perbaikan/dihapuskan).";
    }
    const openCustody = await prisma.assetCustody.findFirst({ where: { assetId, status: { not: "RETURNED" } } });
    if (openCustody) return "Aset ini sudah memiliki penguasaan aktif.";
  }

  let handoverEvidenceFileId: string | null = null;
  const evidenceFile = formData.get("handoverEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("asset-handover", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        employeeId: target.employeeId ?? null,
        uploadedByAccountId: session.user.id,
        category: "ASSET_HANDOVER_EVIDENCE",
        confidential: false,
      },
    });
    handoverEvidenceFileId = fileObject.id;
  }

  const custody = await prisma.assetCustody.create({
    data: {
      assetId,
      targetType: target.targetType,
      employeeId: target.employeeId ?? null,
      orgUnitId: target.orgUnitId ?? null,
      locationId: target.locationId ?? null,
      quantity,
      status: "ACTIVE",
      conditionAtHandover,
      handoverEvidenceFileId,
      assignedByAccountId: session.user.id,
    },
  });

  if (asset.trackingType === "INDIVIDUAL") {
    await prisma.fixedAsset.update({ where: { id: assetId }, data: { status: "IN_USE" } });
  } else {
    await prisma.fixedAsset.update({
      where: { id: assetId },
      data: { availableQuantity: (asset.availableQuantity ?? 0) - quantity },
    });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AssetCustody",
    recordId: custody.id,
    reason: `Assigned asset "${asset.assetName}" (${asset.assetCode}) to ${target.targetType.toLowerCase()}`,
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  if (target.employeeId) revalidatePath("/my-assets");
  return undefined;
}

export async function assignAssetToEmployee(
  assetId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const employeeId = (formData.get("employeeId") as string)?.trim();
  if (!employeeId) return "Karyawan wajib dipilih.";
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || !employee.activeFlag) return "Karyawan tidak ditemukan atau tidak aktif.";
  return createCustody(assetId, { targetType: "EMPLOYEE", employeeId }, session, formData);
}

export async function assignAssetToDepartment(
  assetId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const orgUnitId = (formData.get("orgUnitId") as string)?.trim();
  if (!orgUnitId) return "Departemen wajib dipilih.";
  const orgUnit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
  if (!orgUnit) return "Departemen tidak ditemukan.";
  // A department placement always says where the asset is.
  const locationId = (formData.get("locationId") as string)?.trim();
  const placementError = validatePlacement("DEPARTMENT", locationId);
  if (placementError) return placementError;
  const location = await prisma.assetLocation.findUnique({ where: { id: locationId } });
  if (!location || !location.activeFlag) return "Lokasi tidak ditemukan atau tidak aktif.";
  return createCustody(assetId, { targetType: "DEPARTMENT", orgUnitId, locationId }, session, formData);
}

export async function returnAssetCustody(
  custodyId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssets(session)) return t("common.forbidden");

  const custody = await prisma.assetCustody.findUnique({ where: { id: custodyId }, include: { asset: true } });
  if (!custody) return "Catatan penguasaan tidak ditemukan.";
  if (!isCustodyOpen(custody.status)) return "Catatan penguasaan ini sudah dikembalikan.";

  // Good, needs repair, beyond repair or lost. The old combined value reads as beyond repair.
  const outcome = parseExitReturnCondition(formData.get("inspectionResult") as string);
  if (!outcome) return "Hasil pemeriksaan wajib dipilih.";
  const inspectionResult: AssetInspectionResult = outcome.inspectionResult;
  const returnConditionNote = (formData.get("returnConditionNote") as string)?.trim() || null;

  let returnEvidenceFileId: string | null = null;
  const evidenceFile = formData.get("returnEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("asset-return", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        employeeId: custody.employeeId,
        uploadedByAccountId: session.user.id,
        category: "ASSET_RETURN_EVIDENCE",
        confidential: false,
      },
    });
    returnEvidenceFileId = fileObject.id;
  }

  await prisma.assetCustody.update({
    where: { id: custodyId },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
      returnedByAccountId: session.user.id,
      returnConditionNote,
      inspectionResult,
      returnEvidenceFileId,
    },
  });

  if (custody.asset.trackingType === "INDIVIDUAL") {
    await prisma.fixedAsset.update({
      where: { id: custody.assetId },
      data: { status: outcome.assetStatus },
    });
    // Whatever comes back wrong gets its next record straight away, so nothing is left
    // without an owner: a repair opens a work order, a loss or write-off opens a disposal draft.
    if (outcome.condition === "NEEDS_REPAIR") {
      await openRepairForReturnedAsset({
        assetId: custody.assetId,
        createdByAccountId: session.user.id,
        note: returnConditionNote ?? "Dikembalikan dalam kondisi perlu perbaikan.",
      });
    } else if (outcome.disposalReason) {
      const alreadyOpen = await prisma.disposalCase.findFirst({
        where: { assetId: custody.assetId, status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
        select: { id: true },
      });
      if (!alreadyOpen) {
        await createDisposalCaseInternal({
          assetId: custody.assetId,
          reason: outcome.disposalReason,
          createdByAccountId: session.user.id,
          proposalNote: returnConditionNote ?? (outcome.condition === "LOST" ? "Dikembalikan dalam keadaan hilang." : "Dikembalikan dalam keadaan rusak berat."),
        });
      }
    }
  } else {
    await prisma.fixedAsset.update({
      where: { id: custody.assetId },
      data: {
        availableQuantity: computeAvailableQuantityAfterReturn(
          custody.asset.availableQuantity ?? 0,
          custody.quantity,
          inspectionResult
        ),
      },
    });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AssetCustody",
    recordId: custodyId,
    reason: `Returned — inspection result ${inspectionResult}`,
  });

  revalidatePath(`/assets/${custody.assetId}`);
  revalidatePath("/assets");
  if (custody.employeeId) revalidatePath("/my-assets");
}

// PDF: "Position or department change → GA Admin reviews custody → Keep
// asset? No → Return or transfer custody." An atomic return-and-reassign —
// the old row closes with transferredToCustodyId pointing at the new one
// (never a plain "returned to GA" gap), the new row is a fresh custody
// period for its own target, and for an INDIVIDUAL asset the item never
// passes back through Available in between (stays IN_USE the whole time).
export async function transferAssetCustody(
  custodyId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssets(session)) return t("common.forbidden");

  const custody = await prisma.assetCustody.findUnique({ where: { id: custodyId }, include: { asset: true } });
  if (!custody) return "Catatan penguasaan tidak ditemukan.";
  if (!isCustodyOpen(custody.status)) return "Catatan penguasaan ini sudah dikembalikan.";

  const newTargetTypeRaw = formData.get("newTargetType") as string;
  if (newTargetTypeRaw === "LOCATION") return validatePlacement("LOCATION", null) ?? undefined;
  if (!["EMPLOYEE", "DEPARTMENT"].includes(newTargetTypeRaw)) return "Tujuan pemindahan tidak valid.";
  const newTargetType = newTargetTypeRaw as AssetCustodyTargetType;
  const conditionAtHandover = (formData.get("conditionAtHandover") as string)?.trim() || null;

  let newEmployeeId: string | null = null;
  let newOrgUnitId: string | null = null;
  let newLocationId: string | null = null;
  if (newTargetType === "EMPLOYEE") {
    newEmployeeId = (formData.get("employeeId") as string)?.trim() || null;
    if (!newEmployeeId) return "Karyawan tujuan wajib dipilih.";
    const employee = await prisma.employee.findUnique({ where: { id: newEmployeeId } });
    if (!employee || !employee.activeFlag) return "Karyawan tujuan tidak ditemukan atau tidak aktif.";
  } else if (newTargetType === "DEPARTMENT") {
    newOrgUnitId = (formData.get("orgUnitId") as string)?.trim() || null;
    if (!newOrgUnitId) return "Departemen tujuan wajib dipilih.";
    newLocationId = (formData.get("locationId") as string)?.trim() || null;
    const placementError = validatePlacement("DEPARTMENT", newLocationId);
    if (placementError) return placementError;
    const location = await prisma.assetLocation.findUnique({ where: { id: newLocationId! } });
    if (!location || !location.activeFlag) return "Lokasi tujuan tidak ditemukan atau tidak aktif.";
  }

  const result = await prisma.$transaction(async (tx) => {
    const newCustody = await tx.assetCustody.create({
      data: {
        assetId: custody.assetId,
        targetType: newTargetType,
        employeeId: newEmployeeId,
        orgUnitId: newOrgUnitId,
        locationId: newLocationId,
        quantity: custody.quantity,
        status: "ACTIVE",
        conditionAtHandover,
        assignedByAccountId: session.user.id,
      },
    });

    await tx.assetCustody.update({
      where: { id: custodyId },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        returnedByAccountId: session.user.id,
        returnConditionNote: "Dipindahkan ke penguasaan baru",
        transferredToCustodyId: newCustody.id,
      },
    });

    return newCustody;
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AssetCustody",
    recordId: custodyId,
    reason: `Transferred custody to a new ${newTargetType.toLowerCase()} (new record ${result.id})`,
  });

  revalidatePath(`/assets/${custody.assetId}`);
  revalidatePath("/assets");
  if (custody.employeeId || newEmployeeId) revalidatePath("/my-assets");
}
