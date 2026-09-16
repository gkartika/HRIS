import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, readPrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";
import { rowsToCsv, parseCsvRows } from "./csv";

const MANIFEST_HEADERS = [
  "employeeNumber",
  "category",
  "originalFileName",
  "mimeType",
  "sizeBytes",
  "uploadedByAccount",
  "uploadedAt",
  "zipEntryPath",
];

// CTL-13: "File-bearing records must support authorized ZIP export with a
// manifest." One row per FileObject, one entry per file, so the export is
// both human-auditable (manifest.csv) and re-importable.
export async function buildEmployeeDocumentsZip(): Promise<Buffer> {
  const files = await prisma.fileObject.findMany({
    where: { employeeId: { not: null } },
    include: { employee: true, uploadedByAccount: true },
    orderBy: { createdAt: "asc" },
  });

  const zip = new JSZip();
  const manifestRows: Record<string, string>[] = [];

  for (const file of files) {
    const employeeNumber = file.employee?.employeeNumber ?? "unknown";
    const safeCategory = (file.category ?? "lainnya").replace(/[^a-zA-Z0-9-]/g, "-");
    const zipEntryPath = `${employeeNumber}/${safeCategory}-${file.id}-${file.originalFileName}`;
    const bytes = await readPrivateFile(file.storageKey);
    zip.file(zipEntryPath, bytes);

    manifestRows.push({
      employeeNumber,
      category: file.category ?? "",
      originalFileName: file.originalFileName,
      mimeType: file.mimeType,
      sizeBytes: String(file.sizeBytes),
      uploadedByAccount: file.uploadedByAccount.usernameOrEmail,
      uploadedAt: file.createdAt.toISOString(),
      zipEntryPath,
    });
  }

  zip.file("manifest.csv", rowsToCsv(MANIFEST_HEADERS, manifestRows));
  return zip.generateAsync({ type: "nodebuffer" });
}

export interface ImportZipResult {
  imported: number;
  errors: string[];
}

// Bulk-attaches documents from a ZIP+manifest (CTL-13: "ZIP/manifest
// import"). Manifest rows only need employeeNumber, category, and
// zipEntryPath — every import is an *additional* document (a brand-new
// FileObject); if category is BPJS_TK or BPJS_KESEHATAN it also repoints
// Employee.bpjsTkFileId/bpjsKesehatanFileId, same replace semantics as the
// single-file upload panel.
export async function importEmployeeDocumentsZip(
  zipBuffer: Buffer,
  uploaderAccountId: string
): Promise<ImportZipResult> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const manifestEntry = zip.file("manifest.csv");
  if (!manifestEntry) {
    return { imported: 0, errors: ["Berkas ZIP tidak berisi manifest.csv"] };
  }

  const manifestRows = parseCsvRows(await manifestEntry.async("string"));
  const errors: string[] = [];
  let imported = 0;

  for (const [index, row] of manifestRows.entries()) {
    const rowNumber = index + 2;
    const employeeNumber = row.employeeNumber?.trim();
    const category = row.category?.trim();
    const zipEntryPath = row.zipEntryPath?.trim();

    if (!employeeNumber || !category || !zipEntryPath) {
      errors.push(`Baris ${rowNumber}: employeeNumber, category, dan zipEntryPath wajib diisi`);
      continue;
    }
    const employee = await prisma.employee.findUnique({ where: { employeeNumber } });
    if (!employee) {
      errors.push(`Baris ${rowNumber}: karyawan ${employeeNumber} tidak ditemukan`);
      continue;
    }
    const entry = zip.file(zipEntryPath);
    if (!entry) {
      errors.push(`Baris ${rowNumber}: berkas "${zipEntryPath}" tidak ditemukan di dalam ZIP`);
      continue;
    }

    const originalFileName = row.originalFileName?.trim() || zipEntryPath.split("/").pop() || "berkas";
    const mimeType = row.mimeType?.trim() || "application/octet-stream";
    const bytes = await entry.async("nodebuffer");

    const validationError = validateDocumentFile({ name: originalFileName, type: mimeType, size: bytes.length });
    if (validationError) {
      errors.push(`Baris ${rowNumber}: ${validationError}`);
      continue;
    }

    const extIdx = originalFileName.lastIndexOf(".");
    const extension = extIdx === -1 ? "" : originalFileName.slice(extIdx);
    const storageKey = randomStorageKey(category, extension);
    await savePrivateFile(storageKey, bytes);

    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalFileName,
        mimeType,
        sizeBytes: bytes.length,
        sensitivity: category === "BPJS_TK" || category === "BPJS_KESEHATAN" ? "HIGHLY_RESTRICTED" : "RESTRICTED",
        employeeId: employee.id,
        uploadedByAccountId: uploaderAccountId,
        category,
        confidential: true,
      },
    });

    if (category === "BPJS_TK") {
      await prisma.employee.update({ where: { id: employee.id }, data: { bpjsTkFileId: fileObject.id } });
    } else if (category === "BPJS_KESEHATAN") {
      await prisma.employee.update({ where: { id: employee.id }, data: { bpjsKesehatanFileId: fileObject.id } });
    }

    await logAudit({
      actorAccountId: uploaderAccountId,
      action: "IMPORT",
      datasetName: "FileObject",
      recordId: fileObject.id,
      reason: `Bulk ZIP import: ${category} for employee ${employeeNumber}`,
    });
    imported += 1;
  }

  return { imported, errors };
}
