import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReasonForm } from "@/components/reason-form";
import { StatusChip } from "@/components/status-chip";
import { CopyTextButton } from "@/components/copy-text-button";
import { formatMobile } from "@/lib/mobile-number";
import { prisma } from "@/lib/db";
import { formatDateLong, formatDateTimeMedium } from "@/lib/format";
import { canManageRecruitment, isHrAdmin } from "@/lib/permissions";
import { requireSession } from "@/lib/require-session";
import { isMovementRequestOpen } from "@/lib/movement";
import {
  CANDIDATE_STATUS_LABEL,
  CANDIDATE_STATUS_TONE,
  DECISION_LABEL,
  DECISION_TONE,
  TEST_FORM_LABEL,
  averageScore,
  candidateNextStep,
  isActiveCandidateStatus,
  isExcellent,
  whatsappLink,
} from "@/lib/recruitment-candidates";
import { progressOf } from "@/lib/recruitment-queries";
import { getRecruitmentSettings } from "@/lib/recruitment-service";
import { listSelectableStaff } from "@/lib/recruitment-flow";
import { rejectCandidateAction } from "../../../candidate-actions";
import { ExecuteMovementButton } from "./execute-movement-button";
import { t } from "@/lib/i18n/id";
import {
  DecisionForm,
  HrNotesForm,
  OfferSendPanel,
  OfferUploadForm,
  ReviewerPicker,
  ScheduleInterviewForm,
  type InterviewDefaults,
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
      offer: { include: { file: true } },
      movementRequest: {
        select: {
          id: true,
          requestNumber: true,
          status: true,
          proposedEffectiveDate: true,
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
      interview: candidate.interview ? { id: candidate.interview.id, scheduledAt: candidate.interview.scheduledAt, interviewers: candidate.interview.interviewers.map((i) => ({ submittedAt: i.submittedAt })) } : null,
      offer: candidate.offer ? { sentAt: candidate.offer.sentAt, response: candidate.offer.response } : null,
    })
  );
  const jobTitle = candidate.request.job?.jobTitle ?? "—";
  const interview = candidate.interview;
  const submittedInterviewers = interview?.interviewers.filter((i) => i.submittedAt) ?? [];
  const interviewDefaults: InterviewDefaults | null = interview
    ? { ...wibParts(interview.scheduledAt), mode: interview.mode, location: interview.location, employeeIds: interview.interviewers.map((i) => i.employeeId) }
    : null;
  const canSchedule = candidate.status === "TEST_PASSED" || (candidate.status === "INTERVIEWING" && !candidate.interviewDecision);
  const canDecide = candidate.status === "INTERVIEWING" && !candidate.interviewDecision && submittedInterviewers.length > 0;
  const movement = candidate.movementRequest;
  const offer = candidate.offer;
  const aspectOrder = aspects.filter((a) => interview?.interviewers.some((i) => i.scores.some((s) => s.aspectId === a.id)));

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

      <Section title="Tes" hint="Cultural Fit dikerjakan pertama. Tes pilihan ganda dan skala dinilai otomatis begitu dikirim atau waktu habis.">
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

      {(canSchedule || interview) && (
        <Section title="Interview" hint="HR Admin menunjuk pewawancara. Tiap pewawancara mengisi penilaiannya sendiri dari akun masing-masing.">
          {canSchedule && (
            <ScheduleInterviewForm
              candidateId={candidate.id}
              staff={staff}
              maxInterviewers={settings.maxInterviewers}
              defaultInterviewers={settings.defaultInterviewers}
              existing={interviewDefaults}
            />
          )}
          {interview && !canSchedule && (
            <p className="text-sm text-slate-700">
              {formatDateTimeMedium(interview.scheduledAt)} WIB · {interview.mode === "ONLINE" ? "Online" : "Offline"} · {interview.location}
            </p>
          )}
          {interview && (
            <p className="mt-2 text-xs text-slate-500">
              {interview.invitationSentAt ? `Email undangan ke pelamar terkirim ${formatDateTimeMedium(interview.invitationSentAt)}.` : "Email undangan ke pelamar belum terkirim. Kirim lewat WhatsApp atau simpan jadwal lagi."}
            </p>
          )}

          {interview && (
            <div className="mt-5">
              <h3 className="text-sm font-medium text-slate-900">Penilaian pewawancara</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium" />
                      {interview.interviewers.map((i) => (
                        <th key={i.id} className="px-3 py-2 font-medium text-slate-700">
                          {i.employee.fullLegalName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {aspectOrder.map((a) => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="py-2 pr-3 text-slate-600">{a.label}</td>
                        {interview.interviewers.map((i) => (
                          <td key={i.id} className="px-3 py-2 tabular-nums text-slate-900">
                            {i.submittedAt ? (i.scores.find((s) => s.aspectId === a.id)?.score ?? "—") : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {aspectOrder.length > 0 && (
                      <tr className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-700">Rata-rata</td>
                        {interview.interviewers.map((i) => (
                          <td key={i.id} className="px-3 py-2 font-medium tabular-nums text-slate-900">
                            {i.submittedAt ? (averageScore(i.scores.map((s) => s.score)) ?? "—") : "—"}
                          </td>
                        ))}
                      </tr>
                    )}
                    <tr className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-600">Rekomendasi</td>
                      {interview.interviewers.map((i) => (
                        <td key={i.id} className="px-3 py-2">
                          {i.recommendation ? <StatusChip tone={DECISION_TONE[i.recommendation]}>{DECISION_LABEL[i.recommendation]}</StatusChip> : <span className="text-xs text-slate-400">Belum mengisi</span>}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-600">Catatan</td>
                      {interview.interviewers.map((i) => (
                        <td key={i.id} className="px-3 py-2 text-xs text-slate-700">
                          {i.note ?? "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

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
                pindah ke {movement.proposedPosition.job.jobTitle} ({movement.proposedPosition.positionCode}), {movement.proposedPosition.orgUnit.unitName}, mulai {formatDateLong(movement.proposedEffectiveDate)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">Belum ada Perubahan Posisi untuk pelamar ini.</p>
          )}
          {candidate.status === "MOVEMENT" && movement?.status === "APPROVED" && <ExecuteMovementButton movementRequestId={movement.id} />}
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
          <ReasonForm
            action={rejectCandidateAction.bind(null, candidate.id)}
            triggerLabel="Akhiri proses pelamar ini"
            reasonLabel="Alasan (wajib)"
            submitLabel="Akhiri proses"
            fieldName="reason"
            required
            variant="slate"
          />
        </div>
      )}
    </div>
  );
}
