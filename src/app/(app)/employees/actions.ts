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
  // Everything else (identitas, pendidikan, PTKP) is filled in later from the
  // employee's own detail page — see lib/employee-completeness.ts for the
  // non-blocking "profil belum lengkap" flag shown until then.
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
  const genderRaw = (formData.get("gender") as string)?.trim().toUpperCase();
  const birthPlace = (formData.get("birthPlace") as string)?.trim() || null;
  const birthDateRaw = (formData.get("birthDate") as string)?.trim();
  const personalEmail = (formData.get("personalEmail") as string)?.trim() || null;
  const mobileNumber = (formData.get("mobileNumber") as string)?.trim() || null;
  const currentAddressLine = (formData.get("currentAddressLine") as string)?.trim() || null;
  const currentAddressRtRw = (formData.get("currentAddressRtRw") as string)?.trim() || null;
  const currentAddressCity = (formData.get("currentAddressCity") as string)?.trim() || null;
  const currentAddressDistrict = (formData.get("currentAddressDistrict") as string)?.trim() || null;
  const currentAddressVillage = (formData.get("currentAddressVillage") as string)?.trim() || null;
  const currentAddressPostalCode =
    (formData.get("currentAddressPostalCode") as string)?.trim() || null;
  // "Sama dengan domisili" clears any previously-entered KTP address instead
  // of leaving stale values sitting unused behind the flag.
  const idCardAddressSameAsCurrent = formData.get("idCardAddressSameAsCurrent") === "on";
  const idCardAddressLine = idCardAddressSameAsCurrent
    ? null
    : (formData.get("idCardAddressLine") as string)?.trim() || null;
  const idCardAddressRtRw = idCardAddressSameAsCurrent
    ? null
    : (formData.get("idCardAddressRtRw") as string)?.trim() || null;
  const idCardAddressCity = idCardAddressSameAsCurrent
    ? null
    : (formData.get("idCardAddressCity") as string)?.trim() || null;
  const idCardAddressDistrict = idCardAddressSameAsCurrent
    ? null
    : (formData.get("idCardAddressDistrict") as string)?.trim() || null;
  const idCardAddressVillage = idCardAddressSameAsCurrent
    ? null
    : (formData.get("idCardAddressVillage") as string)?.trim() || null;
  const idCardAddressPostalCode = idCardAddressSameAsCurrent
    ? null
    : (formData.get("idCardAddressPostalCode") as string)?.trim() || null;
  const emergencyContactName = (formData.get("emergencyContactName") as string)?.trim() || null;
  const emergencyContactRelation =
    (formData.get("emergencyContactRelation") as string)?.trim() || null;
  const emergencyContactPhone = (formData.get("emergencyContactPhone") as string)?.trim() || null;

  // Self-service edits are limited to contact info — HR Admin can additionally
  // edit the legal name and the DM-17/DM-19/DM-20 identity/compliance fields
  // (ACC-10: field-level scope even when editing, not just when viewing).
  const data: Record<string, unknown> = {
    gender: genderRaw ? (genderRaw as Gender) : null,
    birthPlace,
    birthDate: birthDateRaw ? new Date(birthDateRaw) : null,
    personalEmail,
    mobileNumber,
    currentAddressLine,
    currentAddressRtRw,
    currentAddressCity,
    currentAddressDistrict,
    currentAddressVillage,
    currentAddressPostalCode,
    idCardAddressSameAsCurrent,
    idCardAddressLine,
    idCardAddressRtRw,
    idCardAddressCity,
    idCardAddressDistrict,
    idCardAddressVillage,
    idCardAddressPostalCode,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone,
  };

  if (isHrAdmin(session)) {
    if (!fullLegalName) return "Nama lengkap wajib diisi.";
    data.fullLegalName = fullLegalName;

    const employeeNumber = (formData.get("employeeNumber") as string)?.trim();
    if (!employeeNumber) return "Nomor karyawan wajib diisi.";
    const employeeNumberTaken = await prisma.employee.findFirst({
      where: { employeeNumber, NOT: { id: employeeId } },
    });
    if (employeeNumberTaken) return `Nomor karyawan ${employeeNumber} sudah digunakan.`;
    data.employeeNumber = employeeNumber;

    const nationalIdNumber = (formData.get("nationalIdNumber") as string)?.trim() || null;
    const noKk = (formData.get("noKk") as string)?.trim() || null;
    const namaIbuKandung = (formData.get("namaIbuKandung") as string)?.trim() || null;
    const educationLevelId = (formData.get("educationLevelId") as string) || null;
    const ptkpStatusCode = (formData.get("ptkpStatusCode") as string) || null;

    // Optional, same as at creation — can be left blank and completed later.
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

    data.bankAccountName = (formData.get("bankAccountName") as string)?.trim() || null;
    data.bankAccountNumber = (formData.get("bankAccountNumber") as string)?.trim() || null;
    data.taxId = (formData.get("taxId") as string)?.trim() || null;
    data.bpjsEmploymentNumber = (formData.get("bpjsEmploymentNumber") as string)?.trim() || null;
    data.bpjsHealthNumber = (formData.get("bpjsHealthNumber") as string)?.trim() || null;

    // hireDate is otherwise set once at creation — this is only a correction
    // path. employmentStatus/activeFlag are deliberately NOT editable here:
    // they're derived/driven by the Contract and Movement workflows
    // (contracts/actions.ts, movements/actions.ts) and Offboarding
    // (offboarding/actions.ts) respectively, so editing them directly here
    // would let an admin silently bypass those processes.
    const hireDateRaw = (formData.get("hireDate") as string)?.trim();
    if (hireDateRaw) data.hireDate = new Date(hireDateRaw);
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
