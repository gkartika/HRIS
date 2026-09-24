"use server";

import { revalidatePath } from "next/cache";
import { authorizeDeptHeadDecision, authorizeHrManagerDecision } from "@/lib/approval-authority";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canSubmitRecruitmentRequest,
  canApproveRecruitmentRequest,
  canCreateEmployeeFromRequest,
  canCancelRecruitmentRequest,
  isHrManager,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary } from "@/lib/position-occupancy";
import {
  canRequestAcceptFulfillment,
  canCancelRequestStatus,
  computeFulfillmentCounts,
  nextStatusAfterFulfillment,
  formatRequestNumber,
  initialRecruitmentStatus,
} from "@/lib/recruitment";
import { formatOnboardingCaseNumber } from "@/lib/onboarding";
import { applyOnboardingMandatoryTrainingForEmployee } from "@/lib/mandatory-training";
import { validateNoKk } from "@/lib/validation/employee-fields";
import type {
  RecruitmentReasonCode,
  ShiftCode,
  EducationRequirementCode,
  WorkExperienceBand,
  AgeBand,
  RequestedJobLevel,
  Gender,
  EmploymentStatus,
} from "@/generated/prisma/enums";

export async function submitRecruitmentRequest(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canSubmitRecruitmentRequest(session)) return "Anda tidak memiliki akses.";

  const requestDate = formData.get("requestDate") as string;
  const reasonCode = formData.get("reasonCode") as RecruitmentReasonCode;
  const departmentId = formData.get("departmentId") as string;
  const jobId = (formData.get("jobId") as string) || null;
  const shiftCode = formData.get("shiftCode") as ShiftCode;
  const requestedHeadcount = Number(formData.get("requestedHeadcount"));
  const jobDescriptionSnapshot = (formData.get("jobDescriptionSnapshot") as string)?.trim();
  const educationRequirementCode = formData.get("educationRequirementCode") as EducationRequirementCode;
  const workExperienceBand = formData.get("workExperienceBand") as WorkExperienceBand;
  const ageBand = formData.get("ageBand") as AgeBand;
  const genderRequirement = (formData.get("genderRequirement") as string) || null;
  const requestedJobLevel = formData.get("requestedJobLevel") as RequestedJobLevel;
  const specialCriteria = (formData.get("specialCriteria") as string)?.trim() || null;
  const requesterEmployeeId = (formData.get("requesterEmployeeId") as string) || session.user.employeeId;

  if (
    !requestDate ||
    !reasonCode ||
    !departmentId ||
    !shiftCode ||
    !requestedHeadcount ||
    !jobDescriptionSnapshot ||
    !educationRequirementCode ||
    !workExperienceBand ||
    !ageBand ||
    !requestedJobLevel ||
    !requesterEmployeeId
  ) {
    return "Semua field wajib (kecuali Posisi yang Dituju, Jenis Kelamin, dan Kriteria Khusus) harus diisi.";
  }
  if (requestedHeadcount < 1) return "Jumlah harus minimal 1.";

  const requester = await prisma.employee.findUnique({ where: { id: requesterEmployeeId } });
  if (!requester) return "Karyawan pengaju tidak ditemukan.";

  const requesterDeptHeadPositions = await getActiveDeptHeadPositions(requesterEmployeeId, departmentId);
  const initialStatus = initialRecruitmentStatus(requesterDeptHeadPositions.length > 0);

  const year = companyYear(new Date(requestDate));
  const seq = await nextSequence(`REQ-${year}`);
  const requestNumber = formatRequestNumber(seq, year);
  const now = new Date();

  const request = await prisma.recruitmentRequest.create({
    data: {
      requestNumber,
      requestDate: new Date(requestDate),
      reasonCode,
      departmentId,
      jobId,
      shiftCode,
      requestedHeadcount,
      jobDescriptionSnapshot,
      educationRequirementCode,
      workExperienceBand,
      ageBand,
      genderRequirement: genderRequirement ? (genderRequirement as Gender) : null,
      requestedJobLevel,
      specialCriteria,
      status: initialStatus,
      requesterEmployeeId,
      requesterPositionId: requester.currentPositionId,
      submittedAt: now,
      submittedByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "RecruitmentRequest",
    recordId: request.id,
    reason: `Submitted recruitment request ${requestNumber} for ${requestedHeadcount} position(s)`,
  });

  revalidatePath("/recruitment");
  redirect(`/recruitment/${request.id}`);
}

export async function startReviewRecruitmentRequest(requestId: string) {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!canApproveRecruitmentRequest(hrManagerPositions.map((p) => p.positionId))) {
    throw new Error("Access denied");
  }

  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Request not found");
  if (request.status !== "SUBMITTED") throw new Error("Invalid transition");

  await prisma.recruitmentRequest.update({ where: { id: requestId }, data: { status: "UNDER_REVIEW" } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: `Started review of ${request.requestNumber}`,
  });

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
}

