"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceAssignment } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { machineNameProblem, normalizeName } from "@/lib/name-match";

// "Nama di mesin absensi": set (or clear) the name the fingerprint machine writes for one employee. Admin SDM only. An empty
// name, or the employee's own full name, clears it: the import then matches the full name, as for everyone else.
export async function setMachineName(employeeId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceAssignment(session)) return t("common.forbidden");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, fullLegalName: true, fingerprintMachineName: true } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const typed = String(formData.get("machineName") ?? "").replace(/\s+/g, " ").trim();
  if (!typed) return "Isi nama seperti tertulis di mesin, atau pilih \"Pakai nama utama lagi\".";
  if (normalizeName(typed) === normalizeName(employee.fullLegalName)) return "Nama ini sama dengan nama utama di SAPA, jadi tidak perlu diisi. Pilih \"Pakai nama utama lagi\" bila sebelumnya ada nama khusus.";

  const [employees, employeeAliases, assignmentAliases] = await Promise.all([
    prisma.employee.findMany({ where: { activeFlag: true }, select: { id: true, fullLegalName: true } }),
    prisma.employee.findMany({ where: { activeFlag: true, fingerprintMachineName: { not: null } }, select: { id: true, fingerprintMachineName: true } }),
    prisma.attendanceAssignment.findMany({ where: { effectiveTo: null, fingerprintDeviceUserId: { not: null } }, select: { employeeId: true, fingerprintDeviceUserId: true } }),
  ]);
  const problem = machineNameProblem(typed, employeeId, employees, [
    ...employeeAliases.map((e) => ({ employeeId: e.id, alias: e.fingerprintMachineName as string })),
    ...assignmentAliases.map((a) => ({ employeeId: a.employeeId, alias: a.fingerprintDeviceUserId as string })),
  ]);
  if (problem) return problem;

  await prisma.employee.update({ where: { id: employeeId }, data: { fingerprintMachineName: typed } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Employee",
    recordId: employeeId,
    reason: `Set the name on the fingerprint machine to "${typed}"`,
  });
  revalidatePath(`/employees/${employeeId}`);
}

export async function clearMachineName(employeeId: string): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceAssignment(session)) return t("common.forbidden");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fingerprintMachineName: true } });
  if (!employee) return "Karyawan tidak ditemukan.";
  if (!employee.fingerprintMachineName) return;
  await prisma.employee.update({ where: { id: employeeId }, data: { fingerprintMachineName: null } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Employee",
    recordId: employeeId,
    reason: "Cleared the name on the fingerprint machine (the full name is used again)",
  });
  revalidatePath(`/employees/${employeeId}`);
}
