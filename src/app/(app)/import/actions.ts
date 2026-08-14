"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canManageOrgStructure,
  canCreateEmployee,
  isHrAdmin,
  canImportFingerprintAttendance,
  canRunCompetencyHistoricalMigration,
  canImportMandatoryTrainingParticipants,
  canImportTrainingAttendance,
  canImportAssetMaster,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCsvRows } from "@/lib/import-export/csv";
import { DATASET_REGISTRY, isDatasetKey, type DatasetKey } from "@/lib/import-export/registry";
import { importEmployeeDocumentsZip } from "@/lib/import-export/employee-documents-zip";
import type { Session } from "next-auth";

function canImportDataset(session: Session, dataset: DatasetKey): boolean {
  if (dataset === "employees") return canCreateEmployee(session);
  if (dataset === "assignments") return isHrAdmin(session);
  if (dataset === "fingerprint-attendance") return canImportFingerprintAttendance(session);
  // ACC-24: "HR Admin alone may run the approved one-time historical
  // competency migration... After acceptance, disable the migration
  // action" — the disable-after-acceptance half is enforced by
  // canRunCompetencyHistoricalMigration always being HR-Admin-only, never a
  // toggle the UI exposes to anyone else; there is no separate "acceptance"
  // flag in this build (COM-19 calls it a one-time action by convention).
  if (dataset === "competency-migration") return canRunCompetencyHistoricalMigration(session);
  if (dataset === "mandatory-training-participants") return canImportMandatoryTrainingParticipants(session);
  if (dataset === "training-attendance") return canImportTrainingAttendance(session);
  if (dataset === "asset-master") return canImportAssetMaster(session);
  return canManageOrgStructure(session);
}

// Fingerprint machine exports are commonly XLSX, unlike every other dataset
// in this app which is CSV-only — detected by extension and converted to
// the same plain row-object shape parseCsvRows already produces, so the
// rest of the dry-run/commit pipeline stays dataset-agnostic.
async function fileToRows(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: "" });
  }
  const csvText = await file.text();
  return parseCsvRows(csvText);
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
    return "Pilih berkas terlebih dahulu.";
  }

  const parsedRows = await fileToRows(file);
  if (parsedRows.length === 0) {
    return "Berkas kosong atau tidak dapat dibaca.";
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
      const result = await mod.commitRow(raw, session);
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
  revalidatePath("/training/learning-assignments");
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
