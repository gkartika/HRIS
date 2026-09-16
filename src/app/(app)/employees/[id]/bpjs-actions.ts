"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canUploadEmployeeDocument } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateDocumentFile } from "@/lib/validation/employee-fields";

type BpjsCardCategory = "BPJS_TK" | "BPJS_KESEHATAN";

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export async function uploadBpjsCard(
  employeeId: string,
  category: BpjsCardCategory,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canUploadEmployeeDocument(session)) {
    return "Anda tidak memiliki akses untuk mengunggah dokumen ini.";
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return "Pilih berkas terlebih dahulu.";
  }

  const validationError = validateDocumentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (validationError) return validationError;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const isReplacement =
    category === "BPJS_TK" ? !!employee.bpjsTkFileId : !!employee.bpjsKesehatanFileId;

  const storageKey = randomStorageKey(category, getExtension(file.name));
  const bytes = Buffer.from(await file.arrayBuffer());
  await savePrivateFile(storageKey, bytes);

  const fileObject = await prisma.fileObject.create({
    data: {
      storageKey,
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      sensitivity: "HIGHLY_RESTRICTED",
      employeeId,
      uploadedByAccountId: session.user.id,
      category,
      confidential: true,
    },
  });

  await prisma.employee.update({
    where: { id: employeeId },
    data:
      category === "BPJS_TK"
        ? { bpjsTkFileId: fileObject.id }
        : { bpjsKesehatanFileId: fileObject.id },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "FileObject",
    recordId: fileObject.id,
    reason: `${isReplacement ? "Replaced" : "Uploaded"} ${category} for employee ${employee.employeeNumber}`,
  });

  revalidatePath(`/employees/${employeeId}`);
}
