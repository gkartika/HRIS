// Prisma-backed rules for the applicant pipeline: settings, test catalog, creating an
// applicant, the test engine (start / answer / submit / time limit / grading) and
// clean-up of old data. Interviews, offers and the hire hooks are in recruitment-flow.ts.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/account-tokens";
import { logAudit } from "@/lib/audit";
import { randomStorageKey } from "@/lib/file-storage";
import { canRequestAcceptFulfillment, computeFulfillmentCounts } from "@/lib/recruitment";
import {
  ASSESSMENT_NOT_ACTIVE_PROBLEM,
  CLOSED_WITHOUT_HIRE_STATUSES,
  ESSAY_MAX_CHARS,
  ESSAY_MIN_CHARS,
  canStartTest,
  deriveStatusFromTests,
  fileExtension,
  isExpired,
  isPassing,
  optionDisplayOrder,
  planTestsForJob,
  possibleTestsForJob,
  testIdsForRequest,
  scoreTest,
  testDisplayName,
} from "@/lib/recruitment-candidates";
import type { Prisma } from "@/generated/prisma/client";
import type {
  RecruitmentCandidateSource,
  RecruitmentCandidateStatus,
  RecruitmentOpenFor,
  RecruitmentRequestStatus,
  RecruitmentTestForm,
} from "@/generated/prisma/enums";

export const FULFILLABLE_STATUSES: RecruitmentRequestStatus[] = ["APPROVED", "RECRUITMENT_IN_PROGRESS", "PARTIALLY_FILLED"];

// ---------- settings ----------

export async function getRecruitmentSettings() {
  return (
    (await prisma.recruitmentSetting.findUnique({ where: { id: "default" } })) ??
    (await prisma.recruitmentSetting.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }))
  );
}

// ---------- test catalog and plan ----------

export interface PlanContext {
  types: {
    id: string;
    name: string;
    form: RecruitmentTestForm;
    passScore: number;
    timeLimitMinutes: number;
    isGate: boolean;
    description: string | null;
    variantGroup: string | null;
    monospace: boolean;
    excellentScore: number | null;
    sortOrder: number;
    active: boolean;
    activeQuestions: number;
  }[];
  jobTestIds: Map<string, string[]>;
  /** Tes Situasi Kerja, the first test of every applicant: null while no rubric is active (nobody can take it then). */
  assessment: { timeLimitMinutes: number; questionCount: number } | null;
}

export async function loadPlanContext(): Promise<PlanContext> {
  const [types, jobTests, activeRubric] = await Promise.all([
    prisma.recruitmentTestType.findMany({
      orderBy: [{ isGate: "desc" }, { sortOrder: "asc" }],
      include: { _count: { select: { questions: { where: { active: true } } } } },
    }),
    prisma.recruitmentJobTest.findMany({ select: { jobId: true, testTypeId: true } }),
    prisma.recruitmentAssessmentRubric.findFirst({
      where: { status: "ACTIVE" },
      select: { version: { select: { timeLimitMinutes: true, _count: { select: { questions: true } } } } },
    }),
  ]);
  const jobTestIds = new Map<string, string[]>();
  for (const jt of jobTests) jobTestIds.set(jt.jobId, [...(jobTestIds.get(jt.jobId) ?? []), jt.testTypeId]);
  return {
    types: types.map((t) => ({
      id: t.id,
      name: t.name,
      form: t.form,
      passScore: t.passScore,
      timeLimitMinutes: t.timeLimitMinutes,
      isGate: t.isGate,
      description: t.description,
      variantGroup: t.variantGroup,
      monospace: t.monospace,
      excellentScore: t.excellentScore,
      sortOrder: t.sortOrder,
      active: t.active,
      activeQuestions: t._count.questions,
    })),
    jobTestIds,
    assessment: activeRubric ? { timeLimitMinutes: activeRubric.version.timeLimitMinutes, questionCount: activeRubric.version._count.questions } : null,
  };
}

// The part of a request that decides its tests: its own pick, or else the job title's.
export interface RequestTestChoice {
  jobId: string | null;
  testsCustomized: boolean;
  testTypeIds: string[];
}

function testIdsOf(ctx: PlanContext, request: RequestTestChoice): string[] {
  return testIdsForRequest(request, request.jobId ? ctx.jobTestIds.get(request.jobId) ?? [] : []);
}

// The tests ONE applicant will take (one set from each group of alternatives).
export function plannedTests(ctx: PlanContext, request: RequestTestChoice, usage?: Map<string, number>) {
  return planTestsForJob(ctx.types, testIdsOf(ctx, request), { usage });
}

