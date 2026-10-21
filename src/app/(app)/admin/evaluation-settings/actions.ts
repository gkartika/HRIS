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
