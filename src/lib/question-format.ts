// Format checks for a test question as the recruiter types it: things the applicant would see and that look like
// typing leftovers (a line with only a comma, "??"). Pure, unit tested.
const STRAY_LINE = /^[,.;:!?\-]+$/;

export function questionFormatWarnings(prompt: string): string[] {
  const warnings: string[] = [];
  const lines = prompt.replace(/\r\n/g, "\n").split("\n");
  const stray = lines.map((line, i) => ({ text: line.trim(), n: i + 1 })).filter((l) => STRAY_LINE.test(l.text));
  if (stray.length === 1) warnings.push(`Baris ${stray[0].n} hanya berisi tanda "${stray[0].text}" dan ikut terlihat oleh pelamar.`);
  else if (stray.length > 1) warnings.push(`Baris ${stray.map((l) => l.n).join(", ")} hanya berisi tanda baca dan ikut terlihat oleh pelamar.`);
  const doubled = prompt.match(/[?!]{2,}|,{2,}/g);
  if (doubled) warnings.push(`Ada tanda baca ganda (${Array.from(new Set(doubled)).join(" ")}) yang terlihat oleh pelamar.`);
  return warnings;
}