// Every test an applicant for this vacancy could be given, all alternatives included.
export function possibleTests(ctx: PlanContext, request: RequestTestChoice) {
  return possibleTestsForJob(ctx.types, testIdsOf(ctx, request));
}

// What stops a request from taking applicants right now (empty = ready).
export function readinessProblems(
  ctx: PlanContext,
  request: RequestTestChoice & { status: RecruitmentRequestStatus; accessCode: string | null; requestedHeadcount: number; openFor: RecruitmentOpenFor; heldAt?: Date | null; publicDescription: string | null },
  filled: number
): string[] {
  const problems: string[] = [];
  if (request.heldAt) problems.push("Permintaan sedang ditahan.");
  if (!request.publicDescription?.trim()) problems.push("Detail lowongan belum ditulis.");
  if (!request.jobId) problems.push("Jabatan pada permintaan ini belum ditentukan.");
  if (!canRequestAcceptFulfillment(request.status)) problems.push("Permintaan belum disetujui atau sudah ditutup.");
  if (computeFulfillmentCounts(request.requestedHeadcount, filled).isFull) problems.push("Permintaan sudah terisi penuh.");
  if (!ctx.assessment) problems.push(ASSESSMENT_NOT_ACTIVE_PROBLEM);
  if (request.jobId) {
    for (const t of possibleTests(ctx, request)) {
      if (t.activeQuestions === 0) problems.push(`Tes ${t.name} belum punya soal.`);
    }
  }
  if ((request.openFor === "EXTERNAL" || request.openFor === "BOTH") && !request.accessCode) {
    problems.push("Kode akses untuk pelamar eksternal belum dibuat.");
  }
  return problems;
}

// Vacancies a person may apply for: published for that audience, still taking people and
// with every required test ready.
export async function listOpenVacancies(kind: "EXTERNAL" | "INTERNAL") {
  const [requests, ctx] = await Promise.all([
    prisma.recruitmentRequest.findMany({
      where: { status: { in: FULFILLABLE_STATUSES }, openFor: { in: [kind, "BOTH"] }, jobId: { not: null } },
      include: { job: true, department: true, _count: { select: { fulfillments: true } } },
      orderBy: { requestDate: "desc" },
    }),
    loadPlanContext(),
  ]);
  return requests.filter((r) => readinessProblems(ctx, r, r._count.fulfillments).length === 0);
}

// ---------- applicants ----------

export interface NewCandidateInput {
  requestId: string;
  jobId: string;
  testsCustomized: boolean;
  testTypeIds: string[];
  source: RecruitmentCandidateSource;
  employeeId?: string | null;
  fullName: string;
  email: string;
  mobileNumber: string | null;
  cv?: { name: string; type: string; data: Buffer } | null;
  /** One optional supporting document (diploma, certificate, portfolio). */
  supporting?: { name: string; type: string; data: Buffer } | null;
}

