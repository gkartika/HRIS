// Pure validation helpers for the DM-17/DM-18 Employee Master fields.
// Kept dependency-free (no Prisma/Next imports) so they're trivially unit
// testable and reusable from both server actions and future API routes.

const NO_KK_PATTERN = /^\d{16}$/;

export function validateNoKk(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // optional field — only format is validated when provided
  if (!NO_KK_PATTERN.test(trimmed)) {
    return "No. KK harus tepat 16 digit angka.";
  }
  return null;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, per CTL-12/DM-18

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

// CTL-12: "verify MIME type and extension" — checked independently so a
// mislabeled file (e.g. a renamed .exe reporting image/png) doesn't slip
// through on MIME type alone.
export function validateDocumentFile(file: { name: string; type: string; size: number }): string | null {
  const mimeOk = (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type);
  const extensionOk = (ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(getExtension(file.name));
  if (!mimeOk || !extensionOk) {
    return "Jenis berkas tidak didukung. Gunakan PDF, JPG, JPEG, atau PNG.";
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return "Ukuran berkas melebihi batas maksimum 10 MB.";
  }
  if (file.size === 0) {
    return "Berkas kosong atau tidak dapat dibaca.";
  }
  return null;
}

export const ALLOWED_SELFIE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
export const ALLOWED_SELFIE_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const;
export const MAX_SELFIE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — a phone-camera selfie, not a scanned document

// Mobile check-in/out selfie — image only, no PDF (unlike identity
// documents), and a smaller size cap since it's always a live camera photo.
export function validateSelfieFile(file: { name: string; type: string; size: number }): string | null {
  const mimeOk = (ALLOWED_SELFIE_MIME_TYPES as readonly string[]).includes(file.type);
  const extensionOk = (ALLOWED_SELFIE_EXTENSIONS as readonly string[]).includes(getExtension(file.name));
  if (!mimeOk || !extensionOk) {
    return "Jenis berkas tidak didukung. Gunakan foto JPG atau PNG.";
  }
  if (file.size > MAX_SELFIE_SIZE_BYTES) {
    return "Ukuran foto melebihi batas maksimum 5 MB.";
  }
  if (file.size === 0) {
    return "Foto kosong atau tidak dapat dibaca.";
  }
  return null;
}
