import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { formatDateTimeMedium } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import { ReviewForm } from "../../task-forms";

export default async function ReviewEssayPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const session = await requireSession();
  const me = session.user.employeeId;
  if (!me) return <AccessDenied />;

  const test = await prisma.recruitmentCandidateTest.findUnique({
    where: { id: testId },
    include: {
      testType: true,
      reviewers: { select: { employeeId: true } },
      answers: { include: { question: { select: { prompt: true, sortOrder: true } } } },
      candidate: { select: { fullName: true, cvFileId: true, request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } } } },
    },
  });
  if (!test) notFound();
  // Only the people HR Admin picked for this answer may read it.
  if (!test.reviewers.some((r) => r.employeeId === me)) return <AccessDenied />;

  const pending = test.status === "SUBMITTED" && test.passed === null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Breadcrumbs items={[{ label: "Tugas Rekrutmen", href: "/recruitment/tasks" }, { label: `Nilai ${test.testType.name}` }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-medium text-slate-900">
          {test.testType.name}: {test.candidate.fullName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {test.candidate.request.job?.jobTitle ?? "—"} · {test.candidate.request.department.unitName}
          {test.submittedAt && ` · dikirim ${formatDateTimeMedium(test.submittedAt)}`}
        </p>
        {test.candidate.cvFileId && (
          <p className="mt-2 text-sm">
            <a href={`/api/recruitment/files/${test.candidate.cvFileId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              Buka CV pelamar
            </a>
          </p>
        )}
      </div>

      <div className="space-y-3">
        {[...test.answers]
          .sort((a, b) => a.question.sortOrder - b.question.sortOrder)
          .map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <p className="font-medium text-slate-700">{a.question.prompt}</p>
              <p className="mt-2 whitespace-pre-line text-slate-900">{a.answerText || <span className="text-slate-400">Tidak dijawab.</span>}</p>
            </div>
          ))}
        {test.answers.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400">Tidak ada jawaban.</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {pending ? (
          <ReviewForm testId={test.id} />
        ) : (
          <div className="text-sm">
            <StatusChip tone={test.passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{test.passed ? "Lulus" : "Tidak lulus"}</StatusChip>
            {test.reviewNote && <p className="mt-2 text-slate-700">{test.reviewNote}</p>}
            {test.reviewedAt && <p className="mt-1 text-xs text-slate-400">{formatDateTimeMedium(test.reviewedAt)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