// Creates the applicant, their CV and one row per test they must take. External
// applicants get a private link token (returned once, only its hash is stored).
export async function createCandidate(input: NewCandidateInput): Promise<{ id: string; rawToken: string | null }> {
  const ctx = await loadPlanContext();
  // How often each alternative set was handed out so far, so Set A and Set B stay balanced.
  const alternativeIds = ctx.types.filter((t) => t.variantGroup).map((t) => t.id);
  const handedOut = alternativeIds.length
    ? await prisma.recruitmentCandidateTest.groupBy({ by: ["testTypeId"], where: { testTypeId: { in: alternativeIds } }, _count: { _all: true } })
    : [];
  const planned = plannedTests(ctx, { jobId: input.jobId, testsCustomized: input.testsCustomized, testTypeIds: input.testTypeIds }, new Map(handedOut.map((g) => [g.testTypeId, g._count._all])));
  const rawToken = input.source === "EXTERNAL" ? randomBytes(24).toString("base64url") : null;
  // The two uploads (up to 2 MB each) are the slow part, so they are stored first on their own, NOT inside a
  // transaction: an interactive transaction times out after 5 seconds, which a slow connection easily passes
  // with two files, and the applicant then saw "page cannot be loaded". The applicant row with its tests is a
  // single nested create (atomic by itself). If it fails, the stored files are removed again.
  const storedKeys: string[] = [];
  const storedFileIds: string[] = [];
  const storeFile = async (upload: { name: string; type: string; data: Buffer } | null | undefined, prefix: string): Promise<string | null> => {
    if (!upload) return null;
    const storageKey = randomStorageKey(prefix, fileExtension(upload.name) || ".bin");
    await prisma.fileBlob.create({ data: { storageKey, data: new Uint8Array(upload.data) } });
    storedKeys.push(storageKey);
    const file = await prisma.recruitmentFile.create({
      data: { storageKey, fileName: upload.name.slice(0, 150), mimeType: upload.type || "application/octet-stream", sizeBytes: upload.data.length },
    });
    storedFileIds.push(file.id);
    return file.id;
  };
  try {
    const cvFileId = await storeFile(input.cv, "recruitment-cv");
    const supportingFileId = await storeFile(input.supporting, "recruitment-doc");
    const candidate = await prisma.recruitmentCandidate.create({
      data: {
        requestId: input.requestId,
        source: input.source,
        employeeId: input.employeeId ?? null,
        fullName: input.fullName,
        email: input.email,
        mobileNumber: input.mobileNumber,
        cvFileId,
        supportingFileId,
        tokenHash: rawToken ? hashToken(rawToken) : null,
        tests: { create: planned.map((t, i) => ({ testTypeId: t.id, sortOrder: i })) },
      },
    });
    return { id: candidate.id, rawToken };
  } catch (error) {
    // Best effort: leave no orphan files behind, then let the caller report the failure.
    await prisma.recruitmentFile.deleteMany({ where: { id: { in: storedFileIds } } }).catch(() => undefined);
    await prisma.fileBlob.deleteMany({ where: { storageKey: { in: storedKeys } } }).catch(() => undefined);
    throw error;
  }
}

export async function findCandidateByToken(rawToken: string) {
  if (!rawToken) return null;
  return prisma.recruitmentCandidate.findUnique({ where: { tokenHash: hashToken(rawToken) } });
}

// Moves the applicant to a new status and stamps when. Leaving without a hire also
// records the close time (used for the re-apply wait and the clean-up of old data).
export async function setCandidateStatus(
  db: Prisma.TransactionClient | typeof prisma,
  candidateId: string,
  status: RecruitmentCandidateStatus,
  extra: { closeReason?: string | null } = {}
) {
  const closes = CLOSED_WITHOUT_HIRE_STATUSES.includes(status);
  await db.recruitmentCandidate.update({
    where: { id: candidateId },
    data: {
      status,
      statusChangedAt: new Date(),
      ...(closes ? { closedAt: new Date(), closeReason: extra.closeReason ?? null } : {}),
    },
  });
}

// ---------- test engine ----------

export type EngineResult = { ok: true } | { ok: false; error: string };

// Brings the applicant's overall status in line with their tests.
export async function refreshCandidateStatus(candidateId: string): Promise<void> {
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { status: true, assessment: { select: { status: true } }, tests: { select: { status: true, passed: true, testType: { select: { name: true } } } } },
  });
  if (!candidate || (candidate.status !== "TESTING" && candidate.status !== "AWAITING_REVIEW")) return;
  const next = deriveStatusFromTests(candidate.tests, candidate.assessment?.status === "SUBMITTED");
  if (next === candidate.status) return;
  if (next === "TEST_FAILED") {
    const failed = candidate.tests.filter((t) => t.passed === false).map((t) => t.testType.name);
    await setCandidateStatus(prisma, candidateId, "TEST_FAILED", { closeReason: `Tidak lolos tes: ${failed.join(", ")}` });
  } else {
    await setCandidateStatus(prisma, candidateId, next);
  }
}

export async function startCandidateTest(candidateId: string, testId: string, now: Date = new Date()): Promise<EngineResult> {
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: {
      status: true,
      assessment: { select: { status: true } },
      tests: { orderBy: { sortOrder: "asc" }, select: { id: true, status: true, passed: true, testTypeId: true, testType: { select: { timeLimitMinutes: true } } } },
    },
  });
  if (!candidate || candidate.status !== "TESTING") return { ok: false, error: "Tes ini tidak bisa dimulai." };
  const index = candidate.tests.findIndex((t) => t.id === testId);
  if (index < 0) return { ok: false, error: "Tes tidak ditemukan." };
  if (candidate.tests.some((t) => t.status === "IN_PROGRESS")) return { ok: false, error: "Selesaikan tes yang sedang berjalan dulu." };
  const assessmentDone = candidate.assessment?.status === "SUBMITTED";
  if (!assessmentDone) return { ok: false, error: "Kerjakan Tes Situasi Kerja dulu." };
  if (!canStartTest(candidate.tests, index, assessmentDone)) return { ok: false, error: "Tes ini belum bisa dimulai." };
  const test = candidate.tests[index];
  const questions = await prisma.recruitmentTestQuestion.count({ where: { testTypeId: test.testTypeId, active: true } });
  if (questions === 0) return { ok: false, error: "Tes ini belum punya soal. Hubungi HR." };
  const deadlineAt = new Date(now.getTime() + test.testType.timeLimitMinutes * 60 * 1000);
  const res = await prisma.recruitmentCandidateTest.updateMany({
    where: { id: testId, status: "NOT_STARTED" },
    data: { status: "IN_PROGRESS", startedAt: now, deadlineAt },
  });
  return res.count === 1 ? { ok: true } : { ok: false, error: "Tes ini sudah dimulai." };
}

