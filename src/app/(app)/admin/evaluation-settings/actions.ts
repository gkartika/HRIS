"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { randomStorageKey, savePrivateFile } from "@/lib/file-storage";
import { validateGuidelineFile } from "@/lib/evaluation-guideline";
import { PERFORMANCE_SCALE, TATA_NILAI_SCALE } from "@/lib/evaluation";
import { DEFAULT_VARIANT, levelsFromTexts, parseLevelList, standardProblem } from "@/lib/evaluation-standard";
import type { EvaluationSection } from "@/generated/prisma/enums";

// Pengaturan Evaluasi: Admin SDM edits the criteria of the evaluation matrix (names, order, on/off; the grades are
// fixed) and uploads the PDF guideline. Every change applies to evaluations released afterwards; an evaluation
// already released keeps the criteria it was released with. Criteria are never deleted.
type Result = string | undefined;

const PATH = "/admin/evaluation-settings";
const MAX_CRITERIA_PER_SECTION = 15;

async function adminOnly(): Promise<{ id: string } | { error: string }> {
  const session = await requireSession();
  return isHrAdmin(session) ? { id: session.user.id } : { error: t("common.forbidden") };
}

function cleanLabel(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function labelProblem(label: string): string | null {
  if (!label) return "Nama kriteria wajib diisi.";
  if (label.length > 120) return "Nama kriteria terlalu panjang (maksimal 120 karakter).";
  return null;
}

export async function addCriterionAction(section: EvaluationSection, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const label = cleanLabel(formData.get("label"));
  const problem = labelProblem(label);
  if (problem) return problem;

  const existing = await prisma.evaluationCriterion.findMany({ where: { section }, select: { label: true, sortOrder: true } });
  if (existing.length >= MAX_CRITERIA_PER_SECTION) return `Satu bagian paling banyak ${MAX_CRITERIA_PER_SECTION} kriteria.`;
  if (existing.some((c) => c.label.toLowerCase() === label.toLowerCase())) return "Kriteria dengan nama ini sudah ada di bagian ini.";

  const created = await prisma.evaluationCriterion.create({
    data: { section, label, key: `c_${randomBytes(5).toString("hex")}`, sortOrder: Math.max(-1, ...existing.map((c) => c.sortOrder)) + 1 },
  });
  await logAudit({ actorAccountId: auth.id, action: "CREATE", datasetName: "EvaluationCriterion", recordId: created.id, reason: `Added criterion "${label}" (${section})` });
  revalidatePath(PATH);
}

export async function renameCriterionAction(id: string, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const label = cleanLabel(formData.get("label"));
  const problem = labelProblem(label);
  if (problem) return problem;

  const current = await prisma.evaluationCriterion.findUnique({ where: { id } });
  if (!current) return "Kriteria tidak ditemukan.";
  const same = await prisma.evaluationCriterion.findFirst({ where: { section: current.section, label: { equals: label, mode: "insensitive" }, NOT: { id } } });
  if (same) return "Kriteria dengan nama ini sudah ada di bagian ini.";

  await prisma.evaluationCriterion.update({ where: { id }, data: { label } });
  await logAudit({ actorAccountId: auth.id, action: "UPDATE", datasetName: "EvaluationCriterion", recordId: id, reason: `Renamed criterion "${current.label}" to "${label}"` });
  revalidatePath(PATH);
}

export async function toggleCriterionAction(id: string, active: boolean): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const current = await prisma.evaluationCriterion.findUnique({ where: { id } });
  if (!current) return "Kriteria tidak ditemukan.";
  if (!active) {
    const stillActive = await prisma.evaluationCriterion.count({ where: { section: current.section, active: true, NOT: { id } } });
    if (stillActive === 0) return "Setiap bagian harus punya minimal satu kriteria aktif.";
  }
  await prisma.evaluationCriterion.update({ where: { id }, data: { active } });
  await logAudit({ actorAccountId: auth.id, action: "UPDATE", datasetName: "EvaluationCriterion", recordId: id, reason: `${active ? "Turned on" : "Turned off"} criterion "${current.label}"` });
  revalidatePath(PATH);
}

