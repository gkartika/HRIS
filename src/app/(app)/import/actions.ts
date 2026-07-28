"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure, canCreateEmployee, isHrAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCsvRows } from "@/lib/import-export/csv";
import { DATASET_REGISTRY, isDatasetKey, type DatasetKey } from "@/lib/import-export/registry";
import { importEmployeeDocumentsZip } from "@/lib/import-export/employee-documents-zip";
import type { Session } from "next-auth";

function canImportDataset(session: Session, dataset: DatasetKey): boolean {
  if (dataset === "employees") return canCreateEmployee(session);
  if (dataset === "assignments") return isHrAdmin(session);
  return canManageOrgStructure(session);
}

export async function uploadAndPreviewImport(
  dataset: DatasetKey,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!isDatasetKey(dataset)) return "Dataset tidak dikenal.";
  if (!canImportDataset(session, dataset)) {
    return "Anda tidak memiliki akses untuk mengimpor data ini.";
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return "Pilih berkas CSV terlebih dahulu.";
  }

  const csvText = await file.text();
  const parsedRows = parseCsvRows(csvText);
  if (parsedRows.length === 0) {
    return "Berkas CSV kosong atau tidak dapat dibaca.";
  }

  const mod = DATASET_REGISTRY[dataset];
  const dryRunRows = await mod.dryRun(parsedRows);
  const validRows = dryRunRows.filter((r) => r.isValid);
  const errorRows = dryRunRows.filter((r) => !r.isValid);

  const batch = await prisma.importBatch.create({
    data: {
      importType: dataset,
      uploadedByAccountId: session.user.id,
      sourceFileName: file.name,
      totalRows: dryRunRows.length,
      validRows: validRows.length,
      errorRows: errorRows.length,
      importStatus: "VALIDATED",
      previewConfirmedAt: new Date(),
      rows: {
        create: dryRunRows.map((r) => ({
          rowNumber: r.rowNumber,
          rawData: JSON.stringify(r.raw),
          isValid: r.isValid,
          rejectionReason: r.rejectionReason,
          rowAction: r.action,
        })),
      },
    },
  });

  revalidatePath("/import");
  redirect(`/import/${batch.id}`);
}

export async function commitImportBatch(batchId: string) {
  const session = await requireSession();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: true },
  });
  if (!batch) throw new Error("Import batch not found");
  if (!isDatasetKey(batch.importType)) throw new Error("Unknown dataset for this batch");
  if (!canImportDataset(session, batch.importType)) throw new Error("Access denied");

  const mod = DATASET_REGISTRY[batch.importType];

  if (batch.importStatus !== "POSTED") {
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of batch.rows) {
      if (!row.isValid || row.createdRecordId) continue;
      const raw = JSON.parse(row.rawData) as Record<string, string>;
      const result = await mod.commitRow(raw);
      await prisma.importRow.update({
        where: { id: row.id },
        data: { createdRecordId: result.id, rowAction: result.action },
      });
      if (result.action === "UPDATE") updatedCount += 1;
      else createdCount += 1;
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: { importStatus: "POSTED", postedAt: new Date() },
    });

    await logAudit({
      actorAccountId: session.user.id,
      action: "IMPORT",
      datasetName: mod.label,
      recordId: batchId,
      reason: `Imported "${batch.sourceFileName}": ${createdCount} created, ${updatedCount} updated, ${batch.errorRows} rejected out of ${batch.totalRows}`,
    });
  }

  revalidatePath(`/import/${batchId}`);
  revalidatePath("/employees");
  revalidatePath("/admin/org-units");
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/positions");
  revalidatePath("/organization");
  redirect(`/import/${batchId}`);
}

export async function uploadEmployeeDocumentsZip(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!isHrAdmin(session)) return "Anda tidak memiliki akses.";

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return "Pilih berkas ZIP terlebih dahulu.";

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importEmployeeDocumentsZip(buffer, session.user.id);

  revalidatePath("/employees");
  if (result.errors.length > 0) {
    return `${result.imported} dokumen berhasil diimpor. ${result.errors.length} baris gagal: ${result.errors.slice(0, 3).join(" | ")}${result.errors.length > 3 ? " ..." : ""}`;
  }
  return undefined;
}