export type AnswerValue = { index?: number; text?: string };

export async function saveCandidateAnswer(
  candidateId: string,
  testId: string,
  questionId: string,
  value: AnswerValue,
  now: Date = new Date()
): Promise<EngineResult & { expired?: boolean }> {
  const test = await prisma.recruitmentCandidateTest.findFirst({
    where: { id: testId, candidateId },
    select: { id: true, status: true, deadlineAt: true, testTypeId: true, testType: { select: { form: true } } },
  });
  if (!test || test.status !== "IN_PROGRESS") return { ok: false, error: "Tes tidak sedang berjalan." };
  if (isExpired(test.deadlineAt, now)) {
    await submitCandidateTest(candidateId, testId, { auto: true, now });
    return { ok: false, error: "Waktu habis. Jawaban Anda sudah dikirim otomatis.", expired: true };
  }
  const question = await prisma.recruitmentTestQuestion.findFirst({
    where: { id: questionId, testTypeId: test.testTypeId, active: true },
    select: { options: true },
  });
  if (!question) return { ok: false, error: "Soal tidak ditemukan." };

  const form = test.testType.form;
  let data: { answerIndex: number | null; answerText: string | null };
  if (form === "ESSAY") {
    const text = (value.text ?? "").slice(0, ESSAY_MAX_CHARS);
    data = { answerIndex: null, answerText: text };
  } else if (form === "SCALE") {
    if (!Number.isInteger(value.index) || value.index! < 1 || value.index! > 5) return { ok: false, error: "Jawaban tidak valid." };
    data = { answerIndex: value.index!, answerText: null };
  } else {
    if (!Number.isInteger(value.index) || value.index! < 0 || value.index! >= question.options.length) return { ok: false, error: "Jawaban tidak valid." };
    data = { answerIndex: value.index!, answerText: null };
  }
  await prisma.recruitmentCandidateAnswer.upsert({
    where: { candidateTestId_questionId: { candidateTestId: testId, questionId } },
    update: data,
    create: { candidateTestId: testId, questionId, ...data },
  });
  return { ok: true };
}

// Hands in the test (or closes it when time ran out) and grades it. A scale or
// multiple-choice test gets its score and pass/fail at once; an essay waits for a
// reviewer, unless it was left completely blank.
export async function submitCandidateTest(
  candidateId: string,
  testId: string,
  opts: { auto: boolean; now?: Date }
): Promise<EngineResult> {
  const now = opts.now ?? new Date();
  const test = await prisma.recruitmentCandidateTest.findFirst({
    where: { id: testId, candidateId },
    include: { testType: true, answers: true },
  });
  if (!test) return { ok: false, error: "Tes tidak ditemukan." };
  if (test.status === "SUBMITTED") return { ok: true };
  if (test.status !== "IN_PROGRESS") return { ok: false, error: "Tes belum dimulai." };

  const questions = await prisma.recruitmentTestQuestion.findMany({
    where: { testTypeId: test.testTypeId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const answerOf = new Map(test.answers.map((a) => [a.questionId, a]));

  if (!opts.auto) {
    if (test.testType.form === "ESSAY") {
      const short = questions.some((q) => (answerOf.get(q.id)?.answerText ?? "").trim().length < ESSAY_MIN_CHARS);
      if (short) return { ok: false, error: `Jawaban esai minimal ${ESSAY_MIN_CHARS} karakter untuk tiap soal.` };
    } else if (questions.some((q) => answerOf.get(q.id)?.answerIndex == null)) {
      return { ok: false, error: "Masih ada soal yang belum dijawab." };
    }
  }

  let scorePercent: number | null = null;
  let passed: boolean | null = null;
  let reviewNote: string | null = null;
  if (test.testType.form === "ESSAY") {
    const blank = questions.every((q) => (answerOf.get(q.id)?.answerText ?? "").trim().length === 0);
    if (blank) {
      passed = false;
      reviewNote = "Tidak ada jawaban sampai waktu habis.";
    }
  } else {
    scorePercent = scoreTest(
      test.testType.form,
      questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex, reverseScored: q.reverseScored })),
      new Map(questions.map((q) => [q.id, answerOf.get(q.id)?.answerIndex ?? null]))
    );
    passed = isPassing(scorePercent, test.testType.passScore);
  }

  const res = await prisma.recruitmentCandidateTest.updateMany({
    where: { id: testId, status: "IN_PROGRESS" },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      autoSubmitted: opts.auto,
      scorePercent,
      passed,
      passScoreSnapshot: test.testType.form === "ESSAY" ? null : test.testType.passScore,
      ...(reviewNote ? { reviewNote, reviewedAt: now } : {}),
    },
  });
  if (res.count === 1) await refreshCandidateStatus(candidateId);
  return { ok: true };
}

