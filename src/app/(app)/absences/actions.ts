"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { getExtension } from "@/lib/validation/employee-fields";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitAbsenceRequest,
  canDecideAbsenceRequestAsFirstApprover,
  canDecideAbsenceRequestAsSecondApprover,
  canDecideAbsenceRequestAsHrAdmin,
  canOverrideAbsenceRequest,
  canCancelAbsenceRequest,
} from "@/lib/permissions";
import {
  formatAbsenceRequestNumber,
  doDateRangesOverlap,
  canDecideAbsenceRequestAsFirstApproverStatus,
  canDecideAbsenceRequestAsSecondApproverStatus,
  canDecideAbsenceRequestAsHrAdminStatus,
  canHrOverrideAbsenceRequestStatus,
  canCancelAbsenceRequestStatus,
  findOpenRequestOfType,
} from "@/lib/absence";
import { resolveAbsenceApprovalChain } from "@/lib/absence-routing";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { formFail, type FormState } from "@/lib/form-state";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import type { AbsenceStatus } from "@/generated/prisma/enums";

export async function submitAbsenceRequest(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();

  const employeeId = (formData.get("employeeId") as string) || session.user.employeeId;
  if (!employeeId) return formFail(formData, "Karyawan wajib dipilih.", "employeeId");
  if (!canSubmitAbsenceRequest(session, employeeId)) return formFail(formData, t("common.forbidden"));

  const absenceTypeCode = formData.get("absenceType") as string;
  const startDateRaw = formData.get("startDate") as string;
  const endDateRaw = formData.get("endDate") as string;
  const reason = (formData.get("reason") as string)?.trim();

  const typeConfig = absenceTypeCode
    ? await prisma.absenceTypeConfig.findUnique({ where: { code: absenceTypeCode } })
    : null;
  if (!typeConfig || !typeConfig.activeFlag) return formFail(formData, "Jenis absensi wajib dipilih.", "absenceType");
  if (!startDateRaw || !endDateRaw) return formFail(formData, "Tanggal mulai dan selesai wajib diisi.", !startDateRaw ? "startDate" : "endDate");
  if (!reason) return formFail(formData, "Alasan wajib diisi.", "reason");

  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);
  if (startDate > endDate) return formFail(formData, "Tanggal mulai tidak boleh setelah tanggal selesai.", "startDate");

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee) return formFail(formData, "Karyawan tidak ditemukan.");

  const overlapping = await prisma.absenceRequest.findMany({
    where: { employeeId, status: { in: ["SUBMITTED", "PENDING_SECOND_APPROVER", "PENDING_HR_ADMIN", "APPROVED"] } },
    select: { startDate: true, endDate: true, requestNumber: true, absenceTypeCode: true, status: true },
  });
  const open = findOpenRequestOfType(overlapping, absenceTypeCode);
  if (open) {
    return formFail(
      formData,
      `Masih ada pengajuan ${typeConfig.label} (${open.requestNumber}) yang belum diputuskan. Tunggu sampai diputuskan atau batalkan dulu; jenis absensi lain tetap bisa diajukan.`,
      "absenceType"
    );
  }
  const overlap = overlapping.find((o) => doDateRangesOverlap(startDate, endDate, o.startDate, o.endDate));
  if (overlap) return formFail(formData, `Rentang tanggal ini tumpang tindih dengan pengajuan ${overlap.requestNumber} yang masih berjalan.`);

  // Types that skip the first-approval stage (e.g. Sakit) go straight to
  // the mandatory HR Admin stage — no approver chain to resolve at all,
  // not just its first link.
  const { firstApproverPositionId, secondApproverPositionId } = typeConfig.requiresFirstApproval
    ? await resolveAbsenceApprovalChain(employeeId)
    : { firstApproverPositionId: null, secondApproverPositionId: null };
  const initialStatus: AbsenceStatus = typeConfig.requiresFirstApproval ? "SUBMITTED" : "PENDING_HR_ADMIN";

  const file = formData.get("attachment") as File | null;
  let attachmentFileId: string | undefined;
  if (file && file.size > 0) {
    const validationError = validateDocumentFile({ name: file.name, type: file.type, size: file.size });
    if (validationError) return formFail(formData, validationError, "attachment");
    const storageKey = randomStorageKey("absence-attachment", getExtension(file.name));
    const bytes = Buffer.from(await file.arrayBuffer());
    await savePrivateFile(storageKey, bytes);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        sensitivity: "RESTRICTED",
        employeeId,
        uploadedByAccountId: session.user.id,
        category: "ABSENCE_ATTACHMENT",
        confidential: true,
      },
    });
    attachmentFileId = fileObject.id;
  }

  const year = companyYear();
  const seq = await nextSequence(`ABS-${year}`);
  const requestNumber = formatAbsenceRequestNumber(seq, year);

  const created = await prisma.absenceRequest.create({
    data: {
      requestNumber,
      employeeId,
      absenceTypeCode,
      status: initialStatus,
      startDate,
      endDate,
      reason,
      attachmentFileId,
      submittedByAccountId: session.user.id,
      firstApproverPositionId,
      secondApproverPositionId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AbsenceRequest",
    recordId: created.id,
    reason: `Submitted ${absenceTypeCode} request ${requestNumber}`,
  });

  revalidatePath("/absences");
  redirect(`/absences/${created.id}`);
}

