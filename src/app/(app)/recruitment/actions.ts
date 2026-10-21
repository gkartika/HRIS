"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { authorizeDeptHeadDecision, authorizeHrManagerDecision } from "@/lib/approval-authority";
import { companyYear, companyToday } from "@/lib/company-time";
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
  isHrAdmin,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions, listDeptHeadApprovers } from "@/lib/dept-head";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary } from "@/lib/position-occupancy";
import {
  canRequestAcceptFulfillment,
  canCancelRequestStatus,
  computeFulfillmentCounts,
  nextStatusAfterFulfillment,
  formatRequestNumber,
  initialRecruitmentStatus,
  canCloseRequestStatus,
  canResubmitRequestStatus,
  statusAfterResubmit,
} from "@/lib/recruitment";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { HELD_MESSAGE } from "@/lib/recruitment-request-changes";
import { createOnboardingCase } from "@/lib/onboarding-create";
import { allocateEmployeeNumber } from "@/lib/employee-number-allocate";
import { applyOnboardingMandatoryTrainingForEmployee } from "@/lib/mandatory-training";
import { closeRemainingCandidates, markCandidateHired, validateCandidateForHire } from "@/lib/recruitment-flow";
import { validateNoKk } from "@/lib/validation/employee-fields";
import type {
  RecruitmentReasonCode,
  ShiftCode,
  EducationRequirementCode,
  WorkExperienceBand,
  AgeBand,
  Gender,
  EmploymentStatus,
} from "@/generated/prisma/enums";

// A request that waits for the Department Head of a department nobody heads would never move on.
async function noApproverMessage(departmentId: string): Promise<string | null> {
  if ((await listDeptHeadApprovers([departmentId])).get(departmentId)?.length) return null;
  const unit = await prisma.orgUnit.findUnique({ where: { id: departmentId }, select: { unitName: true } });
  return `Departemen ${unit?.unitName ?? ""} belum punya Kepala Departemen (posisi level 3B yang terisi), jadi permintaan ini tidak bisa disetujui. Pilih departemen yang benar, atau minta Admin SDM mengisi posisi Kepala Departemen dulu.`;
}

// The fields of FR-HC-01-01 that the requester fills in. Shared by the first
// submission and by resubmitting a returned request, so both validate the same.
type RequestFields = {
  requestDate: string;
  reasonCode: RecruitmentReasonCode;
  departmentId: string;
  requestedJobText: string;
  shiftCode: ShiftCode;
  requestedHeadcount: number;
  jobDescriptionSnapshot: string;
  educationRequirementCode: EducationRequirementCode;
  workExperienceBand: WorkExperienceBand;
  ageBand: AgeBand;
  genderRequirement: Gender | null;
  specialCriteria: string | null;
};

function readRequestFields(formData: FormData): { fields: RequestFields } | { error: string } {
  const requestDate = formData.get("requestDate") as string;
  const reasonCode = formData.get("reasonCode") as RecruitmentReasonCode;
  const departmentId = formData.get("departmentId") as string;
  const requestedJobText = ((formData.get("requestedJobText") as string) ?? "").trim().replace(/\s+/g, " ");
  const shiftCode = formData.get("shiftCode") as ShiftCode;
  const requestedHeadcount = Number(formData.get("requestedHeadcount"));
  const jobDescriptionSnapshot = (formData.get("jobDescriptionSnapshot") as string)?.trim();
  const educationRequirementCode = formData.get("educationRequirementCode") as EducationRequirementCode;
  const workExperienceBand = formData.get("workExperienceBand") as WorkExperienceBand;
  const ageBand = formData.get("ageBand") as AgeBand;
  const genderRequirement = (formData.get("genderRequirement") as string) || null;
  const specialCriteria = (formData.get("specialCriteria") as string)?.trim() || null;

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
    !requestedJobText
  ) {
    return { error: "Semua field wajib (kecuali Jenis Kelamin dan Kriteria Khusus) harus diisi." };
  }
  if (requestedJobText.length > 120) return { error: "Nama jabatan maksimal 120 huruf." };
  if (requestedHeadcount < 1) return { error: "Jumlah harus minimal 1." };
  if (Number.isNaN(Date.parse(requestDate))) return { error: "Tanggal permintaan tidak valid." };

  return {
    fields: {
      requestDate,
      reasonCode,
      departmentId,
      requestedJobText,
      shiftCode,
      requestedHeadcount,
      jobDescriptionSnapshot,
      educationRequirementCode,
      workExperienceBand,
      ageBand,
      genderRequirement: genderRequirement ? (genderRequirement as Gender) : null,
      specialCriteria,
    },
  };
}

