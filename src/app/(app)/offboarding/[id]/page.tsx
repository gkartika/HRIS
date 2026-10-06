import Link from "next/link";
import { formatDateLong } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import {
  canViewOffboardingCase,
  canExecuteExitClearance,
  canCancelOffboardingCase,
} from "@/lib/permissions";
import {
  canExecuteExitClearanceStatus,
  canCancelOffboardingCaseStatus,
} from "@/lib/offboarding";
import { blocksOffboardingGaRequest } from "@/lib/ga-operations";
import { isOverdue } from "@/lib/work-calendar";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import {
  ExecuteExitClearanceForm,
  CancelOffboardingCaseForm,
} from "./decision-forms";
import { ExitClearanceEmployeeForm } from "./exit-clearance-form";
import { FormNumberBadge, FormNumberStrip } from "../form-number";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function OffboardingCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const offboardingCase = await prisma.offboardingCase.findUnique({
    where: { id },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      reportedByAccount: true,
      clearanceCompletedByAccount: true,
      cancelledByAccount: true,
      sourceRenewalCase: true,
      exitReason: true,
    },
  });
  if (!offboardingCase) notFound();

  if (!canViewOffboardingCase(session, offboardingCase.employeeId)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const canExecute = canExecuteExitClearance(session) && canExecuteExitClearanceStatus(offboardingCase.status);
  const canCancel = canCancelOffboardingCase(session) && canCancelOffboardingCaseStatus(offboardingCase.status);
  const overdue = offboardingCase.status === "PENDING_CLEARANCE" && isOverdue(offboardingCase.clearanceDueDate);
  const isSelf = session.user.employeeId === offboardingCase.employeeId;

  // Version after UAT: employee-facing Exit Clearance form — informational
  // only, visible read-only to anyone who can already view this case once
  // submitted; the fill-in form itself is self-service and only offered
  // while there's actually something to clear.
  const exitClearanceSubmission = await prisma.exitClearanceSubmission.findUnique({
    where: { offboardingCaseId: offboardingCase.id },
    include: { answers: { include: { question: true } } },
  });
  const exitClearanceQuestions =
    isSelf && offboardingCase.status === "PENDING_CLEARANCE" && !exitClearanceSubmission
      ? await prisma.exitClearanceQuestion.findMany({ where: { activeFlag: true }, orderBy: { displayOrder: "asc" } })
      : [];

  // Phase 4A: "Only open Employee custody blocks offboarding" — surfaced
  // here so whoever can execute clearance sees the real blocker before
  // clicking (executeExitClearance also re-checks this server-side, the
  // authoritative gate).
  const openAssetCustodies =
    offboardingCase.status === "PENDING_CLEARANCE"
      ? await prisma.assetCustody.findMany({
          where: { employeeId: offboardingCase.employeeId, status: { not: "RETURNED" } },
          include: { asset: { select: { assetName: true, assetCode: true } } },
        })
      : [];

  // Phase 4B: same surfacing for the GA-request blocker as the custody one
  // above — executeExitClearance re-checks this server-side too.
  const openGaRequests =
    offboardingCase.status === "PENDING_CLEARANCE"
      ? (
          await prisma.gaRequest.findMany({
            where: { requesterEmployeeId: offboardingCase.employeeId },
            include: { asset: { select: { assetName: true, assetCode: true } } },
          })
        ).filter((r) => blocksOffboardingGaRequest(r.requestType, r.status))
      : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Offboarding", href: "/offboarding" }, { label: "Detail Kasus" }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <FormNumberStrip />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg font-medium text-slate-900">{offboardingCase.caseNumber}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/employees/${offboardingCase.employeeId}`} className="text-indigo-600 hover:underline">
                {offboardingCase.employee.fullLegalName}
              </Link>{" "}
              ({offboardingCase.employee.employeeNumber})
              {offboardingCase.employee.currentPosition && (
                <> — {offboardingCase.employee.currentPosition.job.jobTitle} ({offboardingCase.employee.currentPosition.orgUnit.unitName})</>
              )}
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {t(`offboardingCaseStatus.${offboardingCase.status}`)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">{t("offboarding.reason")}</p>
            <p className="text-sm text-slate-900">{t(`offboardingReason.${offboardingCase.reason}`)}</p>
          </div>
          {offboardingCase.exitReason && (
            <div>
              <p className="text-xs text-slate-500">Alasan</p>
              <p className="text-sm text-slate-900">{offboardingCase.exitReason.label}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">{t("offboarding.lastWorkingDay")}</p>
            <p className="text-sm text-slate-900">{formatDateLong(offboardingCase.lastWorkingDay)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("offboarding.clearanceDueDate")}</p>
            <p className={`text-sm ${overdue ? "font-medium text-rose-600" : "text-slate-900"}`}>
              {formatDateLong(offboardingCase.clearanceDueDate)}
              {overdue && ` (${t("offboarding.overdueBadge")})`}
            </p>
          </div>
        </div>

        {offboardingCase.sourceRenewalCase && (
          <p className="mt-4 text-sm text-slate-600">
            {t("offboarding.linkedRenewalCase")}:{" "}
            <Link href={`/contracts/${offboardingCase.sourceRenewalCase.currentContractId}`} className="font-mono text-xs text-indigo-600 hover:underline">
              {offboardingCase.sourceRenewalCase.caseNumber}
            </Link>
          </p>
        )}

        <p className="mt-4 text-xs text-slate-400">
          {t("offboarding.reportedBy")}: {offboardingCase.reportedByAccount?.usernameOrEmail ?? "—"} ({formatDateLong(offboardingCase.reportedAt)})
        </p>
        {offboardingCase.managerNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("offboarding.managerNote")}</p>
            <p className="text-sm text-slate-900">{offboardingCase.managerNote}</p>
          </div>
        )}
      </div>

      {offboardingCase.clearanceCompletedByAccount && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">{t("offboarding.clearanceTitle")}</p>
          <p className="text-sm text-slate-900">
            {offboardingCase.clearanceCompletedByAccount.usernameOrEmail} ({formatDateLong(offboardingCase.clearanceCompletedAt)})
          </p>
          {offboardingCase.clearanceNote && <p className="mt-1 text-sm text-slate-600">{offboardingCase.clearanceNote}</p>}
          <p className="mt-2 text-xs text-slate-400">{t("offboarding.completedNotice")}</p>
        </div>
      )}

      {openAssetCustodies.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-800">{t("offboarding.assetBlockerTitle")}</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {openAssetCustodies.map((c) => (
              <li key={c.id}>
                {c.asset.assetName} ({c.asset.assetCode}) — {t(`assetCustodyStatus.${c.status}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {openGaRequests.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-800">Permintaan GA yang Belum Selesai</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {openGaRequests.map((r) => (
              <li key={r.id}>
                <Link href={`/ga-requests/${r.id}`} className="font-mono text-xs hover:underline">
                  {r.requestNumber}
                </Link>
                {r.asset && ` — ${r.asset.assetName} (${r.asset.assetCode})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {exitClearanceQuestions.length > 0 && (
        <ExitClearanceEmployeeForm caseId={offboardingCase.id} questions={exitClearanceQuestions} />
      )}

      {exitClearanceSubmission && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">Formulir Klirens Keluar (Diisi Karyawan)</p>
            <FormNumberBadge />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Dikirim pada {formatDateLong(exitClearanceSubmission.submittedAt)}
          </p>
          <div className="mt-3 space-y-3">
            {exitClearanceSubmission.answers
              .sort((a, b) => a.question.displayOrder - b.question.displayOrder)
              .map((a) => (
                <div key={a.id}>
                  <p className="text-xs text-slate-500">{a.question.questionText}</p>
                  <p className="text-sm text-slate-900">{a.answerText || "—"}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {canExecute && <ExecuteExitClearanceForm caseId={offboardingCase.id} />}

      {offboardingCase.status === "CANCELLED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs text-slate-500">{t("offboarding.cancelButton")}</p>
          <p className="text-sm text-slate-900">
            {offboardingCase.cancelledByAccount?.usernameOrEmail} ({formatDateLong(offboardingCase.cancelledAt)})
          </p>
          {offboardingCase.cancellationReason && <p className="mt-1 text-sm text-slate-600">{offboardingCase.cancellationReason}</p>}
        </div>
      )}

      {canCancel && <CancelOffboardingCaseForm caseId={offboardingCase.id} />}
    </div>
  );
}
