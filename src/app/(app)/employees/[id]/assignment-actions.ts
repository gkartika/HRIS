"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAssignments } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { isPositionOccupiedByPrimary, syncPositionStatus } from "@/lib/position-occupancy";
import { applyOnboardingTrainingIfFirstPlacement } from "@/lib/onboarding-placement";
import { shouldScheduleMove } from "@/lib/placement-timing";
import { companyToday } from "@/lib/company-time";
import type { AssignmentType } from "@/generated/prisma/enums";

export async function addAssignment(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return t("common.forbidden");

  const positionId = formData.get("positionId") as string;
  const assignmentType = formData.get("assignmentType") as AssignmentType;
  const effectiveFrom = formData.get("effectiveFrom") as string;

  if (!positionId || !assignmentType || !effectiveFrom) {
    return "Posisi, jenis penempatan, dan tanggal mulai wajib diisi.";
  }
  if (Number.isNaN(Date.parse(effectiveFrom))) return "Tanggal mulai tidak valid.";
  if (assignmentType === "PRIMARY") {
    return "Gunakan 'Pindahkan ke Posisi Baru' untuk mengubah Penempatan Utama.";
  }
  // Plt. (ACTING) is no longer offered from this form per direct user
  // request — only Tambahan/Sementara. Enforced here too, not just hidden
  // from the dropdown, in case of a stale client.
  if (assignmentType !== "ADDITIONAL" && assignmentType !== "TEMPORARY") {
    return "Jenis penempatan tidak valid.";
  }

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return "Posisi tidak ditemukan.";

  // Extra (Additional/Temporary) seats must stay in the employee's own
  // department — cross-department placement belongs to a real Mutasi via
  // "Pindahkan ke Posisi Baru" instead.
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPosition: { select: { orgUnitId: true } } },
  });
  if (!employee?.currentPosition) {
    return "Karyawan ini belum memiliki Penempatan Utama — tidak dapat menambahkan penempatan tambahan.";
  }
  if (position.orgUnitId !== employee.currentPosition.orgUnitId) {
    return "Penempatan tambahan harus berada di departemen yang sama dengan Penempatan Utama karyawan.";
  }

  const assignment = await prisma.assignment.create({
    data: {
      employeeId,
      positionId,
      assignmentType,
      primaryAssignmentFlag: false,
      status: "ACTIVE",
      effectiveFrom: new Date(effectiveFrom),
    },
  });

  await syncPositionStatus(positionId);

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Assignment",
    recordId: assignment.id,
    reason: `Added ${assignmentType} assignment to position ${position.positionCode}`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/organization");
  revalidatePath("/team");
}

