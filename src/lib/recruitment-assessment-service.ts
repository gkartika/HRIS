// Prisma-backed rules for the recruitment assessment "Tes Situasi Kerja": importing the master data,
// the rubric approval workflow, the candidate's answers and the deterministic scoring. The pure rules
// (validation, status steps, scoring) are in recruitment-assessment.ts.
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  ASSESSMENT_ENGINE_VERSION,
  ASSESSMENT_GRACE_SECONDS,
  ASSESSMENT_TIME_LIMIT_MINUTES,
  assessmentDeadline,
  isAssessmentExpired,
  isValidTimeLimit,
  ASSESSMENT_TIME_LIMIT_MAX,
  ASSESSMENT_TIME_LIMIT_MIN,
  RubricNotApprovedError,
  isAssessmentOpenFor,
  isOptionOfQuestion,
  isRubricEditable,
  matrixDifferences,
  nextRubricLabel,
  nextRubricStatus,
  scoreAssessment,
  validateAssessmentPackage,
  validateInterpretations,
  validateQuestionBank,
  RISK_SIGNALS,
  type MatrixDifference,
  type RubricAction,
  type RubricStatus,
  type ScoringInterpretation,
} from "@/lib/recruitment-assessment";
import { SOURCE_FILE_SHA256, V32_QUESTION_BANK, V32_RUBRIC_R1 } from "@/lib/recruitment-assessment-sources";
import type { Prisma } from "@/generated/prisma/client";

export type ServiceResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const BANK_FILE = "cbp_v32_candidate_question_bank.json";
const RUBRIC_FILE = "cbp_v32_hr_interpretation_rubric.json";
const OBSERVATION_MAX = 500;

async function recordEvent(db: Prisma.TransactionClient | typeof prisma, rubricId: string, action: string, actorAccountId: string, note?: string | null) {
  await db.recruitmentAssessmentRubricEvent.create({ data: { rubricId, action, actorAccountId, note: note ?? null } });
}

// ---------- master data: import ----------

/**
 * Loads the V3.2 package (question bank + rubric V3.2-R1) into the database, with the rubric as DRAFT.
 * Anything that does not match the approved counts or score matrix stops the import and is reported;
 * nothing is corrected automatically. The text is copied exactly as supplied.
 */
export async function importV32Package(actorAccountId: string): Promise<ServiceResult<{ rubricId: string }>> {
  const check = validateAssessmentPackage(V32_QUESTION_BANK, V32_RUBRIC_R1);
  if (!check.ok) return { ok: false, error: `Paket V3.2 tidak lolos validasi, tidak diimpor: ${check.problems.slice(0, 5).join(" ")}` };
  const bank = V32_QUESTION_BANK;
  const exists = await prisma.recruitmentAssessmentVersion.findUnique({ where: { versionLabel: bank.assessmentVersion }, select: { id: true } });
  if (exists) return { ok: false, error: `Asesmen ${bank.assessmentVersion} sudah diimpor.` };

  const versionId = randomUUID();
  const rubricId = randomUUID();
  const questionIds = new Map<number, string>();
  const optionIds = new Map<string, string>();
  const questionRows = bank.questions.map((q) => {
    const id = randomUUID();
    questionIds.set(q.questionId, id);
    return { id, versionId, questionNo: q.questionId, questionCode: q.questionCode, scenario: q.scenario, prompt: q.prompt };
  });
  const optionRows = bank.questions.flatMap((q) =>
    q.options.map((o) => {
      const id = randomUUID();
      optionIds.set(`${q.questionId}${o.key}`, id);
      return { id, questionId: questionIds.get(q.questionId)!, optionKey: o.key, text: o.text };
    })
  );
  const interpretationRows = V32_RUBRIC_R1.interpretations.map((r) => ({
    rubricId,
    optionId: optionIds.get(`${r.questionId}${r.optionKey}`)!,
    questionNo: r.questionId,
    optionKey: r.optionKey,
    assessmentType: r.assessmentType,
    primaryDimension: r.primaryDimension,
    observation: r.behavioralObservation,
    riskSignal: r.riskSignal,
    requiresControlReview: r.requiresControlReview,
  }));

  await prisma.$transaction(
    async (tx) => {
      await tx.recruitmentAssessmentVersion.create({
        data: {
          id: versionId,
          versionLabel: bank.assessmentVersion,
          name: bank.name,
          organization: bank.organization,
          language: bank.language,
          instructions: bank.instructions,
          closingText: bank.closingText,
          estimatedMinMin: bank.estimatedDurationMinutes.min,
          estimatedMinMax: bank.estimatedDurationMinutes.max,
          sourceSha256: SOURCE_FILE_SHA256[BANK_FILE],
          createdByAccountId: actorAccountId,
        },
      });
      await tx.recruitmentAssessmentQuestion.createMany({ data: questionRows });
      await tx.recruitmentAssessmentOption.createMany({ data: optionRows });
      await tx.recruitmentAssessmentRubric.create({
        data: {
          id: rubricId,
          versionId,
          rubricLabel: V32_RUBRIC_R1.rubricVersion,
          status: "DRAFT",
          riskSignalLegend: V32_RUBRIC_R1.riskSignalLegend as Prisma.InputJsonValue,
          thresholds: V32_RUBRIC_R1.thresholds as Prisma.InputJsonValue,
          sourceNote: V32_RUBRIC_R1.approvalNote,
          sourceSha256: SOURCE_FILE_SHA256[RUBRIC_FILE],
          createdByAccountId: actorAccountId,
        },
      });
      await tx.recruitmentAssessmentInterpretation.createMany({ data: interpretationRows });
      await recordEvent(tx, rubricId, "IMPORTED", actorAccountId, `Diimpor dari paket ${bank.assessmentVersion} (${interpretationRows.length} interpretasi), status DRAFT`);
    },
    { timeout: 60000, maxWait: 15000 }
  );
  await logAudit({ actorAccountId, action: "IMPORT", datasetName: "RecruitmentAssessmentRubric", recordId: rubricId, reason: `${bank.assessmentVersion} / ${V32_RUBRIC_R1.rubricVersion}` });
  return { ok: true, rubricId };
}