// Department Manager/Head (Job level 3B) approval gate, ahead of the HR
// Manager, added per direct user request — same evidence shape as
// decideRecruitmentRequest below (WF-02/WF-05: record the specific
// qualifying Position, required when the actor holds more than one in this
// department). Approve unblocks the HR Manager's queue (status ->
// SUBMITTED); Reject/Return short-circuit the request exactly like the HR
// Manager's own decision would, since the outcome is the same either way.
export async function decideRecruitmentRequestAsDeptHead(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.status !== "PENDING_DEPT_HEAD") {
    return "Permintaan ini sudah diproses.";
  }

  const authority = await authorizeDeptHeadDecision({
    employeeId: session.user.employeeId,
    departmentId: request.departmentId,
    formData,
  });
  if (!authority.ok) return authority.error;
  const { decisionPositionId } = authority;

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if ((decision === "REJECTED" || decision === "RETURNED") && !decisionNote) {
    return "Catatan keputusan wajib diisi untuk Tolak/Kembalikan.";
  }

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVED" ? "SUBMITTED" : decision,
      deptHeadDecisionAt: new Date(),
      deptHeadDecisionByAccountId: session.user.id,
      deptHeadDecisionPositionId: decisionPositionId,
      deptHeadDecisionNote: decisionNote,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: decisionNote ?? `Request ${request.requestNumber} ${decision.toLowerCase()} by dept head/manager`,
  });

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
}

// WF-15/WF-02/WF-05: only the employee occupying an active HR Manager
// Position may decide, and the specific Position they're acting through
// (decisionPositionId) must be recorded — required data when they hold more
// than one qualifying Position, per ACC-14's note.
export async function decideRecruitmentRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const authority = await authorizeHrManagerDecision({ employeeId: session.user.employeeId, formData });
  if (!authority.ok) return authority.error;
  const { decisionPositionId } = authority;

  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.status !== "SUBMITTED" && request.status !== "UNDER_REVIEW") {
    return "Permintaan ini sudah diproses.";
  }

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if ((decision === "REJECTED" || decision === "RETURNED") && !decisionNote) {
    return "Catatan keputusan wajib diisi untuk Tolak/Kembalikan.";
  }

  // The requester may already set Jabatan Standar on submit; the HR Manager
  // can confirm or override it here as part of Approve, since
  // createEmployeeFromRecruitmentRequest still needs it to filter candidate
  // Positions. Not required for Reject/Return.
  const jobId = (formData.get("jobId") as string) || request.jobId;
  if (decision === "APPROVED" && !jobId) {
    return "Jabatan wajib dipilih sebelum menyetujui permintaan ini.";
  }

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVED" ? "APPROVED" : decision,
      approvedAt: decision === "APPROVED" ? new Date() : null,
      approvedByAccountId: session.user.id,
      decisionPositionId,
      decisionNote,
      jobId: decision === "APPROVED" ? jobId : request.jobId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: decisionNote ?? `Request ${request.requestNumber} ${decision.toLowerCase()}`,
  });

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
}

// DM-25/ACC-16: cancellation is the explicit exception to "HR Manager alone
// decides" — Requester, active HR Manager, or HR Admin may all cancel from
// an eligible state. The request row is never deleted; existing fulfillment
// links are preserved untouched.
export async function cancelRecruitmentRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";

  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const activeHrManagerPositionIds = hrManagerPositions.map((p) => p.positionId);
  if (!canCancelRecruitmentRequest(session, request.requesterEmployeeId, activeHrManagerPositionIds)) {
    return "Anda tidak memiliki akses untuk membatalkan permintaan ini.";
  }
  if (!canCancelRequestStatus(request.status)) {
    return "Permintaan berstatus Terisi Penuh, Ditutup, atau sudah Dibatalkan tidak dapat dibatalkan.";
  }

  const cancellationReason = (formData.get("cancellationReason") as string)?.trim();
  if (!cancellationReason) return "Alasan pembatalan wajib diisi.";

  const isRequester = session.user.employeeId === request.requesterEmployeeId;
  // Attribute to HR Manager whenever the actor currently holds that
  // authority, even if they're also the original Requester — HR Manager is
  // the stronger/more specific authority of the three.
  const cancellationAuthority = isHrManager(activeHrManagerPositionIds)
    ? "HR_MANAGER"
    : isRequester
      ? "REQUESTER"
      : "HR_ADMIN";

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      previousStatus: request.status,
      cancelledAt: new Date(),
      cancelledByAccountId: session.user.id,
      cancelledByEmployeeId: session.user.employeeId,
      cancellationAuthority,
      cancellationReason,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: `Cancelled ${request.requestNumber} (was ${request.status}, authority: ${cancellationAuthority}): ${cancellationReason}`,
  });

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
}

export async function createEmployeeFromRecruitmentRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateEmployeeFromRequest(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id: requestId },
    include: { fulfillments: true },
  });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canRequestAcceptFulfillment(request.status)) {
    return "Permintaan ini belum dapat diproses menjadi karyawan (status saat ini belum Disetujui).";
  }
  const counts = computeFulfillmentCounts(request.requestedHeadcount, request.fulfillments.length);
  if (counts.isFull) return "Permintaan ini sudah terisi penuh.";

  const employeeNumber = (formData.get("employeeNumber") as string)?.trim();
  const fullLegalName = (formData.get("fullLegalName") as string)?.trim();
  const gender = (formData.get("gender") as string) || null;
  const workEmail = (formData.get("workEmail") as string)?.trim() || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const hireDate = formData.get("hireDate") as string;
  const employmentStatus = formData.get("employmentStatus") as EmploymentStatus;
  const positionId = formData.get("positionId") as string;
  const noKk = (formData.get("noKk") as string)?.trim() || null;
  const namaIbuKandung = (formData.get("namaIbuKandung") as string)?.trim() || null;
  const educationLevelId = (formData.get("educationLevelId") as string) || null;
  const ptkpStatusCode = (formData.get("ptkpStatusCode") as string) || null;

  if (!employeeNumber || !fullLegalName || !hireDate || !employmentStatus || !positionId) {
    return "Nomor karyawan, nama lengkap, tanggal bergabung, status kepegawaian, dan posisi wajib diisi.";
  }
  if (!educationLevelId) return "Pendidikan Terakhir wajib dipilih.";
  if (!ptkpStatusCode) return "PTKP Pajak wajib dipilih.";
  if (noKk) {
    const noKkError = validateNoKk(noKk);
    if (noKkError) return noKkError;
  }

  // Prevent duplicate Employees (DEC-013/WF-14 acceptance criteria).
  const existingEmployee = await prisma.employee.findUnique({ where: { employeeNumber } });
  if (existingEmployee) return `Nomor karyawan ${employeeNumber} sudah digunakan.`;

  if (!request.jobId) {
    return "Jabatan pada permintaan ini belum ditentukan oleh HR Manager saat persetujuan.";
  }
  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return "Posisi tidak ditemukan.";
  if (position.jobId !== request.jobId || position.orgUnitId !== request.departmentId) {
    return "Posisi yang dipilih tidak sesuai dengan Jabatan/Department pada permintaan ini.";
  }
  // Prevent assigning an already-occupied Position (DM-07 / acceptance criteria).
  if (await isPositionOccupiedByPrimary(positionId)) {
    return "Posisi ini sudah memiliki pemegang Utama aktif — pilih posisi lain.";
  }

  const hireDateObj = new Date(hireDate);

  // WF-14: "create Employee, initial Primary Position Assignment and
  // RecruitmentRequestFulfillment in one transaction."
  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        employeeNumber,
        fullLegalName,
        gender: gender ? (gender as Gender) : null,
        workEmail,
        mobileNumber,
        hireDate: hireDateObj,
        employmentStatus,
        noKk,
        namaIbuKandung,
        educationLevelId,
        ptkpStatusCode,
        currentPositionId: positionId,
      },
    });

    const assignment = await tx.assignment.create({
      data: {
        employeeId: employee.id,
        positionId,
        assignmentType: "PRIMARY",
        primaryAssignmentFlag: true,
        status: "ACTIVE",
        effectiveFrom: hireDateObj,
      },
    });

    const fulfillment = await tx.recruitmentRequestFulfillment.create({
      data: {
        recruitmentRequestId: requestId,
        employeeId: employee.id,
        assignmentId: assignment.id,
        linkedByAccountId: session.user.id,
      },
    });

    const newFilledCount = request.fulfillments.length + 1;
    const newStatus = nextStatusAfterFulfillment(request.requestedHeadcount, newFilledCount);
    await tx.recruitmentRequest.update({ where: { id: requestId }, data: { status: newStatus } });

    if (position.positionStatus === "VACANT" || position.positionStatus === "FILLED") {
      await tx.position.update({ where: { id: positionId }, data: { positionStatus: "FILLED" } });
    }

    // LIF-03: same automatic Onboarding Case as direct Employee creation —
    // this path must not skip it just because the Employee came from a
    // Recruitment Request.
    const onbYear = companyYear(hireDateObj);
    const onbSeq = await nextSequence(`ONB-${onbYear}`, tx);
    await tx.onboardingCase.create({
      data: {
        caseNumber: formatOnboardingCaseNumber(onbSeq, onbYear),
        employeeId: employee.id,
        plannedStartDate: hireDateObj,
      },
    });

    return { employee, assignment, fulfillment, newStatus };
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Employee",
    recordId: result.employee.id,
    reason: `Created from recruitment request ${request.requestNumber} (now ${result.newStatus})`,
  });
  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "RecruitmentRequestFulfillment",
    recordId: result.fulfillment.id,
    reason: `Linked employee ${employeeNumber} and assignment ${result.assignment.id} to request ${request.requestNumber}`,
  });

  // Onboarding-compulsory course auto-assign — unlike the direct-entry path,
  // currentPositionId/the Assignment are already set here, so every target
  // type (including Department/Job/Primary Position) can resolve.
  await applyOnboardingMandatoryTrainingForEmployee(result.employee.id, session.user.id);

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/onboarding");
  redirect(`/employees/${result.employee.id}`);
}
