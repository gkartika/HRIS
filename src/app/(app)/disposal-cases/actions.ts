"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations, canDecideAsConfiguredGaApprover } from "@/lib/permissions";
import {
  formatDisposalCaseNumber,
  canSubmitDisposalCaseForApproval,
  canDecideDisposalCase,
  decideDisposalCaseStatus,
  canExecuteDisposalCase,
  computeAssetStatusAfterDisposalExecution,
} from "@/lib/ga-operations";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import type { DisposalReason, DisposalMethod } from "@/generated/prisma/enums";

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

// The ONE shared creator for every auto-draft trigger (maintenance
// BEYOND_REPAIR outcome, confirmed loss review) plus the manual OBSOLETE
// action below — same "one internal creator, no duplicated insert" pattern
// as offboarding's createOffboardingCaseInternal.
//
// requireSession() here is defense-in-depth, not the real permission gate
// (every current caller already checked its own specific permission before
// reaching this point) — it just guarantees this exported "use server"
// function can never execute unauthenticated if a future change ever wires
// it up to a Client Component directly, bypassing today's server-to-server-
// only call graph.
export async function createDisposalCaseInternal(params: {
  assetId: string;
  reason: DisposalReason;
  createdByAccountId: string;
  sourceWorkOrderId?: string | null;
  sourceGaRequestId?: string | null;
  proposalNote?: string | null;
}): Promise<{ id: string; caseNumber: string }> {
  await requireSession();
  const year = new Date().getFullYear();
  const countThisYear = await prisma.disposalCase.count({
    where: { caseNumber: { startsWith: `DSP-${year}-` } },
  });
  const caseNumber = formatDisposalCaseNumber(countThisYear + 1, year);

  const created = await prisma.disposalCase.create({
    data: {
      caseNumber,
      assetId: params.assetId,
      reason: params.reason,
      status: "DRAFT",
      sourceWorkOrderId: params.sourceWorkOrderId ?? null,
      sourceGaRequestId: params.sourceGaRequestId ?? null,
      proposalNote: params.proposalNote ?? null,
      createdByAccountId: params.createdByAccountId,
    },
  });

  await logAudit({
    actorAccountId: params.createdByAccountId,
    action: "CREATE",
    datasetName: "DisposalCase",
    recordId: created.id,
    reason: `${caseNumber} drafted (reason: ${params.reason})`,
  });

  return { id: created.id, caseNumber: created.caseNumber };
}

// Manual trigger — the PDF lists OBSOLETE as a disposal reason but shows no
// separate flow producing it, unlike BEYOND_REPAIR (maintenance outcome) or
// CONFIRMED_LOSS (loss review): a direct GA Admin action on any asset.
export async function createObsoleteDisposalCase(
  assetId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return "Anda tidak memiliki akses.";

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

  // Same "not fit for use, pending decision" state maintenance BEYOND_REPAIR
  // already leaves the asset in — blocks new assignment via the existing
  // Phase 4A isAssetAvailableForIndividualAssignment allowlist.
  await prisma.fixedAsset.update({ where: { id: assetId }, data: { status: "UNDER_REPAIR" } });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/disposal-cases");
  return undefined;
}

export async function submitDisposalCaseForApproval(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return "Anda tidak memiliki akses.";

  const disposalCase = await prisma.disposalCase.findUnique({ where: { id: caseId } });
  if (!disposalCase) return "Kasus tidak ditemukan.";
  if (!canSubmitDisposalCaseForApproval(disposalCase.status)) {
    return "Kasus ini sudah diajukan atau tidak lagi dalam status Draft.";
  }

  const proposalNote = (formData.get("proposalNote") as string)?.trim() || null;

  let proposalEvidenceFileId: string | undefined;
  const evidenceFile = formData.get("proposalEvidenceFile") as File | null;
  if (evidenceFile && evidenceFile.size > 0) {
    const validationError = validateDocumentFile({ name: evidenceFile.name, type: evidenceFile.type, size: evidenceFile.size });
    if (validationError) return validationError;
    const storageKey = randomStorageKey("disposal-proposal", getExtension(evidenceFile.name));
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
        category: "DISPOSAL_PROPOSAL_EVIDENCE",
        confidential: false,
      },
    });
    proposalEvidenceFileId = fileObject.id;
  }

  await prisma.disposalCase.update({
    where: { id: caseId },
    data: {
      status: "PENDING_APPROVAL",
      proposalNote: proposalNote ?? disposalCase.proposalNote,
      proposalEvidenceFileId: proposalEvidenceFileId ?? disposalCase.proposalEvidenceFileId,
      submittedForApprovalAt: new Date(),
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "DisposalCase",
    recordId: caseId,
    reason: `${disposalCase.caseNumber} submitted for approval`,
  });

  revalidatePath(`/disposal-cases/${caseId}`);
  revalidatePath("/disposal-cases");
  return undefined;
}

// PDF: "Configured final Position approves." A rejection returns the case
// to DRAFT ("No: repair, storage or review") rather than closing it out —
// GA Admin can revise and resubmit; immutable history, never deleted.
export async function decideDisposalCase(
  caseId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const disposalCase = await prisma.disposalCase.findUnique({ where: { id: caseId } });
  if (!disposalCase) return "Kasus tidak ditemukan.";
  if (!canDecideDisposalCase(disposalCase.status)) {
    return "Kasus ini belum diajukan untuk persetujuan atau sudah diputuskan.";
  }

  const config = await prisma.gaApprovalConfig.findUnique({ where: { approvalType: "DISPOSAL" } });
  if (!config) return "Posisi penyetuju akhir untuk Disposal belum dikonfigurasi.";
  const holderIds = await getCurrentHolderEmployeeIds(config.approverPositionId);
  if (!canDecideAsConfiguredGaApprover(session.user.employeeId, holderIds)) {
    return "Anda tidak memiliki akses. Hanya pemegang Posisi penyetuju akhir yang dikonfigurasi yang dapat memutuskan.";
  }

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if (decision === "REJECT" && !decisionNote) return "Alasan penolakan wajib diisi.";

  await prisma.disposalCase.update({
    where: { id: caseId },
    data: {
      status: decideDisposalCaseStatus(decision === "APPROVE"),
      decisionAt: new Date(),
      decisionByAccountId: session.user.id,
      decisionPositionId: config.approverPositionId,
      decisionNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVE" ? "APPROVE" : "REJECT",
    datasetName: "DisposalCase",
    recordId: caseId,
    reason: decisionNote ?? `${disposalCase.caseNumber} ${decision === "APPROVE" ? "approved" : "rejected"}`,
  });

  revalidatePath(`/disposal-cases/${caseId}`);
  revalidatePath("/disposal-cases");
  return undefined;
}

export async function executeDisposalCase(
  caseId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaOperations(session)) return "Anda tidak memiliki akses.";

  const disposalCase = await prisma.disposalCase.findUnique({ where: { id: caseId } });
  if (!disposalCase) return "Kasus tidak ditemukan.";
  if (!canExecuteDisposalCase(disposalCase.status)) return "Kasus ini belum disetujui.";

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

  await prisma.$transaction([
    prisma.disposalCase.update({
      where: { id: caseId },
      data: {
        status: "EXECUTED",
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
  ]);

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "DisposalCase",
    recordId: caseId,
    reason: `${disposalCase.caseNumber} executed (${executionMethod}) — asset retired`,
  });

  revalidatePath(`/disposal-cases/${caseId}`);
  revalidatePath("/disposal-cases");
  revalidatePath(`/assets/${disposalCase.assetId}`);
  revalidatePath("/assets");
  return undefined;
}
