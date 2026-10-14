"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
import { createDisposalCaseInternal } from "@/lib/disposal-create";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import {
  canExecuteDisposalCase,
  computeAssetStatusAfterDisposalExecution,
  canCancelDisposalCase,
  computeAssetStatusAfterDisposalCancel,
} from "@/lib/ga-operations";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import type { DisposalMethod } from "@/generated/prisma/enums";


// Manual trigger — the PDF lists OBSOLETE as a disposal reason but shows no
// separate flow producing it, unlike BEYOND_REPAIR (maintenance outcome) or
// CONFIRMED_LOSS (loss review): a direct GA Admin action on any asset.
export async function createObsoleteDisposalCase(
  assetId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
  if (!asset) return "Aset tidak ditemukan.";
  if (asset.status === "RETIRED") return "Aset ini sudah berstatus Retired.";

  const existingOpenCase = await prisma.disposalCase.findFirst({
    where: { assetId, status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
  });
  if (existingOpenCase) return `Aset ini sudah memiliki kasus disposal aktif (${existingOpenCase.caseNumber}).`;

  const proposalNote = (formData.get("proposalNote") as string)?.trim() || null;

  await createDisposalCaseInternal({
    assetId,
    reason: "OBSOLETE",
    createdByAccountId: session.user.id,
    proposalNote,
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/disposal-cases");
  return undefined;
}

export async function executeDisposalCase(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const disposalCase = await prisma.disposalCase.findUnique({ where: { id: caseId } });
  if (!disposalCase) return "Kasus tidak ditemukan.";
  if (!canExecuteDisposalCase(disposalCase.status)) return "Kasus ini sudah dilaksanakan atau dibatalkan.";
  // Approving and taking the asset out are one step. For a draft, the decision is recorded here.
  const approvalNote = (formData.get("decisionNote") as string)?.trim() || null;

  const executionMethodRaw = formData.get("executionMethod") as string;
  if (!["RETIRE", "DISPOSE", "SELL_AS_SCRAP"].includes(executionMethodRaw)) return "Metode disposal wajib dipilih.";
  const executionMethod = executionMethodRaw as DisposalMethod;
  const executionDateRaw = (formData.get("executionDate") as string)?.trim();
  if (!executionDateRaw) return "Tanggal pelaksanaan wajib diisi.";
  const executionValueRaw = (formData.get("executionValue") as string)?.trim();
  const executionReference = (formData.get("executionReference") as string)?.trim() || null;

  let executionEvidenceFileId: string | undefined;
  const evidenceFile = formData.get("executionEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("disposal-execution", getExtension(evidenceFile.name));
    const bytes = Buffer.from(await evidenceFile.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: evidenceFile.name,
        mimeType: evidenceFile.type,
        sizeBytes: evidenceFile.size,
        sensitivity: "RESTRICTED",
        uploadedByAccountId: session.user.id,
        category: "DISPOSAL_EXECUTION_EVIDENCE",
        confidential: false,
      },
    });
    executionEvidenceFileId = fileObject.id;
  } else {
    return "Bukti pelaksanaan wajib diunggah.";
  }

  // Executing disposal retires the asset for good — any still-open custody
  // (the asset reaching DisposalCase at all almost always means it isn't
  // actually in anyone's hands anymore, but a stale record shouldn't be left
  // behind) is closed out here too, same as reviewGaRequestLoss already does
  // for a confirmed loss, so it can never keep blocking an offboarding.
  const openCustody = await prisma.assetCustody.findFirst({
    where: { assetId: disposalCase.assetId, status: { not: "RETURNED" } },
  });

  await prisma.$transaction([
    prisma.disposalCase.update({
      where: { id: caseId },
      data: {
        status: "EXECUTED",
        ...(disposalCase.decisionAt
          ? {}
          : { decisionAt: new Date(), decisionByAccountId: session.user.id, decisionNote: approvalNote }),
        executionMethod,
        executionDate: new Date(executionDateRaw),
        executionValue: executionValueRaw ? Number(executionValueRaw) : null,
        executionReference,
        executionEvidenceFileId,
        executedByAccountId: session.user.id,
      },
    }),
    prisma.fixedAsset.update({
      where: { id: disposalCase.assetId },
      data: { status: computeAssetStatusAfterDisposalExecution() },
    }),
    ...(openCustody
      ? [
          prisma.assetCustody.update({
            where: { id: openCustody.id },
            data: {
              status: "RETURNED",
              returnedAt: new Date(),
              returnedByAccountId: session.user.id,
              returnConditionNote: "Ditutup otomatis — kasus disposal dilaksanakan.",
              inspectionResult: disposalCase.reason === "OBSOLETE" ? null : "LOST_OR_BEYOND_REPAIR",
            },
          }),
        ]
      : []),
  ]);

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "DisposalCase",
    recordId: caseId,
    reason: `${disposalCase.caseNumber} approved and executed (${executionMethod}) — asset retired`,
  });

  revalidatePath(`/disposal-cases/${caseId}`);
  revalidatePath("/disposal-cases");
  revalidatePath(`/assets/${disposalCase.assetId}`);
  revalidatePath("/assets");
  return undefined;
}

// A case that is not going ahead (the asset turned out fine, or the loss was found) is
// cancelled with a reason. Nothing is deleted: the case stays as history, and the asset
// goes back into circulation.
export async function cancelDisposalCase(caseId: string, _prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return t("common.forbidden");

  const disposalCase = await prisma.disposalCase.findUnique({ where: { id: caseId } });
  if (!disposalCase) return "Kasus tidak ditemukan.";
  if (!canCancelDisposalCase(disposalCase.status)) return "Kasus ini sudah dilaksanakan atau dibatalkan.";

  const decisionNote = (formData.get("decisionNote") as string)?.trim();
  if (!decisionNote) return "Alasan pembatalan wajib diisi.";

  const openCustody = await prisma.assetCustody.findFirst({ where: { assetId: disposalCase.assetId, status: { not: "RETURNED" } } });

  await prisma.$transaction([
    prisma.disposalCase.update({
      where: { id: caseId },
      data: { status: "REJECTED", decisionAt: new Date(), decisionByAccountId: session.user.id, decisionNote },
    }),
    prisma.fixedAsset.update({
      where: { id: disposalCase.assetId },
      data: { status: computeAssetStatusAfterDisposalCancel(!!openCustody) },
    }),
  ]);

  await logAudit({
    actorAccountId: session.user.id,
    action: "REJECT",
    datasetName: "DisposalCase",
    recordId: caseId,
    reason: `${disposalCase.caseNumber} cancelled, asset back in circulation: ${decisionNote}`,
  });

  revalidatePath(`/disposal-cases/${caseId}`);
  revalidatePath("/disposal-cases");
  revalidatePath(`/assets/${disposalCase.assetId}`);
  revalidatePath("/assets");
  return undefined;
}
