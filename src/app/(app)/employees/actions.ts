"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, canCreateEmployee, isHrAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { Gender, EmploymentStatus } from "@/generated/prisma/enums";

export async function createEmployee(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateEmployee(session)) return "Anda tidak memiliki akses.";

  const employeeNumber = (formData.get("employeeNumber") as string)?.trim();
  const fullLegalName = (formData.get("fullLegalName") as string)?.trim();
  const preferredName = (formData.get("preferredName") as string)?.trim() || null;
  const gender = (formData.get("gender") as string) || null;
  const workEmail = (formData.get("workEmail") as string)?.trim() || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const hireDate = formData.get("hireDate") as string;
  const employmentStatus = formData.get("employmentStatus") as EmploymentStatus;

  if (!employeeNumber || !fullLegalName || !hireDate || !employmentStatus) {
    return "Nomor karyawan, nama lengkap, tanggal bergabung, dan status kepegawaian wajib diisi.";
  }

  const existing = await prisma.employee.findUnique({ where: { employeeNumber } });
  if (existing) return `Nomor karyawan ${employeeNumber} sudah digunakan.`;

  const employee = await prisma.employee.create({
    data: {
      employeeNumber,
      fullLegalName,
      preferredName,
      gender: gender ? (gender as Gender) : null,
      workEmail,
      mobileNumber,
      hireDate: new Date(hireDate),
      employmentStatus,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Employee",
    recordId: employee.id,
    reason: `Created employee ${fullLegalName} (${employeeNumber})`,
  });

  revalidatePath("/employees");
  redirect(`/employees/${employee.id}`);
}

export async function updateEmployee(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const isSelf = session.user.employeeId === employeeId;
  if (!isSelf && !isHrAdmin(session)) return "Anda tidak memiliki akses.";

  const fullLegalName = (formData.get("fullLegalName") as string)?.trim();
  const preferredName = (formData.get("preferredName") as string)?.trim() || null;
  const personalEmail = (formData.get("personalEmail") as string)?.trim() || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const currentAddress = (formData.get("currentAddress") as string)?.trim() || null;
  const emergencyContactName = (formData.get("emergencyContactName") as string)?.trim() || null;
  const emergencyContactRelation =
    (formData.get("emergencyContactRelation") as string)?.trim() || null;
  const emergencyContactPhone = (formData.get("emergencyContactPhone") as string)?.trim() || null;

  if (!fullLegalName) return "Nama lengkap wajib diisi.";

  // Self-service edits are limited to contact info — HR Admin can additionally
  // edit the legal name (ACC-10: field-level scope even when editing).
  const data: Record<string, unknown> = {
    preferredName,
    personalEmail,
    mobileNumber,
    currentAddress,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone,
  };
  if (isHrAdmin(session)) {
    data.fullLegalName = fullLegalName;
  }

  await prisma.employee.update({ where: { id: employeeId }, data });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Employee",
    recordId: employeeId,
    reason: isSelf ? "Employee updated own contact info" : "HR Admin updated employee record",
  });

  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}`);
}