// HR can correct a placement's Berlaku Sejak later, e.g. one that was filled in
// automatically at import (hire date / import day) once the real date is known.
// Only the start date changes; position, type and status stay as they are.
export async function updateAssignmentStartDate(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return t("common.forbidden");

  const assignmentId = formData.get("assignmentId") as string;
  const effectiveFrom = ((formData.get("effectiveFrom") as string) ?? "").trim();
  if (!assignmentId || !effectiveFrom) return "Pilih penempatan dan isi tanggal mulai.";
  if (Number.isNaN(Date.parse(effectiveFrom))) return "Tanggal mulai tidak valid.";

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, employeeId },
    include: { position: { select: { positionCode: true } } },
  });
  if (!assignment) return "Penempatan tidak ditemukan.";

  const newDate = new Date(effectiveFrom);
  if (assignment.effectiveTo && newDate > assignment.effectiveTo) {
    return "Tanggal mulai tidak boleh setelah tanggal berakhir penempatan ini.";
  }

  await prisma.assignment.update({ where: { id: assignmentId }, data: { effectiveFrom: newDate } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Assignment",
    recordId: assignmentId,
    reason: `Changed Berlaku Sejak of ${assignment.position.positionCode} from ${assignment.effectiveFrom ? assignment.effectiveFrom.toISOString().slice(0, 10) : "-"} to ${effectiveFrom}`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/organization");
  revalidatePath("/team");
}

export async function movePrimaryAssignment(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return t("common.forbidden");

  const positionId = formData.get("positionId") as string;
  const effectiveFrom = formData.get("effectiveFrom") as string;

  if (!positionId || !effectiveFrom) return "Posisi baru dan tanggal efektif wajib diisi.";

  const newPosition = await prisma.position.findUnique({ where: { id: positionId } });
  if (!newPosition) return "Posisi tidak ditemukan.";

  // DM-07: a Position can't have two different Employees holding an active
  // Primary Assignment at once.
  if (await isPositionOccupiedByPrimary(positionId, employeeId)) {
    return "Posisi ini sudah memiliki pemegang Utama aktif — pilih posisi lain.";
  }

  const effectiveDate = new Date(effectiveFrom);

  const currentPrimary = await prisma.assignment.findFirst({
    where: { employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
  });

  const pendingMove = await prisma.assignment.findFirst({
    where: { employeeId, assignmentType: "PRIMARY", status: "SCHEDULED" },
    include: { position: true },
  });
  if (pendingMove) {
    return `Karyawan ini sudah memiliki perpindahan terjadwal ke ${pendingMove.position.positionCode}. Batalkan jadwal itu dahulu sebelum memindahkan lagi.`;
  }

  // A move dated in the future keeps the current placement fully in force
  // until that date (decided 2026-10-08): its end date is set, the new
  // placement is stored as SCHEDULED, and the nightly job completes the
  // switch. Authority and the org chart follow the dates, so nothing is lost
  // in between.
  if (currentPrimary && shouldScheduleMove({ hasCurrentPrimary: true, effectiveDate, today: companyToday() })) {
    const scheduled = await prisma.$transaction(async (tx) => {
      await tx.assignment.update({ where: { id: currentPrimary.id }, data: { effectiveTo: effectiveDate } });
      return tx.assignment.create({
        data: {
          employeeId,
          positionId,
          assignmentType: "PRIMARY",
          primaryAssignmentFlag: true,
          status: "SCHEDULED",
          effectiveFrom: effectiveDate,
        },
      });
    });
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "Assignment",
      recordId: scheduled.id,
      reason: `Movement scheduled: primary position changes to ${newPosition.positionCode} effective ${effectiveFrom}`,
    });
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/organization");
    return undefined;
  }

  if (currentPrimary) {
    await prisma.assignment.update({
      where: { id: currentPrimary.id },
      data: { status: "ENDED", effectiveTo: effectiveDate },
    });
    await syncPositionStatus(currentPrimary.positionId);
  }

  const newAssignment = await prisma.assignment.create({
    data: {
      employeeId,
      positionId,
      assignmentType: "PRIMARY",
      primaryAssignmentFlag: true,
      status: "ACTIVE",
      effectiveFrom: effectiveDate,
    },
  });

  await prisma.employee.update({
    where: { id: employeeId },
    data: { currentPositionId: positionId },
  });
  await syncPositionStatus(positionId);

  // First placement of a new hire: now that a position exists, give them the
  // onboarding courses that depend on it (decided 2026-10-08).
  const onboardingCoursesAssigned = await applyOnboardingTrainingIfFirstPlacement(
    employeeId,
    !!currentPrimary,
    session.user.id
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Assignment",
    recordId: newAssignment.id,
    reason: `Movement: primary position changed to ${newPosition.positionCode} effective ${effectiveFrom}${onboardingCoursesAssigned > 0 ? ` (${onboardingCoursesAssigned} onboarding course(s) assigned)` : ""}`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/team");
  revalidatePath("/onboarding");
}

// A scheduled move that has not taken effect yet can be called off: the old
// placement goes back to open-ended and the scheduled one is closed without
// ever having been in force (history is kept, never deleted).
export async function cancelScheduledPlacement(
  assignmentId: string,
  employeeId: string,
  _prevState: string | undefined,
  _formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return t("common.forbidden");

  const scheduled = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { position: true } });
  if (!scheduled || scheduled.employeeId !== employeeId) return "Penempatan tidak ditemukan.";
  if (scheduled.status !== "SCHEDULED") return "Perpindahan ini sudah berlaku atau sudah dibatalkan.";

  await prisma.$transaction(async (tx) => {
    // The placement it was going to replace: still ACTIVE, with its end date
    // set to this move's start date.
    const replaced = await tx.assignment.findFirst({
      where: {
        employeeId,
        assignmentType: "PRIMARY",
        status: "ACTIVE",
        ...(scheduled.effectiveFrom ? { effectiveTo: scheduled.effectiveFrom } : {}),
      },
    });
    if (replaced) await tx.assignment.update({ where: { id: replaced.id }, data: { effectiveTo: null } });
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { status: "ENDED", effectiveTo: scheduled.effectiveFrom },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Assignment",
    recordId: assignmentId,
    reason: `Scheduled move to ${scheduled.position.positionCode} cancelled before it took effect`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/organization");
}

export async function endAssignment(
  assignmentId: string,
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return t("common.forbidden");

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return "Penempatan tidak ditemukan.";
  if (assignment.assignmentType === "PRIMARY") {
    return "Penempatan Utama tidak dapat diakhiri langsung — gunakan Pindahkan ke Posisi Baru.";
  }

  const effectiveToRaw = formData.get("effectiveTo") as string;
  const effectiveTo = effectiveToRaw ? new Date(effectiveToRaw) : new Date();

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: "ENDED", effectiveTo },
  });
  await syncPositionStatus(assignment.positionId);

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Assignment",
    recordId: assignmentId,
    reason: "Assignment ended",
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/organization");
  revalidatePath("/team");
}

// Lets HR Admin fix an employee's reporting line straight from the Employee
// page, instead of navigating to Admin > Organisasi > Posisi to edit the
// Position record directly. This changes the underlying Position's
// reportsToPositionId — since Position:Employee is effectively 1:1 for a
// filled seat, that's equivalent to "who this employee reports to."
export async function updatePositionReportsTo(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return t("common.forbidden");

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee?.currentPositionId) {
    return "Karyawan ini belum memiliki Penempatan Utama.";
  }

  const reportsToPositionId = (formData.get("reportsToPositionId") as string) || null;
  if (reportsToPositionId === employee.currentPositionId) {
    return "Posisi tidak dapat melapor ke dirinya sendiri.";
  }

  await prisma.position.update({
    where: { id: employee.currentPositionId },
    data: { reportsToPositionId },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Position",
    recordId: employee.currentPositionId,
    reason: `Changed reporting line via Employee page (${employeeId})`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/organization");
  revalidatePath("/team");
}