// ---------- rubric: reading ----------

export async function listRubrics() {
  return prisma.recruitmentAssessmentRubric.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { version: { select: { versionLabel: true, name: true } }, _count: { select: { submissions: true } } },
  });
}

export async function hasAnyAssessmentVersion(): Promise<boolean> {
  return (await prisma.recruitmentAssessmentVersion.count()) > 0;
}

export async function getRubricDetail(rubricId: string) {
  const rubric = await prisma.recruitmentAssessmentRubric.findUnique({
    where: { id: rubricId },
    include: {
      version: {
        include: { questions: { orderBy: { questionNo: "asc" }, include: { options: { orderBy: { optionKey: "asc" } } } } },
      },
      interpretations: true,
      events: { orderBy: { createdAt: "asc" } },
      _count: { select: { submissions: true } },
    },
  });
  if (!rubric) return null;
  const items = rubric.interpretations.map((i) => ({ questionNo: i.questionNo, optionKey: i.optionKey, riskSignal: i.riskSignal, observation: i.observation, primaryDimension: i.primaryDimension }));
  const differences: MatrixDifference[] = rubric.version.versionLabel === "V3.2" ? matrixDifferences(items) : [];
  const problems = [...validateQuestionBank(bankOf(rubric.version)), ...validateInterpretations(items)];
  return { rubric, differences, problems };
}

function bankOf(version: { questions: { questionNo: number; questionCode: string; scenario: string; prompt: string; options: { optionKey: string; text: string }[] }[]; versionLabel: string; name: string; organization: string; language: string; instructions: string[]; closingText: string; estimatedMinMin: number; estimatedMinMax: number }) {
  return {
    assessmentVersion: version.versionLabel,
    name: version.name,
    organization: version.organization,
    language: version.language,
    instructions: version.instructions,
    closingText: version.closingText,
    estimatedDurationMinutes: { min: version.estimatedMinMin, max: version.estimatedMinMax },
    questions: version.questions.map((q) => ({ questionId: q.questionNo, questionCode: q.questionCode, scenario: q.scenario, prompt: q.prompt, options: q.options.map((o) => ({ key: o.optionKey, text: o.text })) })),
  };
}

export async function getActiveRubric() {
  return prisma.recruitmentAssessmentRubric.findFirst({ where: { status: "ACTIVE" }, include: { version: true } });
}

// ---------- rubric: editing a draft ----------

