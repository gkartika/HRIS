"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAssignments } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { AssignmentType } from "@/generated/prisma/enums";

// If a position's stored status is just VACANT/FILLED (not an admin-set
// PLANNED/FROZEN/CLOSED override), keep it in sync with whether it actually
// has an active Assignment right now. The org chart itself always computes
// live occupancy from Assignment rows — this is only so the plain admin list
// view (src/app/(app)/admin/positions) shows a status that isn't obviously stale.
async function syncPositionStatus(positionId: string) {
  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position || (position.positionStatus !== "VACANT" && position.positionStatus !== "FILLED")) {
    return;
  }
  const activeCount = await prisma.assignment.count({
    where: { positionId, status: "ACTIVE" },
  });
  await prisma.position.update({
    where: { id: positionId },
    data: { positionStatus: activeCount > 0 ? "FILLED" : "VACANT" },
  });
}

export async function addAssignment(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return "Anda tidak memiliki akses.";

  const positionId = formData.get("positionId") as string;
  const assignmentType = formData.get("assignmentType") as AssignmentType;
  const effectiveFrom = formData.get("effectiveFrom") as string;

  if (!positionId || !assignmentType || !effectiveFrom) {
    return "Posisi, jenis penempatan, dan tanggal mulai wajib diisi.";
  }
  if (assignmentType === "PRIMARY") {
    return "Gunakan 'Pindahkan ke Posisi Baru' untuk mengubah Penempatan Utama.";
  }

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return "Posisi tidak ditemukan.";

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

export async function movePrimaryAssignment(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return "Anda tidak memiliki akses.";

  const positionId = formData.get("positionId") as string;
  const effectiveFrom = formData.get("effectiveFrom") as string;

  if (!positionId || !effectiveFrom) return "Posisi baru dan tanggal efektif wajib diisi.";

  const newPosition = await prisma.position.findUnique({ where: { id: positionId } });
  if (!newPosition) return "Posisi tidak ditemukan.";

  const effectiveDate = new Date(effectiveFrom);

  const currentPrimary = await prisma.assignment.findFirst({
    where: { employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
  });

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

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Assignment",
    recordId: newAssignment.id,
    reason: `Movement: primary position changed to ${newPosition.positionCode} effective ${effectiveFrom}`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/team");
}

export async function endAssignment(
  assignmentId: string,
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAssignments(session)) return "Anda tidak memiliki akses.";

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
