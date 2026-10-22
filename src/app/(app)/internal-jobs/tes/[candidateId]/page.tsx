import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { t } from "@/lib/i18n/id";
import { assessmentEntryState } from "@/lib/recruitment-assessment-service";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { loadRunnerState } from "@/lib/recruitment-service";
import { TestRunner } from "@/app/cbp-recruitment/test-runner";

export const dynamic = "force-dynamic";

export default async function InternalTestPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return <AccessDenied />;

  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, employeeId: true, source: true },
  });
  if (!candidate || candidate.source !== "INTERNAL" || candidate.employeeId !== employeeId) return <AccessDenied />;

  const state = await loadRunnerState(candidate.id);
  if (!state) return <AccessDenied />;

  // Tes Situasi Kerja opens after the first (gate) test; it is separate and never changes the applicant's status.
  const assessment = await assessmentEntryState(candidate.id);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Breadcrumbs items={[{ label: "Lowongan Internal", href: "/internal-jobs" }, { label: "Tes" }]} />
      <TestRunner access={{ candidateId: candidate.id }} state={state} serverNowMs={new Date().getTime()} />
      {assessment !== "none" && !state.active && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-medium text-slate-900">{t("assessment.name")}</h2>
          {assessment === "done" ? (
            <p className="mt-1 text-sm text-slate-500">{t("assessment.candidate.doneTitle")}. Jawaban Anda sudah kami terima.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">20 situasi kerja dengan empat pilihan jawaban. Tidak ada batas waktu dan tidak ada jawaban benar atau salah.</p>
              <Link href={`/internal-jobs/asesmen/${candidate.id}`} className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                {assessment === "in-progress" ? "Lanjutkan" : t("assessment.candidate.start")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
