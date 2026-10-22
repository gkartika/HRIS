// One standard for every WhatsApp number in recruitment. Pure (no Node or Prisma imports) so the browser form
// and the server action apply exactly the same rule.

// "0812-3456-7890" / "+62 812 3456 7890" / "62812..." all become "6281234567890".
export function normalizeMobile(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

// Why a WhatsApp number is refused (null = fine). Only Indonesian mobile numbers are accepted: 62 8xx...
// with 11 to 14 digits in total, whatever the way it was typed.
export function mobileProblem(input: string): string | null {
  const n = normalizeMobile(input);
  if (n.length === 0) return "Isi nomor WhatsApp.";
  if (!n.startsWith("62")) return "Hanya nomor Indonesia (+62) yang diterima. Contoh: 0812 3456 7890.";
  if (!n.startsWith("628")) return "Isi nomor seluler yang memakai WhatsApp, contoh 0812 3456 7890.";
  if (n.length < 11) return "Nomor terlalu pendek. Contoh: 0812 3456 7890.";
  if (n.length > 14) return "Nomor terlalu panjang. Contoh: 0812 3456 7890.";
  return null;
}

export function isValidMobile(input: string): boolean {
  return mobileProblem(input) === null;
}

// 6281234567890 -> "+62 812-3456-7890": the one way every screen shows a stored number.
export function formatMobile(normalized: string): string {
  const n = normalizeMobile(normalized);
  if (!n.startsWith("62") || n.length < 6) return normalized;
  const rest = n.slice(2);
  const head = rest.slice(0, 3);
  const tail = rest.slice(3);
  const half = Math.ceil(tail.length / 2);
  const parts = tail.length <= 4 ? [tail] : tail.length <= 8 ? [tail.slice(0, tail.length - half), tail.slice(tail.length - half)] : [tail.slice(0, 4), tail.slice(4)];
  return ["+62", [head, ...parts].filter(Boolean).join("-")].join(" ");
}
