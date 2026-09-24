"use server";

import { revalidatePath } from "next/cache";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canCreateEmployee, isHrAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { validateNoKk, validateNationalIdNumber } from "@/lib/validation/employee-fields";
import { formatOnboardingCaseNumber } from "@/lib/onboarding";
import { applyOnboardingMandatoryTrainingForEmployee } from "@/lib/mandatory-training";
import type { Gender, EmploymentStatus } from "@/generated/prisma/enums";

export async function createEmployee(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canCreateEmployee(session)) return "Anda tidak memiliki akses.";

  const employeeNumber = (formData.get("employeeNumber") as string)?.trim();
  const fullLegalName = (formData.get("fullLegalName") as string)?.trim();
  const gender = (formData.get("gender") as string) || null;
  const workEmail = (formData.get("workEmail") as string)?.trim() || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const hireDate = formData.get("hireDate") as string;
  const employmentStatus = formData.get("employmentStatus") as EmploymentStatus;
  const nationalIdNumber = (formData.get("nationalIdNumber") as string)?.trim() || null;
  const noKk = (formData.get("noKk") as string)?.trim() || null;
  const namaIbuKandung = (formData.get("namaIbuKandung") as string)?.trim() || null;
  const educationLevelId = (formData.get("educationLevelId") as string) || null;
  const ptkpStatusCode = (formData.get("ptkpStatusCode") as string) || null;

  if (!employeeNumber || !fullLegalName || !hireDate || !employmentStatus) {
    return "Nomor karyawan, nama lengkap, tanggal bergabung, dan status kepegawaian wajib diisi.";
  }
  if (!educationLevelId) return "Pendidikan Terakhir wajib dipilih.";
  if (!ptkpStatusCode) return "PTKP Pajak wajib dipilih.";
  if (nationalIdNumber) {
    const nationalIdError = validateNationalIdNumber(nationalIdNumber);
    if (nationalIdError) return nationalIdError;
  }
  if (noKk) {
    const noKkError = validateNoKk(noKk);
    if (noKkError) return noKkError;
  }

  const existing = await prisma.employee.findUnique({ where: { employeeNumber } });
  if (existing) return `Nomor karyawan ${employeeNumber} sudah digunakan.`;

  const hireDateObj = new Date(hireDate);

  // LIF-03: "After Employee creation..." — an Onboarding Case is created
  // automatically alongside every new Employee, reusing hireDate as the
  // planned start date rather than asking for it again.
  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        employeeNumber,
        fullLegalName,
        gender: gender ? (gender as Gender) : null,
        workEmail,
        mobileNumber,
        hireDate: hireDateObj,
        employmentStatus,
        nationalIdNumber,
        noKk,
        namaIbuKandung,
        educationLevelId,
        ptkpStatusCode,
      },
    });

    const year = companyYear(hireDateObj);
    const seq = await nextSequence(`ONB-${year}`, tx);
    await tx.onboardingCase.create({
      data: {
        caseNumber: formatOnboardingCaseNumber(seq, year),
        employeeId: created.id,
        plannedStartDate: hireDateObj,
      },
    });

    return created;
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Employee",
    recordId: employee.id,
    reason: `Created employee ${fullLegalName} (${employeeNumber})`,
  });

  // Onboarding-compulsory course auto-assign (outside the transaction above,
  // same as applyMandatoryTrainingRule elsewhere — not itself transactional).
  // No currentPositionId is set yet on this path, so only EVERYONE/EMPLOYEE-
  // targeted onboarding rules can resolve here; a Department/Job/Position-
  // targeted onboarding rule only applies once Training Admin re-applies it
  // manually after this employee is assigned a Position.
  await applyOnboardingMandatoryTrainingForEmployee(employee.id, session.user.id);

  revalidatePath("/employees");
  revalidatePath("/onboarding");
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
  const personalEmail = (formData.get("personalEmail") as string)?.trim() || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const currentAddress = (formData.get("currentAddress") as string)?.trim() || null;
  const emergencyContactName = (formData.get("emergencyContactName") as string)?.trim() || null;
  const emergencyContactRelation =
    (formData.get("emergencyContactRelation") as string)?.trim() || null;
  const emergencyContactPhone = (formData.get("emergencyContactPhone") as string)?.trim() || null;

  if (!fullLegalName) return "Nama lengkap wajib diisi.";

  // Self-service edits are limited to contact info — HR Admin can additionally
  // edit the legal name and the DM-17/DM-19/DM-20 identity/compliance fields
  // (ACC-10: field-level scope even when editing, not just when viewing).
  const data: Record<string, unknown> = {
    personalEmail,
    mobileNumber,
    currentAddress,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone,
  };

  if (isHrAdmin(session)) {
    data.fullLegalName = fullLegalName;

    const nationalIdNumber = (formData.get("nationalIdNumber") as string)?.trim() || null;
    const noKk = (formData.get("noKk") as string)?.trim() || null;
    const namaIbuKandung = (formData.get("namaIbuKandung") as string)?.trim() || null;
    const educationLevelId = (formData.get("educationLevelId") as string) || null;
    const ptkpStatusCode = (formData.get("ptkpStatusCode") as string) || null;

    if (!educationLevelId) return "Pendidikan Terakhir wajib dipilih.";
    if (!ptkpStatusCode) return "PTKP Pajak wajib dipilih.";
    if (nationalIdNumber) {
      const nationalIdError = validateNationalIdNumber(nationalIdNumber);
      if (nationalIdError) return nationalIdError;
    }
    if (noKk) {
      const noKkError = validateNoKk(noKk);
      if (noKkError) return noKkError;
    }

    data.nationalIdNumber = nationalIdNumber;
    data.noKk = noKk;
    data.namaIbuKandung = namaIbuKandung;
    data.educationLevelId = educationLevelId;
    data.ptkpStatusCode = ptkpStatusCode;
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