export interface InterpretationEdit {
  observation: string;
  riskSignal: number;
}

/** Edits one observation and risk signal. Only a DRAFT rubric can be edited; approved content is locked. */
export async function updateInterpretation(actorAccountId: string, interpretationId: string, edit: InterpretationEdit): Promise<ServiceResult> {
  const observation = edit.observation.trim();
  if (!observation) return { ok: false, error: "Observasi perilaku tidak boleh kosong." };
  if (observation.length > OBSERVATION_MAX) return { ok: false, error: `Observasi perilaku maksimal ${OBSERVATION_MAX} karakter.` };
  if (!(RISK_SIGNALS as number[]).includes(edit.riskSignal)) return { ok: false, error: "Nilai risiko harus 0, -1, atau -2." };
  const row = await prisma.recruitmentAssessmentInterpretation.findUnique({ where: { id: interpretationId }, include: { rubric: { select: { id: true, status: true } } } });
  if (!row) return { ok: false, error: "Interpretasi tidak ditemukan." };
  if (!isRubricEditable(row.rubric.status)) return { ok: false, error: "Rubrik ini terkunci dan tidak bisa diubah. Buat revisi untuk mengubahnya." };
  if (row.observation === observation && row.riskSignal === edit.riskSignal) return { ok: true };

  // The status check is repeated inside the write so an approval that lands in between cannot be overwritten.
  const changed = await prisma.$transaction(async (tx) => {
    const draft = await tx.recruitmentAssessmentRubric.count({ where: { id: row.rubric.id, status: "DRAFT" } });
    if (draft !== 1) return false;
    await tx.recruitmentAssessmentInterpretation.update({ where: { id: interpretationId }, data: { observation, riskSignal: edit.riskSignal } });
    const parts: string[] = [];
    if (row.riskSignal !== edit.riskSignal) parts.push(`nilai ${row.riskSignal} menjadi ${edit.riskSignal}`);
    if (row.observation !== observation) parts.push("observasi diubah");
    await recordEvent(tx, row.rubric.id, "EDITED", actorAccountId, `Soal ${row.questionNo}${row.optionKey}: ${parts.join(", ")}`);
    return true;
  });
  if (!changed) return { ok: false, error: "Rubrik ini sudah tidak berstatus draf, perubahan tidak disimpan." };
  await logAudit({ actorAccountId, action: "UPDATE", datasetName: "RecruitmentAssessmentInterpretation", recordId: interpretationId, fieldName: "riskSignal/observation", oldValueMasked: String(row.riskSignal), newValueMasked: String(edit.riskSignal) });
  return { ok: true };
}

// ---------- rubric: approval workflow ----------

export interface RubricActor {
  accountId: string;
}

/**
 * One step of DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> ARCHIVED. The caller has already checked
 * who may take the step (HR Admin submits, only an HR Manager approves or returns). The step is applied
 * with a conditional update, so two people clicking at the same time cannot both succeed.
 */
