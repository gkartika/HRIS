import Link from "next/link";
import { formatDateLong } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, canReleaseEvaluation, canSubmitEvaluationAs, canViewEvaluation } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getActiveDeptHeadPositions } from "@/lib/dept-head";
import { resolveDepartmentId } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { canReleaseEvaluationStatus, canSubmitEvaluationSlot, type EvaluationScores } from "@/lib/evaluation";
import { isOverdue } from "@/lib/work-calendar";
import { ReleaseEvaluationForm, EvaluationSlotForm } from "./decision-forms";

function EvaluationScoreSummary({ scores, total }: { scores: unknown; total: number | null }) {
  const s = (scores ?? {}) as EvaluationScores;
  const entries: [string, number][] = [];
  const push = (key: keyof EvaluationScores, label: string) => {
    const v = s[key];
    if (typeof v === "number") entries.push([label, v]);
  };
  push("kpiProductivity", t("evaluation.kpiProductivity"));
  push("qualityOrientation", t("evaluation.qualityOrientation"));
  push("problemSolving", t("evaluation.problemSolving"));
  push("communicationLeadership", t("evaluation.communicationLeadership"));
  push("technicalExpertise", t("evaluation.technicalExpertise"));
  push("workDiscipline", t("evaluation.workDiscipline"));
  push("absensi", t("evaluation.absensi"));
  push("tugasKhusus", t("evaluation.tugasKhusus"));
  push("sp", t("evaluation.sp"));
  push("kompetensi", t("evaluation.kompetensi"));
  s.companyValues?.forEach((v, i) => {
    if (typeof v === "number") entries.push([t(`evaluation.companyValue${i + 1}`), v]);
  });

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-3">
      {entries.map(([label, v]) => (
        <div key={label}>
          {label}: <span className="font-medium text-slate-900">{v}</span>
        </div>
      ))}
      <div className="col-span-full mt-1 text-sm font-medium text-slate-900">
        {t("evaluation.total")}: {total ?? "—"}
      </div>
    </div>
  );
}

// Shared, embeddable evaluation block (DM-27/WF-19) — used both standalone
// at /evaluations/[id] and inline inside the Contract and Perubahan Posisi
// detail pages, so every source workflow shows the exact same evaluation UI
// rather than each reimplementing its own (WF-19: "one reusable entity and
// workflow only"). Renders nothing for a viewer with no authorization,
// rather than blocking the whole host page.
export async function EvaluationPanel({ evaluationId, linkToDetail = false }: { evaluationId: string; linkToDetail?: boolean }) {
  const session = await requireSession();
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      employee: true,
      snapshotPosition: { include: { job: true, orgUnit: true } },
      p1Employee: true,
      p2Employee: true,
    },
  });
  if (!evaluation) return null;

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
    return null;
  }

  const isViewerP1 = canSubmitEvaluationAs(session.user.employeeId, evaluation.p1EmployeeId);
  const isViewerP2 = canSubmitEvaluationAs(session.user.employeeId, evaluation.p2EmployeeId);
  const isReviewer = isHrAdminUser || deptHeadPositions.length > 0 || hrManagerPositions.length > 0;

  const canRelease = canReleaseEvaluation(session) && canReleaseEvaluationStatus(evaluation.status);
  const canP1Submit = isViewerP1 && canSubmitEvaluationSlot(evaluation.status, evaluation.p1SubmittedAt);
  const canP2Submit = isViewerP2 && canSubmitEvaluationSlot(evaluation.status, evaluation.p2SubmittedAt);

  const employees = canRelease ? await prisma.employee.findMany({ orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } }) : [];
  const overdue = isOverdue(evaluation.evaluationDueDate);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{t("evaluation.title")}</p>
          {linkToDetail ? (
            <Link href={`/evaluations/${evaluation.id}`} className="font-mono text-sm text-indigo-600 hover:underline">
              {evaluation.evaluationNumber}
            </Link>
          ) : (
            <p className="font-mono text-sm text-slate-900">{evaluation.evaluationNumber}</p>
          )}
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {t(`evaluationStatus.${evaluation.status}`)}
        </span>
      </div>

      {evaluation.evaluationDueDate && (
        <p className={`text-xs ${overdue ? "text-rose-600" : "text-slate-500"}`}>
          {t("evaluation.dueDate")}: {formatDateLong(evaluation.evaluationDueDate)}
          {overdue && ` — ${t("evaluation.overdueNotice")}`}
        </p>
      )}

      {canRelease && <ReleaseEvaluationForm evaluationId={evaluation.id} employees={employees} />}

      {evaluation.status !== "DRAFT" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {t("evaluation.p1Title")} — {evaluation.p1Employee?.fullLegalName}
            </p>
            {evaluation.p1SubmittedAt ? (
              isViewerP1 || isReviewer ? (
                <EvaluationScoreSummary scores={evaluation.p1Scores} total={evaluation.p1Total} />
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("evaluation.submittedNotice")}</p>
              )
            ) : (
              <p className="mt-2 text-xs text-slate-400">—</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {t("evaluation.p2Title")} — {evaluation.p2Employee?.fullLegalName}
            </p>
            {evaluation.p2SubmittedAt ? (
              isViewerP2 || isReviewer ? (
                <EvaluationScoreSummary scores={evaluation.p2Scores} total={evaluation.p2Total} />
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("evaluation.submittedNotice")}</p>
              )
            ) : (
              <p className="mt-2 text-xs text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {canP1Submit && <EvaluationSlotForm evaluationId={evaluation.id} slot="P1" />}
      {canP2Submit && <EvaluationSlotForm evaluationId={evaluation.id} slot="P2" />}
    </div>
  );
}
