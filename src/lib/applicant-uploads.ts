import { validateApplicantFile } from "@/lib/recruitment-candidates";

export interface ApplicantUpload {
  name: string;
  type: string;
  data: Buffer;
}

// Reads one uploaded file from an application form (the CV or the supporting document): checks type and
// size, returns its bytes. A missing file is fine unless `required`.
export async function readApplicantUpload(
  entry: FormDataEntryValue | null,
  label: string,
  required: boolean
): Promise<{ upload: ApplicantUpload | null } | { error: string }> {
  if (!(entry instanceof File) || entry.size === 0) {
    return required ? { error: `Unggah ${label} Anda.` } : { upload: null };
  }
  const problem = validateApplicantFile({ name: entry.name, size: entry.size, type: entry.type }, label);
  if (problem) return { error: problem };
  return { upload: { name: entry.name, type: entry.type, data: Buffer.from(await entry.arrayBuffer()) } };
}
