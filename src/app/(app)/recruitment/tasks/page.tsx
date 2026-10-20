import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { StatusChip } from "@/components/status-chip";
import { prisma } from "@/lib/db";
import { formatDateTimeMedium } from "@/lib/format";
import { requireSession } from "@/lib/require-session";

export default async function RecruitmentTasksPage() {
  const session = await requireSession();
  const me = session.user.employeeId;
  if (!me) return <AccessDenied />;

  const [reviews, interviews] = await Promise.all([
    prisma.recruitmentTestReviewer.findMany({
      where: { employeeId: me },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        candidateTest: {
          select: {
            id: true,
            passed: true,
            status: true,
            testType: { select: { name: true } },
            candidate: { select: { fullName: true, request: { select: { job: { select: { jobTitle: true } } } } } },
          },
        },
      },
    }),
    prisma.recruitmentInterviewer.findMany({
      where: { employeeId: me },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        submittedAt: true,
        interview: {
          select: {
            id: true,
            scheduledAt: true,
            location: true,
            candidate: { select: { fullName: true, status: true, interviewDecision: true, request: { select: { job: { select: { jobTitle: true } } } } } },
          },
        },
      },
    }),
  ]);

  const pendingReviews = reviews.filter((r) => r.candidateTest.status === "SUBMITTED" && r.candidateTest.passed === null);
  const doneReviews = reviews.filter((r) => !(r.candidateTest.status === "SUBMITTED" && r.candidateTest.passed === null));
  const isOpenInterview = (i: (typeof interviews)[number]) => !i.submittedAt && i.interview.candidate.status === "INTERVIEWING" && !i.interview.candidate.interviewDecision;
  const pendingInterviews = interviews.filter(isOpenInterview);
  const doneInterviews = interviews.filter((i) => !isOpenInterview(i));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">Tugas Rekrutmen</h1>
        <p className="mt-1 text-sm text-slate-500">Jawaban tes yang diminta HR Anda nilai, dan interview yang Anda lakukan.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Perlu Anda kerjakan ({pendingReviews.length + pendingInterviews.length})</h2>
        <div className="mt-2 divide-y divide-slate-100">
          {pendingReviews.map((r) => (
            <div key={r.candidateTest.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  Nilai {r.candidateTest.testType.name}: {r.candidateTest.candidate.fullName}
                </p>
                <p className="text-xs text-slate-500">{r.candidateTest.candidate.request.job?.jobTitle ?? "—"}</p>
              </div>
              <Link href={`/recruitment/review/${r.candidateTest.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                Baca dan nilai
              </Link>
            </div>
          ))}
          {pendingInterviews.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">Interview {i.interview.candidate.fullName}</p>
                <p className="text-xs text-slate-500">
                  {i.interview.candidate.request.job?.jobTitle ?? "—"} · {formatDateTimeMedium(i.interview.scheduledAt)} WIB · {i.interview.location}
                </p>
              </div>
              <Link href={`/recruitment/interview/${i.interview.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                Isi penilaian
              </Link>
            </div>
          ))}
          {pendingReviews.length + pendingInterviews.length === 0 && <p className="py-3 text-sm text-slate-400">Tidak ada tugas yang menunggu.</p>}
        </div>
      </section>

      {(doneReviews.length > 0 || doneInterviews.length > 0) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">Sudah selesai</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {doneReviews.map((r) => (
              <div key={r.candidateTest.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-slate-700">
                  {r.candidateTest.testType.name}: {r.candidateTest.candidate.fullName}
                </span>
                <StatusChip tone="bg-slate-100 text-slate-600">{r.candidateTest.passed === null ? "Belum dikirim" : r.candidateTest.passed ? "Lulus" : "Tidak lulus"}</StatusChip>
              </div>
            ))}
            {doneInterviews.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={`/recruitment/interview/${i.interview.id}`} className="text-indigo-600 hover:underline">
                  Interview {i.interview.candidate.fullName}
                </Link>
                <StatusChip tone="bg-slate-100 text-slate-600">{i.submittedAt ? "Penilaian terkirim" : "Ditutup"}</StatusChip>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