export async function transitionRubric(rubricId: string, action: RubricAction, actor: RubricActor, note?: string | null): Promise<ServiceResult> {
  const rubric = await prisma.recruitmentAssessmentRubric.findUnique({ where: { id: rubricId }, include: { interpretations: true, version: { select: { id: true, versionLabel: true } } } });
  if (!rubric) return { ok: false, error: "Rubrik tidak ditemukan." };
  const from = rubric.status as RubricStatus;
  const to = nextRubricStatus(from, action);
  if (!to) return { ok: false, error: "Langkah ini tidak bisa dilakukan pada status rubrik saat ini." };
  const trimmedNote = note?.trim() || null;
  if (action === "RETURN" && !trimmedNote) return { ok: false, error: "Tulis alasan pengembalian agar HR Admin tahu apa yang perlu diperbaiki." };

  if (action === "SUBMIT" || action === "APPROVE") {
    const problems = validateInterpretations(rubric.interpretations.map((i) => ({ questionNo: i.questionNo, optionKey: i.optionKey, riskSignal: i.riskSignal, observation: i.observation, primaryDimension: i.primaryDimension })));
    if (problems.length > 0) return { ok: false, error: `Rubrik belum lengkap: ${problems.slice(0, 3).join(" ")}` };
  }
  const now = new Date();
  const data: Prisma.RecruitmentAssessmentRubricUpdateManyMutationInput = { status: to };
  if (action === "SUBMIT") Object.assign(data, { submittedAt: now, submittedByAccountId: actor.accountId, decidedAt: null, decidedByAccountId: null, decisionNote: null });
  if (action === "RETURN") Object.assign(data, { decidedAt: now, decidedByAccountId: actor.accountId, decisionNote: trimmedNote });
  if (action === "APPROVE") Object.assign(data, { decidedAt: now, decidedByAccountId: actor.accountId, decisionNote: trimmedNote, approvedAt: now, approvedByAccountId: actor.accountId });
  if (action === "ACTIVATE") Object.assign(data, { activatedAt: now, activatedByAccountId: actor.accountId });
  if (action === "ARCHIVE") Object.assign(data, { archivedAt: now });

  const done = await prisma.$transaction(async (tx) => {
    if (action === "ACTIVATE") {
      // Only one rubric of a version is ACTIVE: the one in force is archived, its past results are untouched.
      const previous = await tx.recruitmentAssessmentRubric.findMany({ where: { versionId: rubric.version.id, status: "ACTIVE" }, select: { id: true } });
      for (const p of previous) {
        await tx.recruitmentAssessmentRubric.update({ where: { id: p.id }, data: { status: "ARCHIVED", archivedAt: now } });
        await recordEvent(tx, p.id, "ARCHIVED", actor.accountId, `Digantikan oleh ${rubric.rubricLabel}`);
      }
    }
    const res = await tx.recruitmentAssessmentRubric.updateMany({ where: { id: rubricId, status: from }, data });
    if (res.count !== 1) return false;
    await recordEvent(tx, rubricId, action === "SUBMIT" ? "SUBMITTED" : action === "RETURN" ? "RETURNED" : action === "APPROVE" ? "APPROVED" : action === "ACTIVATE" ? "ACTIVATED" : "ARCHIVED", actor.accountId, trimmedNote);
    return true;
  });
  if (!done) return { ok: false, error: "Status rubrik sudah berubah. Muat ulang halaman." };
  await logAudit({
    actorAccountId: actor.accountId,
    action: action === "APPROVE" ? "APPROVE" : action === "RETURN" ? "REJECT" : "UPDATE",
    datasetName: "RecruitmentAssessmentRubric",
    recordId: rubricId,
    fieldName: "status",
    oldValueMasked: from,
    newValueMasked: to,
    reason: trimmedNote,
  });
  return { ok: true };
}

/** A new DRAFT copy of a locked rubric (R1 -> R2). Approved rubrics are never edited in place. */
export async function createRubricRevision(actorAccountId: string, fromRubricId: string): Promise<ServiceResult<{ rubricId: string }>> {
  const source = await prisma.recruitmentAssessmentRubric.findUnique({ where: { id: fromRubricId }, include: { interpretations: true, version: { select: { versionLabel: true } } } });
  if (!source) return { ok: false, error: "Rubrik tidak ditemukan." };
  if (isRubricEditable(source.status as RubricStatus) || source.status === "PENDING_APPROVAL") return { ok: false, error: "Rubrik ini masih bisa diubah, tidak perlu revisi baru." };
  const open = await prisma.recruitmentAssessmentRubric.findFirst({ where: { versionId: source.versionId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } }, select: { rubricLabel: true } });
  if (open) return { ok: false, error: `Sudah ada revisi yang berjalan (${open.rubricLabel}). Selesaikan itu dulu.` };
  const labels = (await prisma.recruitmentAssessmentRubric.findMany({ where: { versionId: source.versionId }, select: { rubricLabel: true } })).map((r) => r.rubricLabel);
  const rubricLabel = nextRubricLabel(source.version.versionLabel, labels);
  const rubricId = randomUUID();
  await prisma.$transaction(
    async (tx) => {
      await tx.recruitmentAssessmentRubric.create({
        data: {
          id: rubricId,
          versionId: source.versionId,
          rubricLabel,
          status: "DRAFT",
          riskSignalLegend: source.riskSignalLegend as Prisma.InputJsonValue,
          thresholds: source.thresholds as Prisma.InputJsonValue,
          sourceNote: `Revisi dari ${source.rubricLabel}`,
          basedOnRubricId: source.id,
          createdByAccountId: actorAccountId,
        },
      });
      await tx.recruitmentAssessmentInterpretation.createMany({
        data: source.interpretations.map((i) => ({
          rubricId,
          optionId: i.optionId,
          questionNo: i.questionNo,
          optionKey: i.optionKey,
          assessmentType: i.assessmentType,
          primaryDimension: i.primaryDimension,
          observation: i.observation,
          riskSignal: i.riskSignal,
          requiresControlReview: i.requiresControlReview,
        })),
      });
      await recordEvent(tx, rubricId, "CREATED", actorAccountId, `Revisi dari ${source.rubricLabel}`);
    },
    { timeout: 60000, maxWait: 15000 }
  );
  await logAudit({ actorAccountId, action: "CREATE", datasetName: "RecruitmentAssessmentRubric", recordId: rubricId, reason: `${rubricLabel} dari ${source.rubricLabel}` });
  return { ok: true, rubricId };
}

