"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitAbsenceRequest,
  canDecideAbsenceRequestAsFirstApprover,
  canDecideAbsenceRequestAsHrAdmin,
  canOverrideAbsenceRequest,
  canCancelAbsenceRequest,
} from "@/lib/permissions";
import {
  formatAbsenceRequestNumber,
  doDateRangesOverlap,
  canDecideAbsenceRequestAsFirstApproverStatus,
  canDecideAbsenceRequestAsHrAdminStatus,
  canHrOverrideAbsenceRequestStatus,
  canCancelAbsenceRequestStatus,
} from "@/lib/absence";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import type { AbsenceType } from "@/generated/prisma/enums";

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export async function submitAbsenceRequest(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const employeeId = (formData.get("employeeId") as string) || session.user.employeeId;
  if (!employeeId) return "Karyawan wajib dipilih.";
  if (!canSubmitAbsenceRequest(session, employeeId)) return "Anda tidak memiliki akses.";

  const absenceType = formData.get("absenceType") as AbsenceType;
  const startDateRaw = formData.get("startDate") as string;
  const endDateRaw = formData.get("endDate") as string;
  const reason = (formData.get("reason") as string)?.trim();

  if (!["CUTI", "IZIN", "SAKIT", "LAINNYA"].includes(absenceType)) return "Jenis absensi wajib dipilih.";
  if (!startDateRaw || !endDateRaw) return "Tanggal mulai dan selesai wajib diisi.";
  if (!reason) return "Alasan wajib diisi.";

  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);
  if (startDate > endDate) return "Tanggal mulai tidak boleh setelah tanggal selesai.";

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee) return "Karyawan tidak ditemukan.";

  const overlapping = await prisma.absenceRequest.findMany({
    where: { employeeId, status: { in: ["SUBMITTED", "PENDING_HR_ADMIN", "APPROVED"] } },
    select: { startDate: true, endDate: true, requestNumber: true },
  });
  const overlap = overlapping.find((o) => doDateRangesOverlap(startDate, endDate, o.startDate, o.endDate));
  if (overlap) return `Rentang tanggal ini tumpang tindih dengan pengajuan ${overlap.requestNumber} yang masih berjalan.`;

  let firstApproverPositionId: string | null = null;
  if (employee.currentPositionId) {
    const position = await prisma.position.findUnique({
      where: { id: employee.currentPositionId },
      select: { orgUnitId: true },
    });
    const departmentId = position ? await resolveDepartmentId(position.orgUnitId) : null;
    if (departmentId) {
      const config = await prisma.absenceApproverConfig.findUnique({ where: { departmentId } });
      firstApproverPositionId = config?.approverPositionId ?? null;
    }
  }

  const file = formData.get("attachment") as File | null;
  let attachmentFileId: string | undefined;
  if (file && file.size > 0) {
    const validationError = validateDocumentFile({ name: file.name, type: file.type, size: file.size });
    if (validationError) return validationError;
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

  const year = new Date().getFullYear();
  const countThisYear = await prisma.absenceRequest.count({
    where: { requestNumber: { startsWith: `ABS-${year}-` } },
  });
  const requestNumber = formatAbsenceRequestNumber(countThisYear + 1, year);

  const created = await prisma.absenceRequest.create({
    data: {
      requestNumber,
      employeeId,
      absenceType,
      startDate,
      endDate,
      reason,
      attachmentFileId,
      submittedByAccountId: session.user.id,
      firstApproverPositionId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AbsenceRequest",
    recordId: created.id,
    reason: `Submitted ${absenceType} request ${requestNumber}`,
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
    return "Anda tidak memiliki akses.";
  }
  if (!canDecideAbsenceRequestAsFirstApproverStatus(request.status)) {
    return "Pengajuan ini sudah tidak berada pada tahap penyetuju pertama.";
  }

  const note = (formData.get("note") as string)?.trim() || null;
  if (decision === "REJECT" && !note) return "Alasan penolakan wajib diisi.";

  await prisma.absenceRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVE" ? "PENDING_HR_ADMIN" : "REJECTED",
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

export async function decideAbsenceRequestAsHrAdmin(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canDecideAbsenceRequestAsHrAdmin(session)) return "Anda tidak memiliki akses.";

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
  if (!canOverrideAbsenceRequest(session)) return "Anda tidak memiliki akses.";

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
    return "Anda tidak memiliki akses.";
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
