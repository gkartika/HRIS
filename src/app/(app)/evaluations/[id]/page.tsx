import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, canViewEvaluation } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EvaluationPanel } from "../evaluation-panel";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function EvaluationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      employee: true,
      snapshotPosition: { include: { job: true, orgUnit: true } },
      contractRenewalCase: { include: { currentContract: true } },
      movementRequest: true,
    },
  });
  if (!evaluation) notFound();

  const isHrAdminUser = isHrAdmin(session);
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const departmentId = evaluation.snapshotPosition
    ? await resolveDepartmentId(evaluation.snapshotPosition.orgUnitId)
    : null;
  const deptHeadPositions = departmentId
    ? await getActiveDeptHeadPositions(session.user.employeeId, departmentId)
    : [];

  if (
    !canViewEvaluation(
      session,
      session.user.employeeId,
      evaluation.p1EmployeeId,
      evaluation.p2EmployeeId,
      deptHeadPositions.map((p) => p.positionId),
      hrManagerPositions.map((p) => p.positionId)
    )
  ) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Evaluasi", href: "/evaluations" }, { label: "Detail Evaluasi" }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{evaluation.evaluationNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("evaluation.employee")}:{" "}
              {isHrAdminUser ? (
                <Link href={`/employees/${evaluation.employeeId}`} className="text-indigo-600 hover:underline">
                  {evaluation.employee.fullLegalName}
                </Link>
              ) : (
                evaluation.employee.fullLegalName
              )}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t("evaluation.purpose")}: {t(`evaluationPurpose.${evaluation.purpose}`)}
              {evaluation.snapshotPosition && ` — ${evaluation.snapshotPosition.job.jobTitle} (${evaluation.snapshotPosition.orgUnit.unitName})`}
            </p>
          </div>
        </div>

        {evaluation.contractRenewalCase && (
          <p className="mt-3 text-xs text-slate-500">
            {t("evaluation.linkedSource")}:{" "}
            <Link href={`/contracts/${evaluation.contractRenewalCase.currentContractId}`} className="text-indigo-600 hover:underline">
              {evaluation.contractRenewalCase.caseNumber}
            </Link>
          </p>
        )}
        {evaluation.movementRequest && (
          <p className="mt-3 text-xs text-slate-500">
            {t("evaluation.linkedSource")}:{" "}
            <Link href={`/movements/${evaluation.movementRequest.id}`} className="text-indigo-600 hover:underline">
              {evaluation.movementRequest.requestNumber}
            </Link>
          </p>
        )}
      </div>

      <EvaluationPanel evaluationId={evaluation.id} />
    </div>
  );
}