export async function moveCriterionAction(id: string, direction: "up" | "down"): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const current = await prisma.evaluationCriterion.findUnique({ where: { id } });
  if (!current) return "Kriteria tidak ditemukan.";
  const all = await prisma.evaluationCriterion.findMany({ where: { section: current.section }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const index = all.findIndex((c) => c.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return;
  // renumber the whole section so equal or gapped numbers never cause a wrong swap
  const order = all.map((c) => c.id);
  [order[index], order[swapWith]] = [order[swapWith], order[index]];
  await prisma.$transaction(order.map((cid, i) => prisma.evaluationCriterion.update({ where: { id: cid }, data: { sortOrder: i } })));
  await logAudit({ actorAccountId: auth.id, action: "UPDATE", datasetName: "EvaluationCriterion", recordId: id, reason: `Moved criterion "${current.label}" ${direction}` });
  revalidatePath(PATH);
}

// ---------- the standard: what each criterion and grade means (shown to the evaluator) ----------

const HEADER_MAX = 60;

export async function saveStandardHeaderAction(_prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const pick = (name: string) => cleanLabel(formData.get(name)) || null;
  const data = { standardDocNumber: pick("docNumber"), standardRevision: pick("revision"), standardEffectiveDate: pick("effectiveDate") };
  if (Object.values(data).some((v) => v && v.length > HEADER_MAX)) return `Isian maksimal ${HEADER_MAX} karakter.`;
  await prisma.evaluationSetting.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  await logAudit({ actorAccountId: auth.id, action: "UPDATE", datasetName: "EvaluationSetting", recordId: "default", reason: "Updated the header of the evaluation standard" });
  revalidatePath(PATH);
}

// One save for one criterion: its definition and note, and for every version its name, who it is for and the text of each grade.
// The grades are the fixed scale of the section; an empty box means no text for that grade.
export async function saveCriterionStandardAction(criterionId: string, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const criterion = await prisma.evaluationCriterion.findUnique({ where: { id: criterionId }, include: { variants: true } });
  if (!criterion) return "Kriteria tidak ditemukan.";
  const scale = criterion.section === "PERFORMANCE" ? PERFORMANCE_SCALE : TATA_NILAI_SCALE;
  const text = (name: string) => String(formData.get(name) ?? "");
  const normalise = (raw: string) => raw.split(/\r?\n/).map((line) => line.trimEnd()).join("\n").trim();
  const definition = normalise(text("definition"));
  const note = normalise(text("note"));

  const known = (await prisma.position.findMany({ select: { jobLevel: true }, distinct: ["jobLevel"] })).map((p) => p.jobLevel);
  const keys = criterion.variants.length > 0 ? criterion.variants.map((v) => v.key) : [DEFAULT_VARIANT];
  const writes: { key: string; label: string; levelsRaw: string | null; subordinates: boolean | null; levels: { score: number; description: string }[] }[] = [];
  for (const key of keys) {
    const levels = levelsFromTexts(scale, (n) => text(`text_${key}_${n}`));
    const problem = standardProblem({ definition, note, levels });
    if (problem) return problem;
    if (criterion.variants.length === 0) {
      writes.push({ key, label: "", levelsRaw: null, subordinates: null, levels });
      continue;
    }
    const label = cleanLabel(formData.get(`label_${key}`));
    if (!label) return "Nama versi wajib diisi.";
    if (label.length > 120) return "Nama versi terlalu panjang (maksimal 120 karakter).";
    const list = parseLevelList(text(`levels_${key}`), known);
    if (!list.ok) return list.error;
    const sub = text(`sub_${key}`);
    writes.push({ key, label, levelsRaw: list.value, subordinates: sub === "yes" ? true : sub === "no" ? false : null, levels });
  }

  await prisma.$transaction([
    prisma.evaluationCriterion.update({ where: { id: criterionId }, data: { definition: definition || null, note: note || null } }),
    ...writes.flatMap((w) => [
      ...(criterion.variants.length > 0
        ? [prisma.evaluationCriterionVariant.update({ where: { criterionId_key: { criterionId, key: w.key } }, data: { label: w.label, appliesToLevels: w.levelsRaw, appliesToSubordinates: w.subordinates } })]
        : []),
      prisma.evaluationCriterionLevel.deleteMany({ where: { criterionId, variantKey: w.key } }),
      prisma.evaluationCriterionLevel.createMany({ data: w.levels.map((l) => ({ criterionId, variantKey: w.key, score: l.score, description: l.description })) }),
    ]),
  ]);
  await logAudit({ actorAccountId: auth.id, action: "UPDATE", datasetName: "EvaluationCriterion", recordId: criterionId, reason: `Updated the standard of criterion "${criterion.label}"` });
  revalidatePath(PATH);
}

// A new version of a criterion's texts. The first time, the texts the criterion already has become "Versi 1".
export async function addCriterionVariantAction(criterionId: string): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const criterion = await prisma.evaluationCriterion.findUnique({ where: { id: criterionId }, include: { variants: true } });
  if (!criterion) return "Kriteria tidak ditemukan.";
  if (criterion.variants.length >= 6) return "Satu kriteria paling banyak 6 versi.";
  const ops = [];
  let next = criterion.variants.length;
  if (criterion.variants.length === 0) {
    const first = `v_${randomBytes(4).toString("hex")}`;
    ops.push(
      prisma.evaluationCriterionVariant.create({ data: { criterionId, key: first, label: "Versi 1", sortOrder: 0 } }),
      prisma.evaluationCriterionLevel.updateMany({ where: { criterionId, variantKey: DEFAULT_VARIANT }, data: { variantKey: first } })
    );
    next = 1;
  }
  ops.push(prisma.evaluationCriterionVariant.create({ data: { criterionId, key: `v_${randomBytes(4).toString("hex")}`, label: `Versi ${next + 1}`, sortOrder: next } }));
  await prisma.$transaction(ops);
  await logAudit({ actorAccountId: auth.id, action: "CREATE", datasetName: "EvaluationCriterion", recordId: criterionId, reason: `Added a version to the standard of "${criterion.label}"` });
  revalidatePath(PATH);
}

export async function removeCriterionVariantAction(criterionId: string, key: string): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const criterion = await prisma.evaluationCriterion.findUnique({ where: { id: criterionId }, include: { variants: true } });
  if (!criterion) return "Kriteria tidak ditemukan.";
  if (criterion.variants.length <= 1) return "Kriteria harus punya minimal satu versi.";
  if (!criterion.variants.some((v) => v.key === key)) return "Versi tidak ditemukan.";
  await prisma.$transaction([
    prisma.evaluationCriterionLevel.deleteMany({ where: { criterionId, variantKey: key } }),
    prisma.evaluationCriterionVariant.delete({ where: { criterionId_key: { criterionId, key } } }),
  ]);
  await logAudit({ actorAccountId: auth.id, action: "DELETE", datasetName: "EvaluationCriterion", recordId: criterionId, reason: `Removed a version from the standard of "${criterion.label}"` });
  revalidatePath(PATH);
}

