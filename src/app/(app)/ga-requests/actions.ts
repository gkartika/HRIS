"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations, canSubmitGaRequest, canDecideAsConfiguredGaApprover, canCancelGaRequest } from "@/lib/permissions";
import {
  formatGaRequestNumber,
  canVerifyGaRequest,
  routeGaRequestAfterVerification,
  canDecideGaRequest,
  decideGaRequestStatus,
  canProcessGaRequest,
  canReviewGaRequestLoss,
  decideGaRequestLossStatus,
  canCancelGaRequestStatus,
  computeAssetStatusAfterGaRequestVerification,
  computeAssetStatusAfterLossReview,
} from "@/lib/ga-operations";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import { assignAssetToEmployee, assignAssetToDepartment, assignAssetToLocation } from "@/app/(app)/assets/actions";
import { createDisposalCaseInternal } from "@/app/(app)/disposal-cases/actions";
import type { GaRequestType, GaRequestUrgency } from "@/generated/prisma/enums";

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export async function submitGaRequest(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canSubmitGaRequest(session)) return "Anda tidak memiliki akses.";

  const requestTypeRaw = formData.get("requestType") as string;
  if (!["NEW_ASSET_NEED", "DAMAGE_OR_ABNORMAL_CONDITION", "LOSS"].includes(requestTypeRaw)) {
    return "Jenis permintaan wajib dipilih.";
  }
  const requestType = requestTypeRaw as GaRequestType;

  const urgencyRaw = (formData.get("urgency") as string) || "MEDIUM";
  if (!["LOW", "MEDIUM", "HIGH"].includes(urgencyRaw)) return "Urgensi tidak valid.";
  const urgency = urgencyRaw as GaRequestUrgency;

  const description = (formData.get("description") as string)?.trim();
  if (!description) return "Deskripsi wajib diisi.";

  const assetId = (formData.get("assetId") as string)?.trim() || null;
  if ((requestType === "DAMAGE_OR_ABNORMAL_CONDITION" || requestType === "LOSS") && !assetId) {
    return "Aset wajib dipilih untuk laporan kerusakan atau kehilangan.";
  }
  if (assetId) {
    const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset) return "Aset tidak ditemukan.";
  }

  const locationId = (formData.get("locationId") as string)?.trim() || null;

  let evidenceFileId: string | undefined;
  const evidenceFile = formData.get("evidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("ga-request", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        employeeId: session.user.employeeId,
        uploadedByAccountId: session.user.id,
        category: "GA_REQUEST_EVIDENCE",
        confidential: false,
      },
    });
    evidenceFileId = fileObject.id;
  }

  const year = new Date().getFullYear();
  const countThisYear = await prisma.gaRequest.count({
    where: { requestNumber: { startsWith: `GAR-${year}-` } },
  });
  const requestNumber = formatGaRequestNumber(countThisYear + 1, year);

  const created = await prisma.gaRequest.create({
    data: {
      requestNumber,
      requestType,
      urgency,
      description,
      requesterEmployeeId: session.user.employeeId!,
      submittedByAccountId: session.user.id,
      assetId,
      locationId,
      evidenceFileId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "GaRequest",
    recordId: created.id,
    reason: `Submitted ${requestType} request ${requestNumber}`,
  });

  revalidatePath("/ga-requests");
  redirect(`/ga-requests/${created.id}`);
}

// PDF: "GA Admin verifies asset, location and urgency" then routes by
// requestType. Immediately moves a damaged/lost asset out of normal
// circulation (see computeAssetStatusAfterGaRequestVerification) so it
// can't be assigned while the issue is unresolved.
export async function verifyGaRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canVerifyGaRequest(request.status)) return "Permintaan ini sudah diverifikasi atau tidak lagi menunggu verifikasi.";

  const verificationNote = (formData.get("verificationNote") as string)?.trim() || null;

  let approvalRequired: boolean | null = null;
  if (request.requestType === "NEW_ASSET_NEED") {
    const config = await prisma.gaApprovalConfig.findUnique({ where: { approvalType: "NEW_ASSET_NEED" } });
    approvalRequired = !!config;
  }

  const newStatus = routeGaRequestAfterVerification(request.requestType, approvalRequired ?? false);
  const assetStatus = computeAssetStatusAfterGaRequestVerification(request.requestType);

  // GA Admin may fill the evidence gap here if the requester didn't attach
  // one at submission ("Record loss incident and evidence" is a GA Admin
  // step per the PDF, not necessarily the requester's).
  let evidenceFileId: string | undefined;
  if (!request.evidenceFileId) {
    const evidenceFile = formData.get("evidenceFile") as File | null;
    if (evidenceFile && evidenceFile.size > 0) {
      const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
      if (validationError) return validationError;
      const storageKey = randomStorageKey("ga-request", getExtension(evidenceFile.name));
      const bytes = Buffer.from(await evidenceFile.arrayBuffer());
      await savePrivateFile(storageKey, bytes);
      const fileObject = await prisma.fileObject.create({
        data: {
          storageKey,
          originalFileName: evidenceFile.name,
          mimeType: evidenceFile.type,
          sizeBytes: evidenceFile.size,
          sensitivity: "RESTRICTED",
          employeeId: request.requesterEmployeeId,
          uploadedByAccountId: session.user.id,
          category: "GA_REQUEST_EVIDENCE",
          confidential: false,
        },
      });
      evidenceFileId = fileObject.id;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.gaRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        verifiedAt: new Date(),
        verifiedByAccountId: session.user.id,
        verificationNote,
        approvalRequired,
        evidenceFileId: evidenceFileId ?? request.evidenceFileId,
      },
    });
    if (assetStatus && request.assetId) {
      await tx.fixedAsset.update({ where: { id: request.assetId }, data: { status: assetStatus } });
    }
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} verified, routed to ${newStatus}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  if (request.assetId) revalidatePath(`/assets/${request.assetId}`);
  return undefined;
}

