import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { CopyTextButton } from "@/components/copy-text-button";
import { formatMobile } from "@/lib/mobile-number";
import { prisma } from "@/lib/db";
import { formatDateLong, formatDateTimeMedium } from "@/lib/format";
import { canManageAssessmentRubric, canManageRecruitment, isHrAdmin } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { isMovementRequestOpen } from "@/lib/movement";
import {
  CANDIDATE_STATUS_LABEL,
  CANDIDATE_STATUS_TONE,
  DECISION_LABEL,
  DECISION_TONE,
  TEST_FORM_LABEL,
  candidateNextStep,
  isActiveCandidateStatus,
  isExcellent,
  whatsappLink,
} from "@/lib/recruitment-candidates";
import { progressOf } from "@/lib/recruitment-queries";
import { getRecruitmentSettings } from "@/lib/recruitment-service";
import { listSelectableStaff } from "@/lib/recruitment-flow";
import { canCancelInterview, CANCEL_KIND_LABEL, cancelledLabel } from "@/lib/interview-cancel";
import { canScheduleHr, canSubmitHr, formatAverage, matrixAverage, scoreText } from "@/lib/interview-matrix";
import { ExecuteMovementButton } from "./execute-movement-button";
import { ExecuteAddPositionForm } from "../../../../movements/[id]/decision-forms";
import { listMovementSeatChoices } from "@/lib/movement-seats";
import { t } from "@/lib/i18n/id";
import {
  CancelInterviewPanel,
  DecisionForm,
  EndProcessForm,
  HrInterviewForm,
  HrNotesForm,
  OfferSendPanel,
  OfferUploadForm,
  ReviewerPicker,
  ScheduleHrInterviewForm,
  ScheduleInterviewForm,
  TestLinkPanel,
  type HrInterviewDefaults,
  type InterviewDefaults,
  type TestRowInfo,
} from "../../../candidate-forms";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface ResultColumn {
  key: string;
  title: string;
  subtitle: string;
  scores: { label: string; order: number; score: number; maxScore: number }[];
  recommendation: "ACCEPTED" | "CONSIDERED" | "REJECTED" | null;
  note: string | null;
}

