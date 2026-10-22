import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { formatDateTimeMedium } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import { DECISION_LABEL, DECISION_TONE } from "@/lib/recruitment-candidates";
import { testSummary } from "@/lib/recruitment-queries";
import { InterviewerForm } from "../../task-forms";

export default async function InterviewerPage({ params }: { params: Promise<{ interviewId: string }> }) {
  const { interviewId } = await params;
  const session = await requireSession();
  const me = session.user.employeeId;
  if (!me) return <AccessDenied />;

  const interview = await prisma.recruitmentInterview.findUnique({
    where: { id: interviewId },
    include: {
      interviewers: { where: { employeeId: me }, include: { scores: true } },
      candidate: {
        select: {
          fullName: true,
          status: true,
          interviewDecision: true,
          cvFileId: true,
          supportingFileId: true,
          request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } },
          tests: { orderBy: { sortOrder: "asc" }, select: { status: true, passed: true, scorePercent: true, testType: { select: { name: true, form: true } } } },
        },
      },
    },
  });
  if (!interview) notFound();
  // Only a person HR Admin appointed for this interview may open it.
  const mine = interview.interviewers[0];
  if (!mine) return <AccessDenied />;

  const c = interview.candidate;
  const aspects = await prisma.recruitmentInterviewAspect.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true } });
  const open = !mine.submittedAt && c.status === "INTERVIEWING" && !c.interviewDecision;
  const summary = testSummary(c);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Breadcrumbs items={[{ label: "Tugas Rekrutmen", href: "/recruitment/tasks" }, { label: `Interview ${c.fullName}` }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-medium text-slate-900">Interview {c.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {c.request.job?.jobTitle ?? "—"} · {c.request.department.unitName}
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Jadwal</dt>
            <dd className="text-slate-900">{formatDateTimeMedium(interview.scheduledAt)} WIB</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{interview.mode === "ONLINE" ? "Online" : "Offline"}</dt>
            <dd className="break-words text-slate-900">{interview.location}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">CV</dt>
            <dd>
              {c.cvFileId ? (
                <a href={`/api/recruitment/files/${c.cvFileId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  Buka CV
                </a>
              ) : (
                <span className="text-slate-400">Tidak ada</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Dokumen pendukung</dt>
            <dd>
              {c.supportingFileId ? (
                <a href={`/api/recruitment/files/${c.supportingFileId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  Buka dokumen
                </a>
              ) : (
                <span className="text-slate-400">Tidak ada</span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">Hasil tes: {summary}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {open ? (
          <InterviewerForm interviewerId={mine.id} aspects={aspects} />
        ) : mine.submittedAt ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              Penilaian Anda terkirim {formatDateTimeMedium(mine.submittedAt)}.{" "}
              {mine.recommendation && <StatusChip tone={DECISION_TONE[mine.recommendation]}>{DECISION_LABEL[mine.recommendation]}</StatusChip>}
            </p>
            {mine.scores.length > 0 && (
              <ul className="space-y-1">
                {mine.scores.map((s) => (
                  <li key={s.id} className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-600">{s.aspectLabel}</span>
                    <span className="tabular-nums text-slate-900">{s.score}</span>
                  </li>
                ))}
              </ul>
            )}
            {mine.note && <p className="text-slate-700">Catatan: {mine.note}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Interview ini sudah ditutup oleh HR.</p>
        )}
      </div>
    </div>
  );
}