// Position-based approval for NEW_ASSET_NEED — resolves the *current*
// GaApprovalConfig holder set live (not a snapshot taken at verification
// time), same "resolved live by the caller" contract as
// canDecideAbsenceRequestAsFirstApprover.
export async function decideGaRequestAsApprover(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canDecideGaRequest(request.status)) return "Permintaan ini belum siap untuk diputuskan atau sudah diproses.";

  const config = await prisma.gaApprovalConfig.findUnique({ where: { approvalType: "NEW_ASSET_NEED" } });
  if (!config) return "Posisi penyetuju untuk kebutuhan aset baru belum dikonfigurasi.";
  const holderIds = await getCurrentHolderEmployeeIds(config.approverPositionId);
  if (!canDecideAsConfiguredGaApprover(session.user.employeeId, holderIds)) {
    return "Anda tidak memiliki akses. Hanya pemegang Posisi penyetuju yang dikonfigurasi yang dapat memutuskan.";
  }

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if (decision === "REJECT" && !decisionNote) return "Alasan penolakan wajib diisi.";

  await prisma.gaRequest.update({
    where: { id: requestId },
    data: {
      status: decideGaRequestStatus(decision === "APPROVE"),
      decisionAt: new Date(),
      decisionByAccountId: session.user.id,
      decisionPositionId: config.approverPositionId,
      decisionNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVE" ? "APPROVE" : "REJECT",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: decisionNote ?? `${request.requestNumber} ${decision === "APPROVE" ? "approved" : "rejected"}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  return undefined;
}

// PDF: "Allocate available asset or record procurement reference" — the
// hand-off to Phase 4A custody. Reuses the existing, unmodified assign*
// actions in assets/actions.ts rather than duplicating custody-creation
// logic; the created custody's id is looked up afterward (most recent for
// this asset) since those actions don't return it directly.
export async function processGaRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canProcessGaRequest(request.status)) return "Permintaan ini belum disetujui atau sudah diproses.";

  const processingMode = formData.get("processingMode") as string;

  if (processingMode === "PROCUREMENT") {
    const procurementReference = (formData.get("procurementReference") as string)?.trim();
    if (!procurementReference) return "Referensi pengadaan wajib diisi.";

    await prisma.gaRequest.update({
      where: { id: requestId },
      data: { status: "PROCESSED", processedAt: new Date(), processedByAccountId: session.user.id, procurementReference },
    });

    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "GaRequest",
      recordId: requestId,
      reason: `${request.requestNumber} processed via procurement reference ${procurementReference}`,
    });

    revalidatePath(`/ga-requests/${requestId}`);
    revalidatePath("/ga-requests");
    return undefined;
  }

  if (processingMode !== "ALLOCATE") return "Mode pemrosesan tidak valid.";

  const assetId = (formData.get("allocateAssetId") as string)?.trim();
  if (!assetId) return "Aset yang akan dialokasikan wajib dipilih.";
  const targetType = formData.get("targetType") as string;

  const innerFormData = new FormData();
  const conditionAtHandover = formData.get("conditionAtHandover") as string | null;
  if (conditionAtHandover) innerFormData.set("conditionAtHandover", conditionAtHandover);
  const quantity = formData.get("quantity") as string | null;
  if (quantity) innerFormData.set("quantity", quantity);
  const evidenceFile = formData.get("handoverEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) innerFormData.set("handoverEvidenceFile", evidenceFile);

  let assignError: string | undefined;
  if (targetType === "EMPLOYEE") {
    const employeeId = (formData.get("employeeId") as string)?.trim();
    if (!employeeId) return "Karyawan wajib dipilih.";
    innerFormData.set("employeeId", employeeId);
    assignError = await assignAssetToEmployee(assetId, undefined, innerFormData);
  } else if (targetType === "DEPARTMENT") {
    const orgUnitId = (formData.get("orgUnitId") as string)?.trim();
    if (!orgUnitId) return "Departemen wajib dipilih.";
    innerFormData.set("orgUnitId", orgUnitId);
    assignError = await assignAssetToDepartment(assetId, undefined, innerFormData);
  } else if (targetType === "LOCATION") {
    const locationId = (formData.get("locationId") as string)?.trim();
    if (!locationId) return "Lokasi wajib dipilih.";
    innerFormData.set("locationId", locationId);
    assignError = await assignAssetToLocation(assetId, undefined, innerFormData);
  } else {
    return "Tujuan alokasi tidak valid.";
  }
  if (assignError) return assignError;

  const custody = await prisma.assetCustody.findFirst({ where: { assetId }, orderBy: { createdAt: "desc" } });

  await prisma.gaRequest.update({
    where: { id: requestId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      processedByAccountId: session.user.id,
      resultingCustodyId: custody?.id ?? null,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} processed — asset allocated via custody ${custody?.id ?? "?"}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  revalidatePath(`/assets/${assetId}`);
  return undefined;
}

// PDF: "Configured Position reviews loss" -> "Confirmed: disposal" or a
// negative outcome that returns the asset to circulation. A confirmed loss
// auto-drafts a DisposalCase (reason CONFIRMED_LOSS) via the shared creator
// in disposal-cases/actions.ts.
export async function reviewGaRequestLoss(
  requestId: string,
  decision: "CONFIRM" | "NOT_CONFIRM",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canReviewGaRequestLoss(request.status)) return "Permintaan ini belum siap untuk ditinjau atau sudah diputuskan.";
  if (!request.assetId) return "Permintaan kehilangan ini tidak memiliki aset terkait.";

  const config = await prisma.gaApprovalConfig.findUnique({ where: { approvalType: "LOSS_REVIEW" } });
  if (!config) return "Posisi peninjau kehilangan belum dikonfigurasi.";
  const holderIds = await getCurrentHolderEmployeeIds(config.approverPositionId);
  if (!canDecideAsConfiguredGaApprover(session.user.employeeId, holderIds)) {
    return "Anda tidak memiliki akses. Hanya pemegang Posisi peninjau yang dikonfigurasi yang dapat memutuskan.";
  }

  const lossReviewNote = (formData.get("lossReviewNote") as string)?.trim() || null;
  const confirmed = decision === "CONFIRM";

  const openCustody = await prisma.assetCustody.findFirst({ where: { assetId: request.assetId, status: { not: "RETURNED" } } });
  const newAssetStatus = computeAssetStatusAfterLossReview(confirmed, !!openCustody);

  await prisma.$transaction([
    prisma.gaRequest.update({
      where: { id: requestId },
      data: {
        status: decideGaRequestLossStatus(confirmed),
        lossReviewedAt: new Date(),
        lossReviewedByAccountId: session.user.id,
        lossReviewedPositionId: config.approverPositionId,
        lossReviewNote,
      },
    }),
    prisma.fixedAsset.update({ where: { id: request.assetId }, data: { status: newAssetStatus } }),
  ]);

  if (confirmed) {
    await createDisposalCaseInternal({
      assetId: request.assetId,
      reason: "CONFIRMED_LOSS",
      createdByAccountId: session.user.id,
      sourceGaRequestId: request.id,
      proposalNote: lossReviewNote,
    });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} loss review: ${confirmed ? "confirmed" : "not confirmed"}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  revalidatePath(`/assets/${request.assetId}`);
  if (confirmed) revalidatePath("/disposal-cases");
  return undefined;
}

export async function cancelGaRequest(requestId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.gaRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canCancelGaRequest(session, request.requesterEmployeeId)) return "Anda tidak memiliki akses untuk membatalkan permintaan ini.";
  if (!canCancelGaRequestStatus(request.status)) return "Permintaan yang sudah diproses tidak dapat dibatalkan.";

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  await prisma.gaRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByAccountId: session.user.id, cancellationReason },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaRequest",
    recordId: requestId,
    reason: `${request.requestNumber} cancelled: ${cancellationReason}`,
  });

  revalidatePath(`/ga-requests/${requestId}`);
  revalidatePath("/ga-requests");
  return undefined;
}