function ResultsTable({ columns }: { columns: ResultColumn[] }) {
  const order = new Map<string, number>();
  for (const c of columns) for (const x of c.scores) order.set(x.label, Math.min(order.get(x.label) ?? 99, x.order));
  const labels = [...order.entries()].sort((p, q) => p[1] - q[1]).map(([name]) => name);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-2 pr-3 font-medium" />
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium text-slate-700">
                {c.title}
                <span className="block text-[11px] font-normal text-slate-400">{c.subtitle}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="align-top">
          {labels.map((name) => (
            <tr key={name} className="border-t border-slate-100">
              <td className="py-2 pr-3 text-slate-600">{name}</td>
              {columns.map((c) => {
                const x = c.scores.find((y) => y.label === name);
                return (
                  <td key={c.key} className="px-3 py-2 tabular-nums text-slate-900">
                    {x ? scoreText(x.score, x.maxScore) : <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {labels.length > 0 && (
            <tr className="border-t border-slate-100">
              <td className="py-2 pr-3 font-medium text-slate-700">Rata-rata</td>
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 font-medium tabular-nums text-slate-900">
                  {formatAverage(matrixAverage(c.scores.map((y) => y.score)))}
                  {c.scores[0] && c.scores[0].maxScore !== 10 && <span className="text-xs font-normal text-slate-400"> dari {c.scores[0].maxScore}</span>}
                </td>
              ))}
            </tr>
          )}
          <tr className="border-t border-slate-100">
            <td className="py-2 pr-3 text-slate-600">Rekomendasi</td>
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2">
                {c.recommendation ? <StatusChip tone={DECISION_TONE[c.recommendation]}>{DECISION_LABEL[c.recommendation]}</StatusChip> : <span className="text-xs text-slate-400">—</span>}
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-100">
            <td className="py-2 pr-3 text-slate-600">Catatan</td>
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2 text-xs text-slate-700">
                {c.note ?? "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function wibParts(date: Date) {
  return {
    date: date.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }),
    time: date.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false, hour: "2-digit", minute: "2-digit" }),
  };
}

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { id, candidateId } = await params;
  const session = await requireSession();
  if (!canManageRecruitment(session)) return <AccessDenied />;

  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    include: {
      request: { include: { job: true, department: true } },
      cvFile: true,
      supportingFile: true,
      assessment: { select: { status: true, screeningStatus: true } },
      employee: { select: { id: true, fullLegalName: true, employeeNumber: true } },
      tests: {
        orderBy: { sortOrder: "asc" },
        include: {
          testType: true,
          answers: { include: { question: { select: { prompt: true, sortOrder: true } } } },
          reviewers: { include: { employee: { select: { id: true, fullLegalName: true } } } },
        },
      },
      interview: {
        include: { interviewers: { include: { employee: { select: { id: true, fullLegalName: true } }, scores: true }, orderBy: { createdAt: "asc" } } },
      },
      hrInterview: { include: { scores: true } },
      offer: { include: { file: true } },
      movementRequest: {
        select: {
          id: true,
          requestNumber: true,
          status: true,
          proposedEffectiveDate: true,
          employeeId: true,
          proposedJobId: true,
          proposedJobLevel: true,
          proposedJob: { select: { jobTitle: true } },
          proposedPosition: { select: { positionCode: true, job: { select: { jobTitle: true } }, orgUnit: { select: { unitName: true } } } },
        },
      },
    },
  });
  if (!candidate || candidate.requestId !== id) notFound();

  const [settings, staffRaw, aspects] = await Promise.all([
    getRecruitmentSettings(),
    listSelectableStaff(),
    prisma.recruitmentInterviewAspect.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const staff = staffRaw.map((s) => ({ id: s.id, fullLegalName: s.fullLegalName, employeeNumber: s.employeeNumber, jobTitle: s.currentPosition?.job.jobTitle ?? null }));

  const isInternal = candidate.source === "INTERNAL";
  const next = candidateNextStep(
    progressOf({
      ...candidate,
      tests: candidate.tests.map((t) => ({ id: t.id, status: t.status, passed: t.passed, scorePercent: t.scorePercent, testType: { name: t.testType.name, form: t.testType.form, excellentScore: t.testType.excellentScore }, _count: { reviewers: t.reviewers.length } })),
      interview: candidate.interview ? { id: candidate.interview.id, scheduledAt: candidate.interview.scheduledAt, mode: candidate.interview.mode, interviewers: candidate.interview.interviewers.map((i) => ({ submittedAt: i.submittedAt })) } : null,
      offer: candidate.offer ? { sentAt: candidate.offer.sentAt, response: candidate.offer.response } : null,
    })
  );
  const jobTitle = candidate.request.job?.jobTitle ?? "—";
  const interview = candidate.interview;
  const hr = candidate.hrInterview;
  const hrCancelled = !!hr?.cancelledAt;
  const hrSubmitted = !!hr?.submittedAt;
  const hrDefaults: HrInterviewDefaults | null = hr ? { ...wibParts(hr.scheduledAt), mode: hr.mode, location: hr.location } : null;
  const canScheduleHrNow = canScheduleHr({ candidateStatus: candidate.status, interviewDecision: candidate.interviewDecision, hrSubmitted, hrCancelled });
  const canSubmitHrNow = canSubmitHr({ candidateStatus: candidate.status, interviewDecision: candidate.interviewDecision, hasHrInterview: !!hr, hrCancelled, hrSubmitted });
  const hrAspects = aspects.filter((x) => x.audience === "HR" && x.active).map((x) => ({ id: x.id, label: x.label, optional: x.optional, tag: x.label === "Energy" || x.label === "Energize" ? "khusus HR" : undefined }));
  const submittedInterviewers = interview?.interviewers.filter((i) => i.submittedAt) ?? [];
  const interviewDefaults: InterviewDefaults | null = interview
    ? { ...wibParts(interview.scheduledAt), mode: interview.mode, location: interview.location, employeeIds: interview.interviewers.map((i) => i.employeeId) }
    : null;
  const canSchedule = candidate.status === "TEST_PASSED" || (candidate.status === "INTERVIEWING" && !candidate.interviewDecision);
  const interviewCancelled = !!interview?.cancelledAt;
  // "Pelamar tidak datang" cancels whatever is still open: the user interview, the HR interview, or both.
  const openUserInterview = interview && !interviewCancelled ? interview : null;
  const openHrInterview = hr && !hrCancelled && !hrSubmitted ? hr : null;
  const cancelTarget = openUserInterview ?? openHrInterview;
  const canCancelInterviewNow = canCancelInterview({
    candidateStatus: candidate.status,
    interviewDecision: candidate.interviewDecision,
    hasInterview: !!(interview || hr),
    alreadyCancelled: !cancelTarget,
    submittedInterviewers: openUserInterview ? submittedInterviewers.length : 0,
  });
  const canDecide = candidate.status === "INTERVIEWING" && !candidate.interviewDecision && submittedInterviewers.length > 0;
  // Tautan tes and a second try for a test whose time ran out (the server checks the same rules again).
  const inTestPhase = ["TESTING", "AWAITING_REVIEW", "TEST_PASSED", "TEST_FAILED"].includes(candidate.status);
  const assessment = candidate.assessment;
  const assessmentTimedOut = assessment?.status === "SUBMITTED" && assessment.screeningStatus === "INCOMPLETE";
  const anyCatalogStarted = candidate.tests.some((x) => x.status !== "NOT_STARTED");
  const testRows: TestRowInfo[] = [
    {
      target: "assessment",
      name: t("assessment.name"),
      meta: "",
      state: !assessment ? "Belum dimulai" : assessment.status === "IN_PROGRESS" ? "Sedang dikerjakan" : assessmentTimedOut ? "Waktu habis, ditutup tanpa nilai" : "Selesai",
      tone: !assessment ? "muted" : assessmentTimedOut ? "warn" : "ok",
      canReopen: inTestPhase && assessmentTimedOut && !anyCatalogStarted,
    },
    ...candidate.tests.map((x, i): TestRowInfo => ({
      target: x.id,
      name: x.testType.name,
      meta: `${TEST_FORM_LABEL[x.testType.form]} · ${x.testType.timeLimitMinutes} menit`,
      state:
        x.status === "NOT_STARTED"
          ? "Belum dimulai"
          : x.status === "IN_PROGRESS"
            ? "Sedang dikerjakan"
            : x.autoSubmitted
              ? "Waktu habis, terkirim otomatis"
              : x.passed === null
                ? "Selesai, menunggu review"
                : x.passed
                  ? "Selesai, lulus"
                  : "Selesai, tidak lulus",
      tone: x.status === "NOT_STARTED" ? "muted" : x.autoSubmitted ? "warn" : "ok",
      canReopen:
        inTestPhase &&
        x.status === "SUBMITTED" &&
        x.autoSubmitted &&
        candidate.tests.slice(i + 1).every((y) => y.status === "NOT_STARTED") &&
        !candidate.tests.some((y) => y.id !== x.id && y.passed === false),
    })),
  ];
  const movement = candidate.movementRequest;
  // an approved move that named a Jabatan and a unit: the seat is picked when it is carried out
  const movementSeats =
    movement?.status === "APPROVED" && movement.proposedJobId
      ? await listMovementSeatChoices({
          jobId: movement.proposedJobId,
          jobTitle: movement.proposedJob?.jobTitle ?? "",
          jobLevel: movement.proposedJobLevel,
          employeeId: movement.employeeId,
          addPosition: false,
        })
      : [];
  const offer = candidate.offer;
  // One table for everyone who scored: HR first, then each interviewer. Rows are matched by the label the score was given under.
  const sortOf = new Map(aspects.map((x) => [x.id, x.sortOrder]));
  const resultColumns: ResultColumn[] = [
    ...(hr && hrSubmitted
      ? [{ key: "hr", title: "HR", subtitle: "Admin Rekrutmen", scores: hr.scores.map((x) => ({ label: x.aspectLabel, order: sortOf.get(x.aspectId) ?? 99, score: x.score, maxScore: x.maxScore })), recommendation: hr.recommendation, note: hr.note }]
      : []),
    ...(interview?.interviewers.filter((i) => i.submittedAt).map((i) => ({ key: i.id, title: i.employee.fullLegalName, subtitle: "Interview user", scores: i.scores.map((x) => ({ label: x.aspectLabel, order: sortOf.get(x.aspectId) ?? 99, score: x.score, maxScore: x.maxScore })), recommendation: i.recommendation, note: i.note })) ?? []),
  ];

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: "Rekrutmen", href: "/recruitment" }, { label: candidate.request.requestNumber, href: `/recruitment/${id}` }, { label: candidate.fullName }]} />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium text-slate-900">{candidate.fullName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {jobTitle} · {candidate.request.department.unitName} ·{" "}
              <Link href={`/recruitment/${id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                {candidate.request.requestNumber}
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip tone={isInternal ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}>{isInternal ? "Internal" : "Eksternal"}</StatusChip>
            <StatusChip tone={CANDIDATE_STATUS_TONE[candidate.status]}>{CANDIDATE_STATUS_LABEL[candidate.status]}</StatusChip>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="break-all text-slate-900">{candidate.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">WhatsApp</dt>
            <dd className="flex flex-wrap items-center gap-2 text-slate-900">
              {candidate.mobileNumber ? (
                <>
                  <b>{formatMobile(candidate.mobileNumber)}</b>
                  <a href={whatsappLink(candidate.mobileNumber, "")} target="_blank" rel="noopener noreferrer" className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
                    Chat WhatsApp
                  </a>
                  <CopyTextButton text={formatMobile(candidate.mobileNumber)} />
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Melamar</dt>
            <dd className="text-slate-900">{formatDateTimeMedium(candidate.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">CV terbaru</dt>
            <dd>
              {candidate.cvFile ? (
                <>
                  <a href={`/api/recruitment/files/${candidate.cvFile.id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {candidate.cvFile.fileName}
                  </a>
                  <span className="block text-xs text-slate-400">diunggah {formatDateTimeMedium(candidate.cvFile.createdAt)} WIB</span>
                </>
              ) : (
                <span className="text-slate-400">Tidak ada</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Dokumen pendukung</dt>
            <dd>
              {candidate.supportingFile ? (
                <>
                  <a href={`/api/recruitment/files/${candidate.supportingFile.id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {candidate.supportingFile.fileName}
                  </a>
                  <span className="block text-xs text-slate-400">diunggah {formatDateTimeMedium(candidate.supportingFile.createdAt)} WIB</span>
                </>
              ) : (
                <span className="text-slate-400">Tidak ada</span>
              )}
            </dd>
          </div>
        </dl>
        {candidate.employee && (
          <p className="mt-3 text-sm text-slate-600">
            Karyawan:{" "}
            <Link href={`/employees/${candidate.employee.id}`} className="text-indigo-600 hover:underline">
              {candidate.employee.fullLegalName} ({candidate.employee.employeeNumber})
            </Link>
          </p>
        )}
        {!isActiveCandidateStatus(candidate.status) && candidate.closeReason && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {candidate.closeReason}
            {candidate.closedAt && ` · ${formatDateLong(candidate.closedAt)}`}
            {candidate.status === "WITHDRAWN" && <> · tidak ada masa tunggu, boleh melamar lagi kapan saja</>}
            {(candidate.status === "TEST_FAILED" || candidate.status === "REJECTED") && candidate.closedAt && (
              <> · boleh melamar lagi setelah {formatDateLong(new Date(candidate.closedAt.getTime() + settings.retakeDays * 24 * 60 * 60 * 1000))}</>
            )}
          </p>
        )}
        {isActiveCandidateStatus(candidate.status) && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${next.needsAction ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
            <span className="text-xs uppercase tracking-wide opacity-70">Langkah berikutnya</span>
            <p className="font-medium">{next.label}</p>
          </div>
        )}
      </div>

      {canManageAssessmentRubric(session) && (
        <p className="text-sm">
          <Link href={`/recruitment/assessment/results/${candidate.id}`} className="font-medium text-indigo-600 hover:underline">
            Lihat hasil Tes Situasi Kerja
          </Link>
        </p>
      )}

      {inTestPhase && (
        <Section
          title="Tautan tes dan buka ulang tes"
          hint={isInternal ? "Pelamar internal mengerjakan tes dari akun SAPA mereka. Tes yang waktunya habis bisa dibuka ulang." : "Pelamar mengerjakan tes lewat tautan pribadi. Kalau tautan hilang, buat yang baru. Tes yang waktunya habis bisa dibuka ulang untuk kesempatan kedua."}
        >
          <TestLinkPanel candidateId={candidate.id} canIssueLink={!isInternal && candidate.status === "TESTING"} tests={testRows} />
        </Section>
      )}

      <Section title="Tes" hint="Tes Situasi Kerja dikerjakan pertama dan tidak punya lulus atau tidak lulus. Tes pilihan ganda dan skala dinilai otomatis begitu dikirim atau waktu habis.">
        {candidate.tests.length === 0 && <p className="text-sm text-slate-400">Tidak ada tes.</p>}
        <div className="space-y-4">
          {candidate.tests.map((t) => {
            const isEssay = t.testType.form === "ESSAY";
            return (
              <div key={t.id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {t.testType.name} <span className="font-normal text-slate-400">({TEST_FORM_LABEL[t.testType.form]}, {t.testType.timeLimitMinutes} menit)</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {t.status === "SUBMITTED" && t.scorePercent !== null && <span className="text-xs text-slate-500">Skor {Math.round(t.scorePercent)} (lulus {t.passScoreSnapshot ?? t.testType.passScore})</span>}
                    {t.passed && isExcellent(t.scorePercent, t.testType.excellentScore) && <StatusChip tone="bg-amber-100 text-amber-800">Istimewa</StatusChip>}
                    <StatusChip
                      tone={
                        t.status !== "SUBMITTED"
                          ? "bg-slate-100 text-slate-600"
                          : t.passed === null
                            ? "bg-amber-50 text-amber-700"
                            : t.passed
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                      }
                    >
                      {t.status === "NOT_STARTED" ? "Belum dimulai" : t.status === "IN_PROGRESS" ? "Sedang dikerjakan" : t.passed === null ? "Menunggu review" : t.passed ? "Lulus" : "Tidak lulus"}
                    </StatusChip>
                  </div>
                </div>
                {t.submittedAt && (
                  <p className="mt-1 text-xs text-slate-400">
                    Dikirim {formatDateTimeMedium(t.submittedAt)}
                    {t.autoSubmitted && " (otomatis, waktu habis)"}
                  </p>
                )}
                {isEssay && t.status === "SUBMITTED" && (
                  <div className="mt-3 space-y-3">
                    {[...t.answers]
                      .sort((a, b) => a.question.sortOrder - b.question.sortOrder)
                      .map((a) => (
                        <div key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                          <p className="font-medium text-slate-700">{a.question.prompt}</p>
                          <p className="mt-1 whitespace-pre-line text-slate-900">{a.answerText || <span className="text-slate-400">Tidak dijawab.</span>}</p>
                        </div>
                      ))}
                    {t.reviewNote && (
                      <p className="text-sm text-slate-600">
                        Catatan reviewer: {t.reviewNote}
                        {t.reviewedAt && <span className="text-slate-400"> · {formatDateTimeMedium(t.reviewedAt)}</span>}
                      </p>
                    )}
                    {t.passed === null && (
                      <ReviewerPicker candidateId={candidate.id} testId={t.id} staff={staff} selectedIds={t.reviewers.map((r) => r.employeeId)} />
                    )}
                    {t.passed !== null && t.reviewers.length > 0 && (
                      <p className="text-xs text-slate-400">Reviewer: {t.reviewers.map((r) => r.employee.fullLegalName).join(", ")}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {canCancelInterviewNow && cancelTarget && (
        <CancelInterviewPanel
          candidateId={candidate.id}
          interviewers={openUserInterview?.interviewers.length ?? 0}
          interviewTimePassed={cancelTarget.scheduledAt.getTime() <= new Date().getTime()}
          requestNumber={candidate.request.requestNumber}
        />
      )}

      {(canScheduleHrNow || hr) && (
        <Section title="Interview HR" hint="Dilakukan Admin Rekrutmen. Jadwalnya terpisah dari interview user dan boleh diatur kapan saja. Kalau HR menolak, interview user dibatalkan.">
          {hrCancelled && hr && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Interview HR dibatalkan: {cancelledLabel(hr.cancelKind).toLowerCase()}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Dicatat {formatDateTimeMedium(hr.cancelledAt)} WIB
                {hr.cancelReason ? ` · ${hr.cancelReason}` : ""}
              </p>
              {hr.cancelNote && <p className="mt-1 text-xs text-slate-600">{hr.cancelNote}</p>}
            </div>
          )}
          {canScheduleHrNow && <ScheduleHrInterviewForm candidateId={candidate.id} existing={hrDefaults} />}
          {hr && !hrCancelled && !canScheduleHrNow && (
            <p className="text-sm text-slate-700">
              {formatDateTimeMedium(hr.scheduledAt)} WIB · {hr.mode === "ONLINE" ? "Online" : "Offline"} · {hr.location}
            </p>
          )}
          {hr && !hrCancelled && (
            <p className="mt-2 text-xs text-slate-500">
              {hr.invitationSentAt ? `Email undangan ke pelamar terkirim ${formatDateTimeMedium(hr.invitationSentAt)}.` : "Email undangan ke pelamar belum terkirim. Kirim lewat WhatsApp atau simpan jadwal lagi."}
            </p>
          )}
          {hr && hrSubmitted && (
            <p className="mt-3 text-sm text-slate-700">
              Penilaian HR terkirim {formatDateTimeMedium(hr.submittedAt)} WIB.{" "}
              {hr.recommendation && <StatusChip tone={DECISION_TONE[hr.recommendation]}>{DECISION_LABEL[hr.recommendation]}</StatusChip>} Hasilnya ada di tabel Hasil penilaian di bawah.
            </p>
          )}
          {canSubmitHrNow && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-900">Form penilaian HR</h3>
              <div className="mt-2">
                <HrInterviewForm
                  candidateId={candidate.id}
                  aspects={hrAspects}
                  userInterview={openUserInterview ? { when: `${formatDateTimeMedium(openUserInterview.scheduledAt)} WIB`, interviewers: openUserInterview.interviewers.length } : null}
                />
              </div>
            </div>
          )}
        </Section>
      )}

      {resultColumns.length > 0 && (
        <Section title="Hasil penilaian" hint="Penilaian HR dan pewawancara user dalam satu tabel. Rata-rata hanya gambaran, keputusan akhir tetap di Admin Rekrutmen.">
          <ResultsTable columns={resultColumns} />
        </Section>
      )}

      {(canSchedule || interview) && (
        <Section title="Interview user" hint="Admin Rekrutmen menunjuk pewawancara. Tiap pewawancara mengisi penilaiannya sendiri dari akun masing-masing.">
          {interviewCancelled && interview && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Interview dibatalkan: {cancelledLabel(interview.cancelKind).toLowerCase()}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Dicatat {formatDateTimeMedium(interview.cancelledAt)} WIB · {interview.cancelKind ? CANCEL_KIND_LABEL[interview.cancelKind] : ""}
                {interview.cancelReason ? ` · ${interview.cancelReason}` : ""}
              </p>
              {interview.cancelNote && <p className="mt-1 text-xs text-slate-600">{interview.cancelNote}</p>}
              <p className="mt-2 text-xs text-slate-400">
                <s>{formatDateTimeMedium(interview.scheduledAt)} WIB · {interview.mode === "ONLINE" ? "Online" : "Offline"} · {interview.location}</s>
                {" "}· pewawancara dikabari: {interview.interviewers.map((i) => i.employee.fullLegalName).join(", ")}
              </p>
            </div>
          )}
          {canSchedule && (
            <ScheduleInterviewForm
              candidateId={candidate.id}
              staff={staff}
              maxInterviewers={settings.maxInterviewers}
              defaultInterviewers={settings.defaultInterviewers}
              existing={interviewDefaults}
            />
          )}
          {interview && !canSchedule && !interviewCancelled && (
            <p className="text-sm text-slate-700">
              {formatDateTimeMedium(interview.scheduledAt)} WIB · {interview.mode === "ONLINE" ? "Online" : "Offline"} · {interview.location}
            </p>
          )}
          {interview && !interviewCancelled && (
            <p className="mt-2 text-xs text-slate-500">
              {interview.invitationSentAt ? `Email undangan ke pelamar terkirim ${formatDateTimeMedium(interview.invitationSentAt)}.` : "Email undangan ke pelamar belum terkirim. Kirim lewat WhatsApp atau simpan jadwal lagi."}
            </p>
          )}

          {interview && !interviewCancelled && (
            <div>
              <h3 className="mt-5 text-sm font-medium text-slate-900">Bagian HR Admin (administratif)</h3>
              <div className="mt-2">
                <HrNotesForm
                  candidateId={candidate.id}
                  defaults={{ attendance: interview.hrAttendanceNote ?? "", documents: interview.hrDocumentsNote ?? "", process: interview.hrProcessNote ?? "" }}
                />
              </div>

              <h3 className="mt-5 text-sm font-medium text-slate-900">Keputusan akhir</h3>
              <div className="mt-2">
                {candidate.interviewDecision ? (
                  <p className="text-sm text-slate-700">
                    <StatusChip tone={DECISION_TONE[candidate.interviewDecision]}>{DECISION_LABEL[candidate.interviewDecision]}</StatusChip>
                    {candidate.decidedAt && <span className="ml-2 text-xs text-slate-400">{formatDateTimeMedium(candidate.decidedAt)}</span>}
                    {candidate.decisionNote && <span className="mt-1 block text-slate-600">{candidate.decisionNote}</span>}
                  </p>
                ) : canDecide ? (
                  <DecisionForm candidateId={candidate.id} isInternal={isInternal} />
                ) : (
                  <p className="text-sm text-slate-400">Menunggu sedikitnya satu pewawancara mengisi penilaian.</p>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      {!isInternal && (candidate.status === "OFFERING" || offer || candidate.status === "HIRED" || candidate.status === "OFFER_DECLINED") && (
        <Section title="Offering Letter" hint="Unggah PDF, tanda tangan untuk perusahaan di layar, lalu kirim tautan sekali pakai ke kandidat.">
          {offer ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <a href={`/api/recruitment/files/${offer.file.id}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {offer.file.fileName}
                </a>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={offer.companySignature} alt="Tanda tangan perusahaan" className="h-12 rounded border border-slate-200 bg-white" />
                <span className="text-xs text-slate-500">Ditandatangani perusahaan {formatDateTimeMedium(offer.companySignedAt)}</span>
              </div>
              {offer.response ? (
                <div className={`rounded-lg px-4 py-3 text-sm ${offer.response === "ACCEPTED" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                  Kandidat {offer.response === "ACCEPTED" ? "menerima" : "menolak"} pada {formatDateTimeMedium(offer.respondedAt)}
                  {offer.recordedByHr ? " (dicatat HR Admin)" : ""}.
                  {offer.candidateSignature && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.candidateSignature} alt="Tanda tangan kandidat" className="mt-2 h-12 rounded border border-emerald-200 bg-white" />
                  )}
                  {offer.response === "DECLINED" && <p className="mt-1">Permintaan tetap terbuka untuk kandidat lain.</p>}
                </div>
              ) : null}
              {candidate.status === "OFFERING" && offer.response === "ACCEPTED" && (
                <Link href={`/recruitment/${id}/create-employee?candidateId=${candidate.id}`} className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  Buat Karyawan dari Kandidat
                </Link>
              )}
              {candidate.status === "OFFERING" && (
                <OfferSendPanel candidateId={candidate.id} sentAt={offer.sentAt ? formatDateTimeMedium(offer.sentAt) : null} hasResponse={!!offer.response} />
              )}
              {candidate.status === "OFFERING" && !offer.response && (
                <details className="rounded-lg border border-slate-100 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-indigo-600">Ganti berkas offering letter</summary>
                  <div className="mt-3">
                    <OfferUploadForm candidateId={candidate.id} replacing />
                  </div>
                </details>
              )}
            </div>
          ) : candidate.status === "OFFERING" ? (
            <OfferUploadForm candidateId={candidate.id} replacing={false} />
          ) : (
            <p className="text-sm text-slate-400">Tidak ada offering letter.</p>
          )}
        </Section>
      )}

      {isInternal && (candidate.status === "MOVEMENT" || movement || candidate.status === "HIRED") && (
        <Section title="Perubahan Posisi" hint="Pelamar internal tidak mendapat offering letter. Posisi baru diproses lewat Perubahan Posisi, lalu kontrak baru lewat jalur Kontrak yang sudah ada.">
          {movement ? (
            <p className="text-sm text-slate-700">
              {isHrAdmin(session) ? (
                <Link href={`/movements/${movement.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                  {movement.requestNumber}
                </Link>
              ) : (
                <span className="font-mono text-xs text-slate-700">{movement.requestNumber}</span>
              )}{" "}
              <StatusChip tone="bg-slate-100 text-slate-600">{t(`movementStatus.${movement.status}`)}</StatusChip>
              <span className="ml-2 text-slate-600">
                {movement.proposedJob && movement.status !== "IMPLEMENTED"
                  ? `pindah ke ${movement.proposedJob.jobTitle}${movement.proposedJobLevel ? `, level ${movement.proposedJobLevel}` : ""}, mulai ${formatDateLong(movement.proposedEffectiveDate)}`
                  : `pindah ke ${movement.proposedPosition.job.jobTitle} (${movement.proposedPosition.positionCode}), ${movement.proposedPosition.orgUnit.unitName}, mulai ${formatDateLong(movement.proposedEffectiveDate)}`}
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">Belum ada Perubahan Posisi untuk pelamar ini.</p>
          )}
          {candidate.status === "MOVEMENT" && movement?.status === "APPROVED" &&
            (movement.proposedJobId ? (
              <div className="mt-3 rounded-lg bg-emerald-50 p-4">
                <p className="mb-3 text-sm text-emerald-900">Perubahan Posisi sudah disetujui. Pilih posisinya (atau buat dulu di Struktur Organisasi), lalu laksanakan.</p>
                <ExecuteAddPositionForm requestId={movement.id} mode="MUTATION" positions={movementSeats} />
              </div>
            ) : (
              <ExecuteMovementButton movementRequestId={movement.id} />
            ))}
          {candidate.status === "MOVEMENT" && candidate.employeeId && (!movement || !isMovementRequestOpen(movement.status)) && (
            <Link
              href={`/movements/new?employeeId=${candidate.employeeId}&candidateId=${candidate.id}`}
              className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {movement ? "Buat Perubahan Posisi baru" : "Buat Perubahan Posisi"}
            </Link>
          )}
          {candidate.status === "HIRED" && <p className="mt-2 text-sm text-emerald-700">Perubahan Posisi sudah dilaksanakan. Atasan diberi tahu lewat email.</p>}
        </Section>
      )}

      {isActiveCandidateStatus(candidate.status) && (
        <div>
          <EndProcessForm candidateId={candidate.id} />
        </div>
      )}
    </div>
  );
}
