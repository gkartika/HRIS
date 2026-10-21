// The PDF guideline of the evaluation matrix: one file, uploaded by Admin SDM, opened by every evaluator.
// Pure checks only (no Prisma/Next), so they are unit tested.
export const GUIDELINE_MAX_BYTES = 4 * 1024 * 1024; // the hosting platform's request limit is about 4.5 MB

// `head` = the first bytes of the file. A real PDF starts with "%PDF-"; a renamed picture or document does not.
export function validateGuidelineFile(file: { name: string; size: number; head: Uint8Array }): string | null {
  if (file.size <= 0) return "File kosong. Pilih file PDF.";
  if (file.size > GUIDELINE_MAX_BYTES) return "File terlalu besar. Maksimal 4 MB.";
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Hanya file PDF yang bisa diunggah.";
  const magic = String.fromCharCode(...Array.from(file.head.slice(0, 5)));
  if (magic !== "%PDF-") return "File ini bukan PDF yang valid.";
  return null;
}

// A name that is safe to put in a Content-Disposition header.
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ()]+/g, "_").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "pedoman.pdf";
}