export async function submitRecruitmentRequest(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canSubmitRecruitmentRequest(session)) return t("common.forbidden");

  const parsed = readRequestFields(formData);
  if ("error" in parsed) return parsed.error;
  const f = parsed.fields;

  // Only Admin SDM may file on someone else's behalf. Everyone else is always
  // the requester: a requester id in the form is ignored, so nobody can name
  // a Dept Head as requester to skip the Dept Head stage.
  const requesterEmployeeId =
    (isHrAdmin(session) ? (formData.get("requesterEmployeeId") as string) : null) || session.user.employeeId;
  if (!requesterEmployeeId) return "Pilih karyawan pengaju terlebih dahulu.";

  const requester = await prisma.employee.findUnique({ where: { id: requesterEmployeeId } });
  if (!requester) return "Karyawan pengaju tidak ditemukan.";

  // The Dept Head stage is skipped only when the person actually submitting is
  // themself the Dept Head of this department (nobody else to approve). When
  // Admin SDM files for a Dept Head, the request still goes to that Dept Head.
  const submitterDeptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, f.departmentId);
  const initialStatus = initialRecruitmentStatus(submitterDeptHeadPositions.length > 0);
  if (initialStatus === "PENDING_DEPT_HEAD") {
    const problem = await noApproverMessage(f.departmentId);
    if (problem) return problem;
  }

  const year = companyYear(new Date(f.requestDate));
  const seq = await nextSequence(`REQ-${year}`);
  const requestNumber = formatRequestNumber(seq, year);
  const now = new Date();

  const request = await prisma.recruitmentRequest.create({
    data: {
      requestNumber,
      requestDate: new Date(f.requestDate),
      reasonCode: f.reasonCode,
      departmentId: f.departmentId,
      requestedJobText: f.requestedJobText,
      shiftCode: f.shiftCode,
      requestedHeadcount: f.requestedHeadcount,
      jobDescriptionSnapshot: f.jobDescriptionSnapshot,
      educationRequirementCode: f.educationRequirementCode,
      workExperienceBand: f.workExperienceBand,
      ageBand: f.ageBand,
      genderRequirement: f.genderRequirement,
      specialCriteria: f.specialCriteria,
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
    reason: `Submitted recruitment request ${requestNumber} for ${f.requestedHeadcount} position(s)`,
  });

  revalidatePath("/recruitment");
  redirect(`/recruitment/${request.id}`);
}