// ---------- candidate: taking the assessment ----------

export interface AssessmentQuestion {
  id: string;
  questionNo: number;
  scenario: string;
  prompt: string;
  options: { id: string; key: string; text: string }[];
  /** The option this applicant already chose for this question, if any. */
  chosenOptionId: string | null;
}

// What the page knows before any question is shown. The questions themselves are fetched one at a time
// (loadAssessmentQuestion), so the whole test is never sent to the browser in one piece.
export type AssessmentRunnerState =
  | { kind: "closed"; reason: "NOT_OPEN" | "NO_ACTIVE_RUBRIC" }
  | {
      kind: "ready" | "in-progress" | "done";
      candidateName: string;
      title: string;
      instructions: string[];
      closingText: string;
      estimatedMin: number;
      estimatedMax: number;
      timeLimitMinutes: number;
      questionCount: number;
      /** Question numbers already answered (numbers only, never the answers). */
      answeredNos: number[];
      /** In progress: when the 30 minutes end, by the server's clock. */
      deadlineAtMs: number | null;
      serverNowMs: number;
      /** Finished by the clock with questions left unanswered: closed, not scored. */
      timedOut: boolean;
    };

async function loadCandidateForAssessment(candidateId: string) {
  return prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, fullName: true, status: true, closedAt: true, tests: { select: { status: true, testType: { select: { isGate: true } } } }, assessment: true },
  });
}

export async function loadAssessmentRunner(candidateId: string, now: Date = new Date()): Promise<AssessmentRunnerState | null> {
  await finalizeExpiredAssessments(candidateId, now);
  const candidate = await loadCandidateForAssessment(candidateId);
  if (!candidate) return null;
  const existing = candidate.assessment;
  if (!existing && !isAssessmentOpenFor(candidate)) return { kind: "closed", reason: "NOT_OPEN" };
  let versionId = existing?.versionId;
  if (!versionId) {
    const active = await getActiveRubric();
    if (!active) return { kind: "closed", reason: "NO_ACTIVE_RUBRIC" };
    versionId = active.versionId;
  }
  const version = await prisma.recruitmentAssessmentVersion.findUnique({
    where: { id: versionId },
    include: { _count: { select: { questions: true } } },
  });
  if (!version) return { kind: "closed", reason: "NO_ACTIVE_RUBRIC" };
  const answers = existing ? await prisma.recruitmentAssessmentAnswer.findMany({ where: { submissionId: existing.id }, select: { question: { select: { questionNo: true } } } }) : [];
  const inProgress = existing?.status === "IN_PROGRESS";
  return {
    kind: existing ? (existing.status === "SUBMITTED" ? "done" : "in-progress") : "ready",
    candidateName: candidate.fullName,
    title: version.name,
    instructions: version.instructions,
    closingText: version.closingText,
    estimatedMin: version.estimatedMinMin,
    estimatedMax: version.estimatedMinMax,
    timeLimitMinutes: existing?.timeLimitMinutes ?? version.timeLimitMinutes,
    questionCount: version._count.questions,
    answeredNos: answers.map((a) => a.question.questionNo).sort((a, b) => a - b),
    deadlineAtMs: existing && inProgress ? assessmentDeadline(existing.startedAt, existing.timeLimitMinutes).getTime() : null,
    serverNowMs: now.getTime(),
    timedOut: existing?.status === "SUBMITTED" && existing.screeningStatus === "INCOMPLETE",
  };
}