// Closes every test whose time ran out (applicant left the page, lost connection ...).
// Run every night and whenever that applicant's test page is opened.
export async function finalizeExpiredTests(candidateId?: string, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 5 * 1000);
  const due = await prisma.recruitmentCandidateTest.findMany({
    where: { status: "IN_PROGRESS", deadlineAt: { lt: cutoff }, ...(candidateId ? { candidateId } : {}) },
    select: { id: true, candidateId: true },
  });
  for (const t of due) await submitCandidateTest(t.candidateId, t.id, { auto: true, now });
  return due.length;
}

// What the test page shows. Never includes correct answers.
export interface RunnerTest {
  id: string;
  name: string;
  /** Instructions shown before the test starts. */
  description: string | null;
  form: RecruitmentTestForm;
  timeLimitMinutes: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  questionCount: number;
  canStart: boolean;
}
// Tes Situasi Kerja, shown as the first step of the list. It is taken on its own page.
export interface RunnerAssessment {
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  /** Closed by the clock with questions left: not scored, but the other tests open. */
  timedOut: boolean;
  questionCount: number;
  timeLimitMinutes: number;
  /** Not started and no rubric in force: nobody can start it until HR activates one. */
  unavailable: boolean;
}
export interface RunnerState {
  candidate: { id: string; fullName: string; status: RecruitmentCandidateStatus; positionTitle: string };
  assessment: RunnerAssessment;
  tests: RunnerTest[];
  active: {
    testId: string;
    form: RecruitmentTestForm;
    monospace: boolean;
    deadlineAtMs: number;
    // Options come with their ORIGINAL number: that number is what an answer is saved and graded by,
    // while the list is already in this applicant's own order.
    questions: { id: string; prompt: string; options: { index: number; text: string }[] }[];
    answers: Record<string, { index?: number; text?: string }>;
  } | null;
}

