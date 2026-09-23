"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

import { PRESENT_OVERRIDE_SENTINEL } from "./present-override";

const VALID_SHIFT_TYPES: ShiftAssignmentType[] = ["SHIFT_1", "SHIFT_2", "SHIFT_3", "NON_SHIFT"];

// Shared by Opsi A (classifying a flagged day) and Opsi B (overriding an
// already-resolved one) — same upsert either way, always stamped with who
// and when, same "in-place overwrite with mandatory identity/timestamp"
// convention as AbsenceRequest's HR override.
export async function classifyAttendanceDay(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!isHrAdmin(session)) return "Anda tidak memiliki akses.";

  const employeeId = (formData.get("employeeId") as string)?.trim();
  const dateRaw = (formData.get("date") as string)?.trim();
  const absenceTypeCodeRaw = (formData.get("absenceTypeCode") as string)?.trim();
  const shiftTypeRaw = (formData.get("shiftType") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;

  if (!employeeId || !dateRaw) return "Karyawan dan tanggal wajib diisi.";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateRaw);
  if (!match) return "Tanggal tidak valid.";
  const [, y, m, d] = match;
  // UTC-midnight "date-only" value — must match DailyAttendanceRecord.
  // attendanceDate's own convention (see attendance-reconciliation.ts's
  // startOfDay) or this upsert silently targets the wrong row/creates a
  // duplicate one, depending on the server process's timezone.
  const attendanceDate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

  const presentOverride = absenceTypeCodeRaw === PRESENT_OVERRIDE_SENTINEL;
  const absenceTypeCode = absenceTypeCodeRaw && !presentOverride ? absenceTypeCodeRaw : null;
  const shiftType = shiftTypeRaw && VALID_SHIFT_TYPES.includes(shiftTypeRaw as ShiftAssignmentType) ? (shiftTypeRaw as ShiftAssignmentType) : null;
  if (!absenceTypeCode && !shiftType && !presentOverride) return "Pilih kode absensi atau shift.";
  if (presentOverride && !shiftType) return "Pilih shift untuk menandai Masuk.";

  if (absenceTypeCode) {
    const type = await prisma.absenceTypeConfig.findUnique({ where: { code: absenceTypeCode } });
    if (!type) return "Kode absensi tidak ditemukan.";
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  await prisma.dailyAttendanceRecord.upsert({
    where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
    update: {
      absenceTypeCode,
      shiftType,
      presentOverride,
      classificationNote: note,
      classifiedAt: new Date(),
      classifiedByAccountId: session.user.id,
    },
    create: {
      employeeId,
      attendanceDate,
      absenceTypeCode,
      shiftType,
      presentOverride,
      classificationNote: note,
      classifiedAt: new Date(),
      classifiedByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "DailyAttendanceRecord",
    recordId: `${employeeId}:${dateRaw}`,
    reason: `Diklasifikasikan sebagai ${presentOverride ? "Masuk (Lupa Absen)" : (absenceTypeCode ?? shiftType)} untuk ${employee.fullLegalName} (${dateRaw})${note ? ` — ${note}` : ""}`,
  });

  revalidatePath("/attendance/reconciliation");
  revalidatePath("/attendance/reconciliation/grid");
}
