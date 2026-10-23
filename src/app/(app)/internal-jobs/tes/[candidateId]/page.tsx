import { AccessDenied } from "@/components/access-denied";
import { finalizeExpiredAssessments } from "@/lib/recruitment-assessment-service";
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

  // Tes Situasi Kerja is the first step; one whose time ran out is closed first so the list is up to date.
  await finalizeExpiredAssessments(candidate.id);
  const state = await loadRunnerState(candidate.id);
  if (!state) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Breadcrumbs items={[{ label: "Lowongan Internal", href: "/internal-jobs" }, { label: "Tes" }]} />
      <TestRunner access={{ candidateId: candidate.id }} state={state} serverNowMs={new Date().getTime()} />
    </div>
  );
}
