"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/require-session";
import { canManageRecruitment } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { MAX_OPTIONS, parseBulkQuestions, TEMPLATE_PLACEHOLDERS } from "@/lib/recruitment-candidates";
import type { RecruitmentTestForm } from "@/generated/prisma/enums";

type Result = string | undefined;

async function adminId(): Promise<{ id: string } | { error: string }> {
  const session = await requireSession();
  return canManageRecruitment(session) ? { id: session.user.id } : { error: t("common.forbidden") };
}

function done() {
  revalidatePath("/recruitment/settings");
  revalidatePath("/recruitment/settings/tests/[id]", "page");
}

function intField(formData: FormData, name: string): number {
  return Number((formData.get(name) as string) ?? "");
}

// ---------- test catalog ----------

export async function saveTestTypeAction(testTypeId: string | null, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const name = ((formData.get("name") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const passScore = intField(formData, "passScore");
  const timeLimitMinutes = intField(formData, "timeLimitMinutes");
  const sortOrder = intField(formData, "sortOrder") || 0;
  const active = formData.get("active") === "on";
  if (!name || name.length > 80) return "Isi nama tes (maksimal 80 karakter).";
  if (!Number.isInteger(passScore) || passScore < 1 || passScore > 100) return "Nilai lulus harus 1 sampai 100.";
  if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 240) return "Waktu pengerjaan harus 1 sampai 240 menit.";

  const duplicate = await prisma.recruitmentTestType.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(testTypeId ? { id: { not: testTypeId } } : {}) } });
  if (duplicate) return "Sudah ada tes dengan nama itu.";

  if (testTypeId) {
    const current = await prisma.recruitmentTestType.findUnique({ where: { id: testTypeId } });
    if (!current) return "Tes tidak ditemukan.";
    if (current.isGate && !active) return "Tes gerbang (Cultural Fit) tidak boleh dinonaktifkan.";
    await prisma.recruitmentTestType.update({ where: { id: testTypeId }, data: { name, description, passScore, timeLimitMinutes, sortOrder, active } });
  } else {
    const form = formData.get("form") as RecruitmentTestForm;
    if (!["SCALE", "MULTIPLE_CHOICE", "ESSAY"].includes(form)) return "Pilih bentuk soal.";
    await prisma.recruitmentTestType.create({ data: { name, description, form, passScore, timeLimitMinutes, sortOrder, active: true } });
  }
  await logAudit({ actorAccountId: auth.id, action: testTypeId ? "UPDATE" : "CREATE", datasetName: "RecruitmentTestType", recordId: testTypeId, reason: name });
  done();
}

export async function deleteTestTypeAction(testTypeId: string): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const type = await prisma.recruitmentTestType.findUnique({ where: { id: testTypeId }, include: { _count: { select: { candidateTests: true } } } });
  if (!type) return "Tes tidak ditemukan.";
  if (type.isGate) return "Tes gerbang tidak bisa dihapus.";
  if (type._count.candidateTests > 0) return "Tes ini sudah dikerjakan pelamar. Nonaktifkan saja.";
  await prisma.$transaction([
    prisma.recruitmentJobTest.deleteMany({ where: { testTypeId } }),
    prisma.recruitmentTestQuestion.deleteMany({ where: { testTypeId } }),
    prisma.recruitmentTestType.delete({ where: { id: testTypeId } }),
  ]);
  await logAudit({ actorAccountId: auth.id, action: "DELETE", datasetName: "RecruitmentTestType", recordId: testTypeId, reason: type.name });
  done();
}

// ---------- tests per job title ----------

export async function setJobTestAction(jobId: string, testTypeId: string, on: boolean): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const type = await prisma.recruitmentTestType.findUnique({ where: { id: testTypeId }, select: { isGate: true } });
  if (!type || type.isGate) return "Tes ini tidak perlu dipetakan.";
  if (on) {
    await prisma.recruitmentJobTest.upsert({ where: { jobId_testTypeId: { jobId, testTypeId } }, update: {}, create: { jobId, testTypeId } });
  } else {
    await prisma.recruitmentJobTest.deleteMany({ where: { jobId, testTypeId } });
  }
  done();
}

// ---------- question bank ----------

