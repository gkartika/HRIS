"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canSubmitRecruitmentRequest, canApproveRecruitmentRequest, canCreateEmployeeFromRequest } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary } from "@/lib/position-occupancy";
import {
  canRequestAcceptFulfillment,
  computeFulfillmentCounts,
  nextStatusAfterFulfillment,
  formatRequestNumber,
} from "@/lib/recruitment";
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
  const jobId = formData.get("jobId") as string;
  const requestedPositionId = (formData.get("requestedPositionId") as string) || null;
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
    !jobId ||
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

  const year = new Date(requestDate).getFullYear();
  const countThisYear = await prisma.recruitmentRequest.count({
    where: { requestNumber: { startsWith: `REQ-${year}-` } },
  });
  const requestNumber = formatRequestNumber(countThisYear + 1, year);
  const now = new Date();

  const request = await prisma.recruitmentRequest.create({
    data: {
      requestNumber,
      requestDate: new Date(requestDate),
      reasonCode,
      departmentId,
      jobId,
      requestedPositionId,
      shiftCode,
      requestedHeadcount,
      jobDescriptionSnapshot,
      educationRequirementCode,
      workExperienceBand,
      ageBand,
      genderRequirement: genderRequirement ? (genderRequirement as Gender) : null,
      requestedJobLevel,
      specialCriteria,
      status: "SUBMITTED",
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
  if (!canApproveRecruitmentRequest(session)) throw new Error("Access denied");

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

export async function decideRecruitmentRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canApproveRecruitmentRequest(session)) return "Anda tidak memiliki akses.";

  const request = await prisma.recruitmentRequest.findUnique({ where: { id: requestId } });
  if (!request) return "Permintaan tidak ditemukan.";
  if (request.status !== "SUBMITTED" && request.status !== "UNDER_REVIEW") {
    return "Permintaan ini sudah diproses.";
  }

  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if ((decision === "REJECTED" || decision === "RETURNED") && !decisionNote) {
    return "Catatan keputusan wajib diisi untuk Tolak/Kembalikan.";
  }

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: {
      status: decision === "APPROVED" ? "APPROVED" : decision,
      approvedAt: decision === "APPROVED" ? new Date() : null,
      approvedByAccountId: session.user.id,
      decisionNote,
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
  const preferredName = (formData.get("preferredName") as string)?.trim() || null;
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
        preferredName,
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

  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
  revalidatePath("/employees");
  revalidatePath("/organization");
  redirect(`/employees/${result.employee.id}`);
}
