import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { requireSession } from "@/lib/require-session";
import { loadAssessmentRunner } from "@/lib/recruitment-assessment-service";
import { AssessmentRunner } from "@/app/cbp-recruitment/assessment-runner";

export const dynamic = "force-dynamic";

// The same Tes Situasi Kerja as external applicants take, with the same questions, scoring and storage.
// The only difference is how the applicant is known: an employee is signed in, so the result is linked to them.
export default async function InternalAssessmentPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return <AccessDenied />;

  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, employeeId: true, source: true },
  });
  if (!candidate || candidate.source !== "INTERNAL" || candidate.employeeId !== employeeId) return <AccessDenied />;

  const state = await loadAssessmentRunner(candidate.id);
  const crumbs = [{ label: "Lowongan Internal", href: "/internal-jobs" }, { label: t("assessment.name") }];
  if (!state || state.kind === "closed") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Breadcrumbs items={crumbs} />
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-medium text-slate-900">{t("assessment.name")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {state?.kind === "closed" && state.reason === "NO_ACTIVE_RUBRIC" ? t("assessment.candidate.closedNoRubric") : t("assessment.candidate.closedNotOpen")}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Breadcrumbs items={crumbs} />
      <AssessmentRunner access={{ candidateId: candidate.id }} state={state} />
    </div>
  );
}