function readQuestion(form: RecruitmentTestForm, formData: FormData): { prompt: string; options: string[]; correctIndex: number | null; reverseScored: boolean } | { error: string } {
  const prompt = ((formData.get("prompt") as string) ?? "").trim();
  if (!prompt) return { error: "Isi teks soal." };
  if (prompt.length > 1500) return { error: "Soal terlalu panjang (maksimal 1500 karakter)." };
  if (form === "MULTIPLE_CHOICE") {
    const options = ((formData.get("options") as string) ?? "")
      .split(/\r?\n/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (options.length < 2 || options.length > MAX_OPTIONS) return { error: `Isi 2 sampai ${MAX_OPTIONS} opsi, satu per baris.` };
    const correct = intField(formData, "correct");
    if (!Number.isInteger(correct) || correct < 1 || correct > options.length) return { error: `Nomor jawaban benar harus 1 sampai ${options.length}.` };
    return { prompt, options, correctIndex: correct - 1, reverseScored: false };
  }
  return { prompt, options: [], correctIndex: null, reverseScored: form === "SCALE" && formData.get("reverse") === "on" };
}

export async function saveQuestionAction(testTypeId: string, questionId: string | null, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const type = await prisma.recruitmentTestType.findUnique({ where: { id: testTypeId }, select: { form: true } });
  if (!type) return "Tes tidak ditemukan.";
  const data = readQuestion(type.form, formData);
  if ("error" in data) return data.error;

  if (questionId) {
    const q = await prisma.recruitmentTestQuestion.findUnique({ where: { id: questionId }, include: { _count: { select: { answers: true } } } });
    if (!q || q.testTypeId !== testTypeId) return "Soal tidak ditemukan.";
    if (q._count.answers > 0) return "Soal ini sudah dijawab pelamar dan tidak bisa diubah. Nonaktifkan lalu buat soal baru.";
    await prisma.recruitmentTestQuestion.update({ where: { id: questionId }, data });
  } else {
    const last = await prisma.recruitmentTestQuestion.aggregate({ where: { testTypeId }, _max: { sortOrder: true } });
    await prisma.recruitmentTestQuestion.create({ data: { testTypeId, sortOrder: (last._max.sortOrder ?? 0) + 1, ...data } });
  }
  await logAudit({ actorAccountId: auth.id, action: questionId ? "UPDATE" : "CREATE", datasetName: "RecruitmentTestQuestion", recordId: questionId, reason: `Question in test ${testTypeId}` });
  done();
}

export async function bulkAddQuestionsAction(testTypeId: string, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const type = await prisma.recruitmentTestType.findUnique({ where: { id: testTypeId }, select: { form: true } });
  if (!type) return "Tes tidak ditemukan.";
  const { questions, errors } = parseBulkQuestions(type.form, (formData.get("lines") as string) ?? "");
  if (errors.length > 0) return `${errors.slice(0, 4).join(" ")}${errors.length > 4 ? ` (dan ${errors.length - 4} kesalahan lain)` : ""} Tidak ada soal yang disimpan.`;
  if (questions.length === 0) return "Tempel minimal satu soal.";
  const last = await prisma.recruitmentTestQuestion.aggregate({ where: { testTypeId }, _max: { sortOrder: true } });
  const start = (last._max.sortOrder ?? 0) + 1;
  await prisma.recruitmentTestQuestion.createMany({
    data: questions.map((q, i) => ({ testTypeId, sortOrder: start + i, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, reverseScored: false })),
  });
  await logAudit({ actorAccountId: auth.id, action: "CREATE", datasetName: "RecruitmentTestQuestion", recordId: testTypeId, reason: `${questions.length} questions pasted` });
  done();
}

export async function toggleQuestionAction(questionId: string): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const q = await prisma.recruitmentTestQuestion.findUnique({ where: { id: questionId }, select: { active: true } });
  if (!q) return "Soal tidak ditemukan.";
  await prisma.recruitmentTestQuestion.update({ where: { id: questionId }, data: { active: !q.active } });
  done();
}

export async function deleteQuestionAction(questionId: string): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const q = await prisma.recruitmentTestQuestion.findUnique({ where: { id: questionId }, include: { _count: { select: { answers: true } } } });
  if (!q) return "Soal tidak ditemukan.";
  if (q._count.answers > 0) return "Soal ini sudah dijawab pelamar. Nonaktifkan saja.";
  await prisma.recruitmentTestQuestion.delete({ where: { id: questionId } });
  await logAudit({ actorAccountId: auth.id, action: "DELETE", datasetName: "RecruitmentTestQuestion", recordId: questionId });
  done();
}