/** Starts the assessment with the rubric in force now, and the 30 minutes begin. Starting twice returns the same attempt. */
export async function startAssessment(candidateId: string, now: Date = new Date()): Promise<ServiceResult<{ deadlineAtMs: number; serverNowMs: number }>> {
  const candidate = await loadCandidateForAssessment(candidateId);
  if (!candidate) return { ok: false, error: "Akses asesmen tidak valid." };
  let startedAt = candidate.assessment?.startedAt;
  let limit = candidate.assessment?.timeLimitMinutes ?? ASSESSMENT_TIME_LIMIT_MINUTES;
  if (!candidate.assessment) {
    if (!isAssessmentOpenFor(candidate)) return { ok: false, error: "Asesmen ini belum bisa dikerjakan." };
    const active = await getActiveRubric();
    if (!active) return { ok: false, error: "Asesmen belum tersedia. Hubungi HR." };
    try {
      const created = await prisma.recruitmentAssessmentSubmission.create({ data: { candidateId, versionId: active.versionId, rubricId: active.id, startedAt: now, timeLimitMinutes: active.version.timeLimitMinutes } });
      startedAt = created.startedAt;
      limit = created.timeLimitMinutes;
    } catch (e) {
      // Two tabs starting at once: the unique candidate link keeps a single attempt.
      if ((e as { code?: string }).code !== "P2002") throw e;
      const existingAttempt = await prisma.recruitmentAssessmentSubmission.findUniqueOrThrow({ where: { candidateId }, select: { startedAt: true, timeLimitMinutes: true } });
      startedAt = existingAttempt.startedAt;
      limit = existingAttempt.timeLimitMinutes;
    }
  }
  return { ok: true, deadlineAtMs: assessmentDeadline(startedAt!, limit).getTime(), serverNowMs: now.getTime() };
}

/**
 * All questions of the applicant's attempt in the approved order, each with their own earlier choice. They are
 * fetched only after Mulai (never part of the page's own source), and refused once the attempt is closed or
 * the time is up.
 */
export async function loadAssessmentQuestions(candidateId: string, now: Date = new Date()): Promise<ServiceResult<{ questions: AssessmentQuestion[] }>> {
  await finalizeExpiredAssessments(candidateId, now);
  const submission = await prisma.recruitmentAssessmentSubmission.findUnique({ where: { candidateId }, select: { id: true, status: true, versionId: true } });
  if (!submission) return { ok: false, error: "Mulai asesmen dulu." };
  if (submission.status !== "IN_PROGRESS") return { ok: false, error: "Asesmen ini sudah ditutup." };
  const questions = await prisma.recruitmentAssessmentQuestion.findMany({
    where: { versionId: submission.versionId },
    orderBy: { questionNo: "asc" },
    include: { options: { orderBy: { optionKey: "asc" } }, answers: { where: { submissionId: submission.id }, select: { optionId: true } } },
  });
  return {
    ok: true,
    questions: questions.map((question) => ({
      id: question.id,
      questionNo: question.questionNo,
      scenario: question.scenario,
      prompt: question.prompt,
      options: question.options.map((o) => ({ id: o.id, key: o.optionKey, text: o.text })),
      chosenOptionId: question.answers[0]?.optionId ?? null,
    })),
  };
}

/** Saves one answer. The question must belong to this attempt's assessment version, the option to the question, and the time must not be up. */
export async function saveAssessmentAnswer(candidateId: string, questionId: string, optionId: string, now: Date = new Date()): Promise<ServiceResult> {
  const submission = await prisma.recruitmentAssessmentSubmission.findUnique({ where: { candidateId }, select: { id: true, status: true, versionId: true, startedAt: true, timeLimitMinutes: true } });
  if (!submission) return { ok: false, error: "Mulai asesmen dulu." };
  if (submission.status !== "IN_PROGRESS") return { ok: false, error: "Asesmen ini sudah dikirim dan tidak bisa diubah." };
  if (isAssessmentExpired(submission.startedAt, now, ASSESSMENT_GRACE_SECONDS, submission.timeLimitMinutes)) {
    await finalizeExpiredAssessments(candidateId, now);
    return { ok: false, error: "Waktu pengerjaan sudah habis." };
  }
  const question = await prisma.recruitmentAssessmentQuestion.findFirst({ where: { id: questionId, versionId: submission.versionId }, include: { options: { select: { id: true } } } });
  if (!question || !isOptionOfQuestion(question, optionId)) return { ok: false, error: "Jawaban tidak valid." };
  await prisma.recruitmentAssessmentAnswer.upsert({
    where: { submissionId_questionId: { submissionId: submission.id, questionId } },
    create: { submissionId: submission.id, questionId, optionId },
    update: { optionId },
  });
  return { ok: true };
}