// A returned request (Kembalikan) is edited by its requester (or Admin SDM)
// and sent again. It goes back to the stage that returned it; the earlier
// return note is cleared from the request (it stays in the audit log) so it
// is not mistaken for a decision on the corrected version.
export async function resubmitRecruitmentRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";

  const isRequester = !!session.user.employeeId && session.user.employeeId === request.requesterEmployeeId;
  if (!isRequester && !isHrAdmin(session)) return t("common.forbidden");
  if (!canResubmitRequestStatus(request.status)) {
    return "Hanya permintaan yang dikembalikan yang dapat diajukan ulang.";
  }

  const parsed = readRequestFields(formData);
  if ("error" in parsed) return parsed.error;
  const f = parsed.fields;

  const returnedByHrManager = !!request.approvedByAccountId;
  const departmentChanged = f.departmentId !== request.departmentId;
  const submitterDeptHeadPositions = await getActiveDeptHeadPositions(session.user.employeeId, f.departmentId);
  const nextStatus = statusAfterResubmit({
    returnedByHrManager,
    departmentChanged,
    submitterIsDeptHead: submitterDeptHeadPositions.length > 0,
  });
  if (nextStatus === "PENDING_DEPT_HEAD") {
    const problem = await noApproverMessage(f.departmentId);
    if (problem) return problem;
  }
  const returnNote = returnedByHrManager ? request.decisionNote : request.deptHeadDecisionNote;

  const clearHrManagerStage = {
    approvedAt: null,
    approvedByAccountId: null,
    decisionPositionId: null,
    decisionNote: null,
  };
  const clearDeptHeadStage = {
    deptHeadDecisionAt: null,
    deptHeadDecisionByAccountId: null,
    deptHeadDecisionPositionId: null,
    deptHeadDecisionNote: null,
  };

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: {
      requestDate: new Date(f.requestDate),
      reasonCode: f.reasonCode,
      departmentId: f.departmentId,
      requestedJobText: f.requestedJobText,
      shiftCode: f.shiftCode,
      requestedHeadcount: f.requestedHeadcount,
      jobDescriptionSnapshot: f.jobDescriptionSnapshot,
      educationRequirementCode: f.educationRequirementCode,
      workExperienceBand: f.workExperienceBand,
      ageBand: f.ageBand,
      genderRequirement: f.genderRequirement,
      specialCriteria: f.specialCriteria,
      status: nextStatus,
      // Whoever sent it back no longer has a pending decision on record.
      ...(returnedByHrManager ? clearHrManagerStage : clearDeptHeadStage),
      // Restarting from the Dept Head means both earlier decisions are void.
      ...(nextStatus === "PENDING_DEPT_HEAD" ? { ...clearHrManagerStage, ...clearDeptHeadStage } : {}),
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: `Resubmitted ${request.requestNumber} after return by ${returnedByHrManager ? "HR Manager" : "Dept Head"} (now ${nextStatus}). Return note: ${returnNote ?? "-"}`,
  });

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
  redirect(`/recruitment/${requestId}`);
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

  // The standard Jabatan is set by Admin SDM / Admin Rekrutmen before this step (the requester only types a
  // name), since hiring needs it to filter the seats. Not required for Reject/Return.
  const jobId = request.jobId;
  if (decision === "APPROVED" && !jobId) {
    return "Menunggu Admin SDM / Admin Rekrutmen menetapkan jabatan standar sebelum permintaan ini bisa disetujui.";
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

// "Tutup": hiring stops with fewer people than requested. Only a partly filled
// request can be closed (one with no hires is cancelled instead); the hires
// already made stay linked. Admin SDM or the active HR Manager may close it.
export async function closeRecruitmentRequest(
  requestId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (!isHrAdmin(session) && !isHrManager(hrManagerPositions.map((p) => p.positionId))) {
    return t("common.forbidden");
  }

  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canCloseRequestStatus(request.status)) {
    return "Hanya permintaan berstatus Terisi Sebagian yang dapat ditutup. Permintaan tanpa karyawan dibatalkan saja.";
  }

  const closeReason = (formData.get("closeReason") as string)?.trim();
  if (!closeReason) return "Alasan penutupan wajib diisi.";

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: { status: "CLOSED", closedAt: new Date(), closedByAccountId: session.user.id, closeReason },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: `Closed ${request.requestNumber} (was ${request.status}): ${closeReason}`,
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
  if (!canCreateEmployeeFromRequest(session)) return t("common.forbidden");

  const request = await prisma.recruitmentRequest.findUnique({
    where: { id: requestId },
    include: { fulfillments: true },
  });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.heldAt) return HELD_MESSAGE;
  if (!canRequestAcceptFulfillment(request.status)) {
    return "Permintaan ini belum dapat diproses menjadi karyawan (status saat ini belum Disetujui).";
  }
  const counts = computeFulfillmentCounts(request.requestedHeadcount, request.fulfillments.length);
  if (counts.isFull) return "Permintaan ini sudah terisi penuh.";

  const fullLegalName = (formData.get("fullLegalName") as string)?.trim();
  const gender = (formData.get("gender") as string) || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const hireDate = formData.get("hireDate") as string;
  const employmentStatus = formData.get("employmentStatus") as EmploymentStatus;
  const positionId = formData.get("positionId") as string;
  const noKk = (formData.get("noKk") as string)?.trim() || null;
  const namaIbuKandung = (formData.get("namaIbuKandung") as string)?.trim() || null;
  const educationLevelId = (formData.get("educationLevelId") as string) || null;
  const ptkpStatusCode = (formData.get("ptkpStatusCode") as string) || null;
  // Set when the employee is created from an applicant who accepted the offering letter.
  const candidateId = (formData.get("candidateId") as string) || null;

  if (!fullLegalName || !employmentStatus || !positionId) {
    return "Nama lengkap, tanggal bergabung, status kepegawaian, dan posisi wajib diisi.";
  }
  // Identitas/Pendidikan/PTKP are optional here too — completed later from
  // the employee's own detail page.
  if (noKk) {
    const noKkError = validateNoKk(noKk);
    if (noKkError) return noKkError;
  }

  const candidate = candidateId
    ? await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId }, select: { email: true } })
    : null;
  if (candidateId) {
    const problem = await validateCandidateForHire(candidateId, requestId);
    if (problem) return problem;
  }

  // Prevent duplicate Employees (DEC-013/WF-14 acceptance criteria).

  if (!request.jobId) {
    return "Jabatan pada permintaan ini belum ditetapkan oleh Admin SDM / Admin Rekrutmen.";
  }
  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return "Posisi tidak ditemukan.";
  if (position.archived) return "Posisi ini sudah diarsipkan — pilih posisi lain.";
  // A seat belongs to the request's Department when it sits in that Department
  // itself or anywhere below it (Section, Group, Team) — decided 2026-10-08;
  // most seats sit under a Section or Group, not directly under the Department.
  const orgUnits = await prisma.orgUnit.findMany({
    select: { id: true, unitName: true, unitType: true, parentUnitId: true },
  });
  const seatDepartmentId = buildOrgUnitTree(orgUnits).departmentOf(position.orgUnitId)?.id;
  if (position.jobId !== request.jobId || seatDepartmentId !== request.departmentId) {
    return "Posisi yang dipilih tidak sesuai dengan Jabatan/Department pada permintaan ini.";
  }
  // Prevent assigning an already-occupied Position (DM-07 / acceptance criteria).
  if (await isPositionOccupiedByPrimary(positionId)) {
    return "Posisi ini sudah memiliki pemegang Utama aktif — pilih posisi lain.";
  }

  // Tanggal bergabung is optional; without one the placement and onboarding
  // start today.
  if (hireDate && Number.isNaN(Date.parse(hireDate))) return "Tanggal bergabung tidak valid.";
  const hireDateObj = hireDate ? new Date(hireDate) : null;
  const startDate = hireDateObj ?? companyToday();

  // WF-14: "create Employee, initial Primary Position Assignment and
  // RecruitmentRequestFulfillment in one transaction."
  const result = await prisma.$transaction(async (tx) => {
    const employeeNumber = await allocateEmployeeNumber(tx);
    const employee = await tx.employee.create({
      data: {
        employeeNumber,
        fullLegalName,
        gender: gender ? (gender as Gender) : null,
        mobileNumber,
        // The applicant's email becomes the address the login invitation is sent to.
        personalEmail: candidate?.email ?? null,
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
        effectiveFrom: startDate,
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

    // The applicant is done; if the request is now full everyone else still in the pipeline is closed.
    if (candidateId) {
      await markCandidateHired(tx, { candidateId, employeeId: employee.id, requestId, requestIsFull: newStatus === "FILLED" });
    } else if (newStatus === "FILLED") {
      await closeRemainingCandidates(tx, requestId, null);
    }

    if (position.positionStatus === "VACANT" || position.positionStatus === "FILLED") {
      await tx.position.update({ where: { id: positionId }, data: { positionStatus: "FILLED" } });
    }

    // LIF-03: same automatic Onboarding Case as direct Employee creation —
    // this path must not skip it just because the Employee came from a
    // Recruitment Request.
    await createOnboardingCase(employee.id, startDate, tx);

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
    reason: `Linked employee ${result.employee.employeeNumber} and assignment ${result.assignment.id} to request ${request.requestNumber}`,
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
  revalidatePath("/recruitment/applicants");
  // Only Admin SDM may open employee pages; Admin Rekrutmen goes back to the request.
  redirect(isHrAdmin(session) ? `/employees/${result.employee.id}` : `/recruitment/${requestId}`);
}