export async function decideAbsenceRequestAsFirstApprover(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Pengajuan tidak ditemukan.";

  const holderIds = await getCurrentHolderEmployeeIds(request.firstApproverPositionId);
  if (!canDecideAbsenceRequestAsFirstApprover(session.user.employeeId, holderIds)) {
    return t("common.forbidden");
  }
  if (!canDecideAbsenceRequestAsFirstApproverStatus(request.status)) {
    return "Pengajuan ini sudah tidak berada pada tahap penyetuju pertama.";
  }

  const note = (formData.get("note") as string)?.trim() || null;
  if (decision === "REJECT" && !note) return "Alasan penolakan wajib diisi.";

  // Approving moves to the second stage when this request's resolved chain
  // has one (Section-level config on top of the Department's), otherwise
  // straight to HR Admin as always.
  const nextStatus: AbsenceStatus =
    decision === "APPROVE" ? (request.secondApproverPositionId ? "PENDING_SECOND_APPROVER" : "PENDING_HR_ADMIN") : "REJECTED";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: nextStatus,
      firstDecisionAt: new Date(),
      firstDecisionByAccountId: session.user.id,
      firstDecisionNote: note,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceRequest",
    recordId: requestId,
    reason: `First approver ${decision === "APPROVE" ? "approved" : "rejected"} ${request.requestNumber}`,
  });

  revalidatePath(`/absences/${requestId}`);
  revalidatePath("/absences");
}

export async function decideAbsenceRequestAsSecondApprover(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Pengajuan tidak ditemukan.";

  const holderIds = await getCurrentHolderEmployeeIds(request.secondApproverPositionId);
  if (!canDecideAbsenceRequestAsSecondApprover(session.user.employeeId, holderIds)) {
    return t("common.forbidden");
  }
  if (!canDecideAbsenceRequestAsSecondApproverStatus(request.status)) {
    return "Pengajuan ini sudah tidak berada pada tahap penyetuju kedua.";
  }

  const note = (formData.get("note") as string)?.trim() || null;
  if (decision === "REJECT" && !note) return "Alasan penolakan wajib diisi.";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVE" ? "PENDING_HR_ADMIN" : "REJECTED",
      secondDecisionAt: new Date(),
      secondDecisionByAccountId: session.user.id,
      secondDecisionNote: note,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceRequest",
    recordId: requestId,
    reason: `Second approver ${decision === "APPROVE" ? "approved" : "rejected"} ${request.requestNumber}`,
  });

  revalidatePath(`/absences/${requestId}`);
  revalidatePath("/absences");
}

export async function decideAbsenceRequestAsHrAdmin(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canDecideAbsenceRequestAsHrAdmin(session)) return t("common.forbidden");

  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Pengajuan tidak ditemukan.";
  if (!canDecideAbsenceRequestAsHrAdminStatus(request.status)) {
    return "Pengajuan ini sudah tidak berada pada tahap HR Admin.";
  }

  const note = (formData.get("note") as string)?.trim() || null;
  if (decision === "REJECT" && !note) return "Alasan penolakan wajib diisi.";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
      hrAdminDecisionAt: new Date(),
      hrAdminDecisionByAccountId: session.user.id,
      hrAdminDecisionNote: note,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceRequest",
    recordId: requestId,
    reason: `HR Admin ${decision === "APPROVE" ? "approved" : "rejected"} ${request.requestNumber}`,
  });

  revalidatePath(`/absences/${requestId}`);
  revalidatePath("/absences");
}

// HR Admin override: in-place overwrite of an already-decided request, per
// spec ("no separate correction record") — always carries a mandatory
// reason/identity/timestamp.
export async function overrideAbsenceRequest(
  requestId: string,
  newStatus: "APPROVED" | "REJECTED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canOverrideAbsenceRequest(session)) return t("common.forbidden");

  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Pengajuan tidak ditemukan.";
  if (!canHrOverrideAbsenceRequestStatus(request.status)) {
    return "Hanya pengajuan yang sudah diputuskan (Disetujui/Ditolak) yang dapat dikoreksi.";
  }

  const overrideReason = (formData.get("overrideReason") as string)?.trim();
  if (!overrideReason) return "Alasan koreksi wajib diisi.";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      isHrOverride: true,
      hrOverrideReason: overrideReason,
      hrOverrideAt: new Date(),
      hrOverrideByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceRequest",
    recordId: requestId,
    reason: `HR Admin override: ${request.status} -> ${newStatus} (${overrideReason})`,
  });

  revalidatePath(`/absences/${requestId}`);
  revalidatePath("/absences");
}

export async function cancelAbsenceRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const request = await prisma.absenceRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Pengajuan tidak ditemukan.";
  if (!canCancelAbsenceRequest(session, request.employeeId, request.submittedByAccountId)) {
    return t("common.forbidden");
  }
  if (!canCancelAbsenceRequestStatus(request.status)) {
    return "Pengajuan ini sudah tidak dapat dibatalkan.";
  }

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByAccountId: session.user.id,
      cancellationReason,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceRequest",
    recordId: requestId,
    reason: `Cancelled ${request.requestNumber}: ${cancellationReason}`,
  });

  revalidatePath(`/absences/${requestId}`);
  revalidatePath("/absences");
}