/**
 * The one final submission. Validates on the server that all 20 questions are answered, claims the attempt
 * with a conditional update (a second click or tab finds it already claimed), then writes the score and
 * an immutable snapshot of every interpretation used, all in one transaction.
 * When the 30 minutes are over and questions are still open, the attempt is closed without a score
 * (INCOMPLETE): the answers given stay saved, nothing is guessed for the rest.
 */
export async function submitAssessment(candidateId: string, now: Date = new Date()): Promise<ServiceResult<{ already?: boolean; timedOut?: boolean }>> {
  const submission = await prisma.recruitmentAssessmentSubmission.findUnique({
    where: { candidateId },
    include: {
      answers: true,
      rubric: { select: { id: true, status: true, approvedAt: true } },
      version: { include: { questions: { orderBy: { questionNo: "asc" }, include: { options: true } } } },
    },
  });
  if (!submission) return { ok: false, error: "Mulai asesmen dulu." };
  if (submission.status === "SUBMITTED") return { ok: true, already: true };

  const interpretations = await prisma.recruitmentAssessmentInterpretation.findMany({ where: { rubricId: submission.rubricId } });
  const byOption = new Map<string, ScoringInterpretation>(interpretations.map((i) => [i.optionId, { id: i.id, optionId: i.optionId, questionNo: i.questionNo, optionKey: i.optionKey, assessmentType: i.assessmentType, primaryDimension: i.primaryDimension, observation: i.observation, riskSignal: i.riskSignal, requiresControlReview: i.requiresControlReview }]));

  let result;
  try {
    result = scoreAssessment({
      rubric: { id: submission.rubric.id, status: submission.rubric.status as RubricStatus, approvedAt: submission.rubric.approvedAt },
      questions: submission.version.questions.map((q) => ({ id: q.id, questionNo: q.questionNo })),
      answers: new Map(submission.answers.map((a) => [a.questionId, a.optionId])),
      interpretations: byOption,
    });
  } catch (e) {
    if (e instanceof RubricNotApprovedError) return { ok: false, error: "Asesmen belum bisa dinilai. Hubungi HR." };
    throw e;
  }
  if (result.status === "INCOMPLETE") {
    if (!isAssessmentExpired(submission.startedAt, now, ASSESSMENT_GRACE_SECONDS, submission.timeLimitMinutes)) {
      return { ok: false, error: `Masih ada ${submission.version.questions.length - result.answered} soal yang belum dijawab (nomor ${result.missingQuestionNos.join(", ")}).` };
    }
    // Time is up: close it as it stands, with no score.
    const closed = await prisma.recruitmentAssessmentSubmission.updateMany({
      where: { id: submission.id, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt: now, screeningStatus: "INCOMPLETE", engineVersion: ASSESSMENT_ENGINE_VERSION },
    });
    return closed.count === 1 ? { ok: true, timedOut: true } : { ok: true, already: true };
  }
  const scored = result;

  const questionById = new Map(submission.version.questions.map((q) => [q.id, q]));
  const claimed = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.recruitmentAssessmentSubmission.updateMany({ where: { id: submission.id, status: "IN_PROGRESS" }, data: { status: "SUBMITTED", submittedAt: now } });
      if (claim.count !== 1) return false;
      await tx.recruitmentAssessmentResultItem.createMany({
        data: scored.items.map((item) => {
          const question = questionById.get(item.questionId)!;
          const option = question.options.find((o) => o.id === item.optionId)!;
          return {
            submissionId: submission.id,
            questionNo: item.questionNo,
            rubricId: item.rubricId,
            interpretationId: item.interpretation.id,
            optionKey: item.interpretation.optionKey,
            questionText: `${question.scenario}\n\n${question.prompt}`,
            optionText: option.text,
            primaryDimension: item.interpretation.primaryDimension,
            observation: item.interpretation.observation,
            riskSignal: item.interpretation.riskSignal,
            assessmentType: item.interpretation.assessmentType,
            requiresControlReview: item.interpretation.requiresControlReview,
          };
        }),
      });
      await tx.recruitmentAssessmentSubmission.update({ where: { id: submission.id }, data: { scoredAt: now, totalScore: scored.total, screeningStatus: scored.status, engineVersion: ASSESSMENT_ENGINE_VERSION } });
      return true;
    },
    { timeout: 30000, maxWait: 10000 }
  );
  return claimed ? { ok: true } : { ok: true, already: true };
}