export async function loadRunnerState(candidateId: string, now: Date = new Date()): Promise<RunnerState | null> {
  await finalizeExpiredTests(candidateId, now);
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    include: {
      request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } },
      assessment: { select: { status: true, screeningStatus: true, timeLimitMinutes: true, version: { select: { _count: { select: { questions: true } } } } } },
      tests: {
        orderBy: { sortOrder: "asc" },
        include: { testType: true, answers: true },
      },
    },
  });
  if (!candidate) return null;

  let assessment: RunnerAssessment;
  if (candidate.assessment) {
    assessment = {
      status: candidate.assessment.status,
      timedOut: candidate.assessment.status === "SUBMITTED" && candidate.assessment.screeningStatus === "INCOMPLETE",
      questionCount: candidate.assessment.version._count.questions,
      timeLimitMinutes: candidate.assessment.timeLimitMinutes,
      unavailable: false,
    };
  } else {
    const rubric = await prisma.recruitmentAssessmentRubric.findFirst({
      where: { status: "ACTIVE" },
      select: { version: { select: { timeLimitMinutes: true, _count: { select: { questions: true } } } } },
    });
    assessment = {
      status: "NOT_STARTED",
      timedOut: false,
      questionCount: rubric?.version._count.questions ?? 0,
      timeLimitMinutes: rubric?.version.timeLimitMinutes ?? 0,
      unavailable: !rubric,
    };
  }
  const assessmentDone = assessment.status === "SUBMITTED";

  const counts = await prisma.recruitmentTestQuestion.groupBy({
    by: ["testTypeId"],
    where: { active: true, testTypeId: { in: candidate.tests.map((t) => t.testTypeId) } },
    _count: { _all: true },
  });
  const countOf = new Map(counts.map((c) => [c.testTypeId, c._count._all]));

  const tests: RunnerTest[] = candidate.tests.map((t, i) => ({
    id: t.id,
    name: testDisplayName(t.testType),
    description: t.testType.description,
    form: t.testType.form,
    timeLimitMinutes: t.testType.timeLimitMinutes,
    status: t.status,
    questionCount: countOf.get(t.testTypeId) ?? 0,
    canStart: candidate.status === "TESTING" && !candidate.tests.some((x) => x.status === "IN_PROGRESS") && canStartTest(candidate.tests, i, assessmentDone),
  }));

  let active: RunnerState["active"] = null;
  const running = candidate.tests.find((t) => t.status === "IN_PROGRESS");
  if (running && running.deadlineAt) {
    const rows = await prisma.recruitmentTestQuestion.findMany({
      where: { testTypeId: running.testTypeId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, prompt: true, options: true },
    });
    const questions = rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      options: optionDisplayOrder(r.options, `${running.id}:${r.id}`, running.testType.shuffleOptions).map((index) => ({ index, text: r.options[index] })),
    }));
    active = {
      testId: running.id,
      form: running.testType.form,
      monospace: running.testType.monospace,
      deadlineAtMs: running.deadlineAt.getTime(),
      questions,
      answers: Object.fromEntries(
        running.answers.map((a) => [a.questionId, { index: a.answerIndex ?? undefined, text: a.answerText ?? undefined }])
      ),
    };
  }

  return {
    candidate: {
      id: candidate.id,
      fullName: candidate.fullName,
      status: candidate.status,
      positionTitle: `${candidate.request.job?.jobTitle ?? "Lowongan"} · ${candidate.request.department.unitName}`,
    },
    assessment,
    tests,
    active,
  };
}

// ---------- clean-up of old data ----------

export interface PurgePreview {
  count: number;
  withCv: number;
  cutoff: Date;
  sample: { fullName: string; status: RecruitmentCandidateStatus; closedAt: Date | null }[];
}

function purgeWhere(cutoff: Date): Prisma.RecruitmentCandidateWhereInput {
  // HIRED is not in the closed list, so applicants who became employees (or moved) are never matched.
  return { status: { in: CLOSED_WITHOUT_HIRE_STATUSES }, closedAt: { lt: cutoff } };
}

export async function previewPurge(now: Date = new Date()): Promise<PurgePreview> {
  const { retentionDays } = await getRecruitmentSettings();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const where = purgeWhere(cutoff);
  const [count, withCv, sample] = await Promise.all([
    prisma.recruitmentCandidate.count({ where }),
    prisma.recruitmentCandidate.count({ where: { ...where, cvFileId: { not: null } } }),
    prisma.recruitmentCandidate.findMany({ where, take: 8, orderBy: { closedAt: "asc" }, select: { fullName: true, status: true, closedAt: true } }),
  ]);
  return { count, withCv, cutoff, sample };
}

// Deletes applicants who left the pipeline without being hired and whose retention time
// has passed: their answers, interview notes, offer and CV go with them. Applicants who
// became employees are never touched.
export async function purgeOldCandidates(actorAccountId: string, now: Date = new Date()): Promise<number> {
  const { retentionDays } = await getRecruitmentSettings();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.recruitmentCandidate.findMany({
    where: purgeWhere(cutoff),
    select: { id: true, cvFileId: true, supportingFileId: true, offer: { select: { fileId: true } } },
  });
  if (candidates.length === 0) return 0;
  const fileIds = candidates.flatMap((c) => [c.cvFileId, c.supportingFileId, c.offer?.fileId]).filter((x): x is string => !!x);
  const files = await prisma.recruitmentFile.findMany({ where: { id: { in: fileIds } }, select: { id: true, storageKey: true } });

  await prisma.$transaction(async (tx) => {
    await tx.recruitmentCandidate.deleteMany({ where: { id: { in: candidates.map((c) => c.id) } } });
    await tx.recruitmentFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
    await tx.fileBlob.deleteMany({ where: { storageKey: { in: files.map((f) => f.storageKey) } } });
  });
  await logAudit({
    actorAccountId,
    action: "DELETE",
    datasetName: "RecruitmentCandidate",
    reason: `Clean-up: ${candidates.length} applicant(s) left without being hired, older than ${retentionDays} days`,
  });
  return candidates.length;
}
