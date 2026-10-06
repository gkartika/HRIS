import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { formatDateLong } from "@/lib/format";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { canSubmitDisposalCaseForApproval, canDecideDisposalCase, canExecuteDisposalCase } from "@/lib/ga-operations";
import { prisma } from "@/lib/db";
import { SubmitForApprovalForm, DisposalDecisionButtons, ExecuteDisposalForm } from "./decision-forms";
import { Breadcrumbs } from "@/components/breadcrumbs";

const REASON_LABEL: Record<string, string> = {
  BEYOND_REPAIR: "Tidak Dapat Diperbaiki",
  OBSOLETE: "Obsolete",
  CONFIRMED_LOSS: "Kehilangan Dikonfirmasi",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_APPROVAL: "Menunggu Persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  EXECUTED: "Dilaksanakan",
};

export default async function DisposalCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const disposalCase = await prisma.disposalCase.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, assetCode: true, assetName: true } },
      proposalEvidenceFile: true,
      executionEvidenceFile: true,
      decisionByAccount: { select: { usernameOrEmail: true } },
      executedByAccount: { select: { usernameOrEmail: true } },
      createdByAccount: { select: { usernameOrEmail: true } },
    },
  });
  if (!disposalCase) notFound();

  const isGaAdminUser = canManageGaOperations(session);

  if (!isGaAdminUser) {
    return <AccessDenied />;
  }

  const canSubmit = isGaAdminUser && canSubmitDisposalCaseForApproval(disposalCase.status);
  const canDecide = isGaAdminUser && canDecideDisposalCase(disposalCase.status);
  const canExecute = isGaAdminUser && canExecuteDisposalCase(disposalCase.status);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Kasus Disposal", href: "/disposal-cases" }, { label: "Detail Kasus" }]} />
      <div>
        <h1 className="text-lg font-medium text-slate-900">{disposalCase.caseNumber}</h1>
        <p className="mt-1 text-sm text-slate-500">
          <Link href={`/assets/${disposalCase.asset.id}`} className="text-indigo-600 hover:underline">
            {disposalCase.asset.assetName} ({disposalCase.asset.assetCode})
          </Link>{" "}
          — {REASON_LABEL[disposalCase.reason]}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 text-slate-900">{STATUS_LABEL[disposalCase.status]}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dibuat</p>
            <p className="mt-1 text-slate-900">{disposalCase.createdByAccount.usernameOrEmail}</p>
          </div>
          {disposalCase.proposalNote && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Catatan Proposal</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-900">{disposalCase.proposalNote}</p>
            </div>
          )}
          {disposalCase.proposalEvidenceFile && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Bukti Proposal</p>
              <a href={`/api/files/${disposalCase.proposalEvidenceFile.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                {disposalCase.proposalEvidenceFile.originalFileName}
              </a>
            </div>
          )}
        </div>
        {canSubmit && <SubmitForApprovalForm caseId={disposalCase.id} />}
      </div>

      {(disposalCase.status !== "DRAFT" || disposalCase.decisionAt) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Persetujuan Akhir</p>
          {disposalCase.decisionAt && (
            <p className="mt-2 text-xs text-slate-500">
              {formatDateLong(disposalCase.decisionAt)} — {disposalCase.decisionByAccount?.usernameOrEmail ?? "—"}
              {disposalCase.decisionNote && `: ${disposalCase.decisionNote}`}
            </p>
          )}
          {canDecide && <DisposalDecisionButtons caseId={disposalCase.id} />}
        </div>
      )}

      {(disposalCase.status === "APPROVED" || disposalCase.status === "EXECUTED") && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Pelaksanaan</p>
          {disposalCase.status === "EXECUTED" ? (
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Metode</p>
                <p className="mt-1 text-slate-900">{disposalCase.executionMethod}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tanggal</p>
                <p className="mt-1 text-slate-900">{formatDateLong(disposalCase.executionDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Nilai</p>
                <p className="mt-1 text-slate-900">{disposalCase.executionValue ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Referensi</p>
                <p className="mt-1 text-slate-900">{disposalCase.executionReference ?? "—"}</p>
              </div>
              {disposalCase.executionEvidenceFile && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Bukti Pelaksanaan</p>
                  <a href={`/api/files/${disposalCase.executionEvidenceFile.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                    {disposalCase.executionEvidenceFile.originalFileName}
                  </a>
                </div>
              )}
              <div className="col-span-2 text-xs text-slate-500">
                Dilaksanakan oleh {disposalCase.executedByAccount?.usernameOrEmail ?? "—"}
              </div>
            </div>
          ) : (
            canExecute && <ExecuteDisposalForm caseId={disposalCase.id} />
          )}
        </div>
      )}
    </div>
  );
}