/**
 * Closes every attempt whose 30 minutes are over (the applicant left the page or lost connection): scored if all
 * 20 were answered, otherwise closed without a score. Runs every night and whenever that applicant opens the page.
 */
export async function finalizeExpiredAssessments(candidateId?: string, now: Date = new Date()): Promise<number> {
  // The limit differs per attempt, so first take everything older than the shortest allowed limit, then check each one's own.
  const cutoff = new Date(now.getTime() - (ASSESSMENT_TIME_LIMIT_MIN * 60 + ASSESSMENT_GRACE_SECONDS) * 1000);
  const open = await prisma.recruitmentAssessmentSubmission.findMany({
    where: { status: "IN_PROGRESS", startedAt: { lt: cutoff }, ...(candidateId ? { candidateId } : {}) },
    select: { candidateId: true, startedAt: true, timeLimitMinutes: true },
  });
  const due = open.filter((x) => isAssessmentExpired(x.startedAt, now, ASSESSMENT_GRACE_SECONDS, x.timeLimitMinutes));
  for (const x of due) await submitAssessment(x.candidateId, now);
  return due.length;
}

/** Admin Rekrutmen sets how long applicants have. Attempts already running keep the limit they started with. */
export async function updateAssessmentTimeLimit(actorAccountId: string, versionId: string, minutes: number): Promise<ServiceResult> {
  if (!isValidTimeLimit(minutes)) return { ok: false, error: `Waktu harus bilangan bulat ${ASSESSMENT_TIME_LIMIT_MIN} sampai ${ASSESSMENT_TIME_LIMIT_MAX} menit.` };
  const version = await prisma.recruitmentAssessmentVersion.findUnique({ where: { id: versionId }, select: { id: true, timeLimitMinutes: true } });
  if (!version) return { ok: false, error: "Asesmen tidak ditemukan." };
  if (version.timeLimitMinutes === minutes) return { ok: true };
  await prisma.recruitmentAssessmentVersion.update({ where: { id: versionId }, data: { timeLimitMinutes: minutes } });
  await logAudit({ actorAccountId, action: "UPDATE", datasetName: "RecruitmentAssessmentVersion", recordId: versionId, fieldName: "timeLimitMinutes", oldValueMasked: String(version.timeLimitMinutes), newValueMasked: String(minutes) });
  return { ok: true };
}

// ---------- HR: reading a result ----------

/** Everything the HR scoring view shows, read only from the stored snapshots. */
export async function loadAssessmentResult(candidateId: string) {
  const submission = await prisma.recruitmentAssessmentSubmission.findUnique({
    where: { candidateId },
    include: {
      version: { select: { versionLabel: true, name: true, sourceSha256: true } },
      rubric: { select: { id: true, rubricLabel: true, approvedAt: true, approvedByAccountId: true, sourceSha256: true } },
      items: { orderBy: { questionNo: "asc" } },
      _count: { select: { answers: true } },
    },
  });
  if (!submission) return null;
  return submission;
}

/** What the applicant's test page shows about the assessment: nothing, a link to it, or that it is done. */
export async function assessmentEntryState(candidateId: string): Promise<"none" | "open" | "in-progress" | "done"> {
  const candidate = await loadCandidateForAssessment(candidateId);
  if (!candidate) return "none";
  if (candidate.assessment) return candidate.assessment.status === "SUBMITTED" ? "done" : "in-progress";
  if (!isAssessmentOpenFor(candidate)) return "none";
  return (await prisma.recruitmentAssessmentRubric.count({ where: { status: "ACTIVE" } })) > 0 ? "open" : "none";
}

/** The assessments with their time limit, for the settings card on the rubric page. */
export async function listAssessmentVersions() {
  return prisma.recruitmentAssessmentVersion.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, versionLabel: true, name: true, timeLimitMinutes: true } });
}