// ---------- the PDF guideline ----------

export async function uploadGuidelineAction(_prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) return "Pilih file PDF dulu.";
  const bytes = Buffer.from(await entry.arrayBuffer());
  const problem = validateGuidelineFile({ name: entry.name, size: entry.size, head: bytes.subarray(0, 8) });
  if (problem) return problem;

  const storageKey = randomStorageKey("evaluation-guideline", ".pdf");
  await savePrivateFile(storageKey, bytes);
  const file = await prisma.fileObject.create({
    data: {
      storageKey,
      originalFileName: entry.name.slice(0, 150),
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      uploadedByAccountId: auth.id,
      category: "EVALUATION_GUIDELINE",
      confidential: false,
    },
  });
  const old = await prisma.evaluationSetting.findUnique({ where: { id: "default" }, select: { guidelineFileId: true } });
  await prisma.evaluationSetting.upsert({ where: { id: "default" }, update: { guidelineFileId: file.id }, create: { id: "default", guidelineFileId: file.id } });
  if (old?.guidelineFileId) await removeFileQuietly(old.guidelineFileId);
  await logAudit({ actorAccountId: auth.id, action: old?.guidelineFileId ? "UPDATE" : "CREATE", datasetName: "EvaluationSetting", recordId: "default", reason: `${old?.guidelineFileId ? "Replaced" : "Uploaded"} the PDF guideline "${entry.name}"` });
  revalidatePath(PATH);
}

export async function removeGuidelineAction(): Promise<Result> {
  const auth = await adminOnly();
  if ("error" in auth) return auth.error;
  const setting = await prisma.evaluationSetting.findUnique({ where: { id: "default" }, select: { guidelineFileId: true } });
  if (!setting?.guidelineFileId) return;
  await prisma.evaluationSetting.update({ where: { id: "default" }, data: { guidelineFileId: null } });
  await removeFileQuietly(setting.guidelineFileId);
  await logAudit({ actorAccountId: auth.id, action: "DELETE", datasetName: "EvaluationSetting", recordId: "default", reason: "Removed the PDF guideline" });
  revalidatePath(PATH);
}

// The old file and its bytes are removed once nothing points at them (a failure here never blocks the change).
async function removeFileQuietly(fileId: string): Promise<void> {
  try {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId }, select: { storageKey: true } });
    if (!file) return;
    await prisma.fileObject.delete({ where: { id: fileId } });
    await prisma.fileBlob.deleteMany({ where: { storageKey: file.storageKey } });
  } catch {
    // leave it behind rather than fail the upload
  }
}