// ---------- interview aspects ----------

export async function saveAspectAction(aspectId: string | null, _prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const label = ((formData.get("label") as string) ?? "").trim();
  if (!label || label.length > 80) return "Isi nama aspek (maksimal 80 karakter).";
  const sortOrder = intField(formData, "sortOrder") || 0;
  if (aspectId) {
    await prisma.recruitmentInterviewAspect.update({ where: { id: aspectId }, data: { label, sortOrder, active: formData.get("active") === "on" } });
  } else {
    const last = await prisma.recruitmentInterviewAspect.aggregate({ _max: { sortOrder: true } });
    await prisma.recruitmentInterviewAspect.create({ data: { label, sortOrder: sortOrder || (last._max.sortOrder ?? 0) + 1, active: true } });
  }
  await logAudit({ actorAccountId: auth.id, action: aspectId ? "UPDATE" : "CREATE", datasetName: "RecruitmentInterviewAspect", recordId: aspectId, reason: label });
  done();
}

export async function deleteAspectAction(aspectId: string): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const used = await prisma.recruitmentInterviewScore.count({ where: { aspectId } });
  if (used > 0) return "Aspek ini sudah dipakai menilai pelamar. Nonaktifkan saja.";
  await prisma.recruitmentInterviewAspect.delete({ where: { id: aspectId } });
  await logAudit({ actorAccountId: auth.id, action: "DELETE", datasetName: "RecruitmentInterviewAspect", recordId: aspectId });
  done();
}

// ---------- numbers and message templates ----------

export async function saveRecruitmentSettingsAction(_prev: Result, formData: FormData): Promise<Result> {
  const auth = await adminId();
  if ("error" in auth) return auth.error;
  const current = await prisma.recruitmentSetting.findUnique({ where: { id: "default" } });
  const num = (name: string, fallback: number) => (formData.has(name) ? intField(formData, name) : fallback);

  const maxInterviewers = num("maxInterviewers", current?.maxInterviewers ?? 4);
  const defaultInterviewers = num("defaultInterviewers", current?.defaultInterviewers ?? 1);
  const retakeDays = num("retakeDays", current?.retakeDays ?? 30);
  const retentionDays = num("retentionDays", current?.retentionDays ?? 30);
  if (!Number.isInteger(maxInterviewers) || maxInterviewers < 1 || maxInterviewers > 8) return "Jumlah pewawancara maksimum harus 1 sampai 8.";
  if (!Number.isInteger(defaultInterviewers) || defaultInterviewers < 1 || defaultInterviewers > maxInterviewers) return "Jumlah pewawancara awal harus 1 sampai jumlah maksimum.";
  if (!Number.isInteger(retakeDays) || retakeDays < 0 || retakeDays > 365) return "Masa tunggu melamar ulang harus 0 sampai 365 hari.";
  if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 730) return "Masa simpan data pelamar harus 7 sampai 730 hari.";

  const emailTemplate = formData.has("invitationEmailTemplate") ? ((formData.get("invitationEmailTemplate") as string) ?? "").trim() : current?.invitationEmailTemplate;
  const waTemplate = formData.has("invitationWaTemplate") ? ((formData.get("invitationWaTemplate") as string) ?? "").trim() : current?.invitationWaTemplate;
  for (const tpl of [emailTemplate, waTemplate]) {
    if (!tpl || tpl.length > 1500) return "Isi template pesan (maksimal 1500 karakter).";
  }
  await prisma.recruitmentSetting.upsert({
    where: { id: "default" },
    update: { maxInterviewers, defaultInterviewers, retakeDays, retentionDays, invitationEmailTemplate: emailTemplate!, invitationWaTemplate: waTemplate! },
    create: { id: "default", maxInterviewers, defaultInterviewers, retakeDays, retentionDays, invitationEmailTemplate: emailTemplate!, invitationWaTemplate: waTemplate! },
  });
  await logAudit({ actorAccountId: auth.id, action: "UPDATE", datasetName: "RecruitmentSetting", recordId: "default", reason: `Allowed placeholders: ${TEMPLATE_PLACEHOLDERS.join(" ")}` });
  done();
}
