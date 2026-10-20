import Link from "next/link";
import { prisma } from "@/lib/db";
import { listOpenVacancies } from "@/lib/recruitment-service";
import { isActiveCandidateStatus } from "@/lib/recruitment-candidates";

// Beranda card for someone HR Admin appointed as essay reviewer or interviewer: how many
// of those tasks are still open. (Anyone with other authority sees the same items inside
// "Perlu Persetujuan Anda", so only the simple Beranda uses this card.)
export async function RecruitmentTasksCard({ employeeId }: { employeeId: string }) {
  const [reviews, interviews] = await Promise.all([
    prisma.recruitmentTestReviewer.count({ where: { employeeId, candidateTest: { status: "SUBMITTED", passed: null } } }),
    prisma.recruitmentInterviewer.count({
      where: { employeeId, submittedAt: null, interview: { candidate: { status: "INTERVIEWING", interviewDecision: null } } },
    }),
  ]);
  const total = reviews + interviews;
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{total} tugas rekrutmen menunggu Anda</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {[reviews > 0 ? `${reviews} jawaban tes untuk dinilai` : null, interviews > 0 ? `${interviews} penilaian interview` : null].filter(Boolean).join(", ")}.
          </p>
        </div>
        <Link href="/recruitment/tasks" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Buka tugas
        </Link>
      </div>
    </div>
  );
}

// Beranda card for every employee: how many internal vacancies are open, and a way back
// into a test they started. Shows nothing when there is nothing to tell. The cheap count
// goes first so most days the heavier readiness check never runs.
export async function InternalJobsCard({ employeeId }: { employeeId: string }) {
  const published = await prisma.recruitmentRequest.count({
    where: { openFor: { in: ["INTERNAL", "BOTH"] }, status: { in: ["APPROVED", "RECRUITMENT_IN_PROGRESS", "PARTIALLY_FILLED"] } },
  });
  if (published === 0) return null;

  const [vacancies, mine] = await Promise.all([
    listOpenVacancies("INTERNAL"),
    prisma.recruitmentCandidate.findMany({
      where: { employeeId, source: "INTERNAL" },
      select: { id: true, requestId: true, status: true },
    }),
  ]);
  const appliedTo = new Set(mine.filter((m) => isActiveCandidateStatus(m.status)).map((m) => m.requestId));
  const available = vacancies.filter((v) => !appliedTo.has(v.id)).length;
  const testing = mine.find((m) => m.status === "TESTING");
  if (available === 0 && !testing) return null;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {available > 0 ? `${available} lowongan internal terbuka` : "Lamaran internal Anda"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {testing ? "Tes lamaran Anda belum selesai." : "Anda bisa melamar tanpa memberi tahu atasan lebih dulu."}
          </p>
        </div>
        <Link
          href={testing ? `/internal-jobs/tes/${testing.id}` : "/internal-jobs"}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {testing ? "Lanjutkan tes" : "Lihat lowongan"}
        </Link>
      </div>
    </div>
  );
}
