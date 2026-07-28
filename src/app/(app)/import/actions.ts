"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canAccessImport } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseAndValidateEmployeeCsv } from "@/lib/import/employee-import";
import type { Gender, EmploymentStatus } from "@/generated/prisma/enums";

export async function uploadAndPreviewImport(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canAccessImport(session)) {
    return "Anda tidak memiliki akses untuk mengimpor data.";
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return "Pilih berkas CSV terlebih dahulu.";
  }

  const csvText = await file.text();
  const existing = await prisma.employee.findMany({ select: { employeeNumber: true } });
  const existingNumbers = new Set(existing.map((e) => e.employeeNumber));

  const rows = parseAndValidateEmployeeCsv(csvText, existingNumbers);
  if (rows.length === 0) {
    return "Berkas CSV kosong atau tidak dapat dibaca.";
  }
  const validRows = rows.filter((r) => r.isValid);
  const errorRows = rows.filter((r) => !r.isValid);

  const batch = await prisma.importBatch.create({
    data: {
      importType: "Employee",
      uploadedByAccountId: session.user.id,
      sourceFileName: file.name,
      totalRows: rows.length,
      validRows: validRows.length,
      errorRows: errorRows.length,
      importStatus: "VALIDATED",
      previewConfirmedAt: new Date(),
      rows: {
        create: rows.map((r) => ({
          rowNumber: r.rowNumber,
          rawData: JSON.stringify(r.raw),
          isValid: r.isValid,
          rejectionReason: r.rejectionReason,
        })),
      },
    },
  });

  revalidatePath("/import");
  redirect(`/import/${batch.id}`);
}

export async function commitImportBatch(batchId: string) {
  const session = await requireSession();
  if (!canAccessImport(session)) {
    throw new Error("Access denied");
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: true },
  });
  if (!batch) throw new Error("Import batch not found");

  if (batch.importStatus !== "POSTED") {
    let createdCount = 0;
    for (const row of batch.rows) {
      if (!row.isValid || row.createdEmployeeId) continue;
      const raw = JSON.parse(row.rawData) as Record<string, string>;
      const genderRaw = raw.gender?.trim().toUpperCase();
      const employee = await prisma.employee.create({
        data: {
          employeeNumber: raw.employeeNumber.trim(),
          fullLegalName: raw.fullLegalName.trim(),
          workEmail: raw.workEmail?.trim() || null,
          gender: genderRaw ? (genderRaw as Gender) : null,
          hireDate: new Date(raw.hireDate.trim()),
          employmentStatus: raw.employmentStatus.trim().toUpperCase() as EmploymentStatus,
        },
      });
      await prisma.importRow.update({
        where: { id: row.id },
        data: { createdEmployeeId: employee.id },
      });
      createdCount += 1;
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { importStatus: "POSTED", postedAt: new Date() },
    });

    await logAudit({
      actorAccountId: session.user.id,
      action: "IMPORT",
      datasetName: "Employee",
      recordId: batchId,
      reason: `Imported ${createdCount} employee(s) from "${batch.sourceFileName}"; ${batch.errorRows} row(s) rejected out of ${batch.totalRows}`,
    });
  }

  revalidatePath(`/import/${batchId}`);
  revalidatePath("/employees");
  redirect(`/import/${batchId}`);
}
