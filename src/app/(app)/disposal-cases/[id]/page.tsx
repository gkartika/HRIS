import { DISPOSAL_STATUS_LABEL } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import { notFound } from "next/navigation";
import { formatDateLong } from "@/lib/format";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { canExecuteDisposalCase, canCancelDisposalCase } from "@/lib/ga-operations";
import { prisma } from "@/lib/db";
import { ExecuteDisposalForm, CancelDisposalForm } from "./decision-forms";
import { Breadcrumbs } from "@/components/breadcrumbs";

const REASON_LABEL: Record<string, string> = {
  BEYOND_REPAIR: "Tidak Dapat Diperbaiki",
  OBSOLETE: "Obsolete",
  CONFIRMED_LOSS: "Kehilangan Dikonfirmasi",
};

// Two stages: Draf, then Disetujui. Approving a case and taking the asset out are one action.
const STEPS = ["Draf", "Disetujui, aset keluar"];

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

  const canExecute = canExecuteDisposalCase(disposalCase.status);
  const canCancel = canCancelDisposalCase(disposalCase.status);
  const done = disposalCase.status === "EXECUTED";
  const cancelled = disposalCase.status === "REJECTED";

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

      {cancelled ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <p className="text-sm font-medium text-rose-800">Kasus dibatalkan, aset kembali ke peredaran</p>
          <p className="mt-1 text-xs text-rose-700">
            {formatDateLong(disposalCase.decisionAt)} — {disposalCase.decisionByAccount?.usernameOrEmail ?? "—"}
            {disposalCase.decisionNote && `: ${disposalCase.decisionNote}`}
          </p>
        </div>
      ) : (
        <ol className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 text-sm">
          {STEPS.map((label, i) => {
            const complete = i === 0 ? true : done;
            const active = i === (done ? 1 : 0);
            return (
              <li
                key={label}
                className={`px-4 py-2.5 ${complete ? "bg-emerald-50 text-emerald-700" : active ? "bg-indigo-50 font-medium text-indigo-700" : "bg-slate-50 text-slate-400"} ${i > 0 ? "border-l border-slate-200" : ""}`}
              >
                {i + 1}. {label}
              </li>
            );
          })}
        </ol>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 text-slate-900">{DISPOSAL_STATUS_LABEL[disposalCase.status]}</p>
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
      </div>

      {canExecute && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">
            {disposalCase.status === "APPROVED" ? "Laksanakan Disposal" : "Setujui dan keluarkan aset"}
          </p>
          {disposalCase.status === "APPROVED" ? (
            <p className="mt-1 text-xs text-slate-500">
              Disetujui {formatDateLong(disposalCase.decisionAt)} — {disposalCase.decisionByAccount?.usernameOrEmail ?? "—"}
              {disposalCase.decisionNote && `: ${disposalCase.decisionNote}`}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Satu langkah: begitu disimpan, kasus disetujui, aset berstatus Retired dan penguasaan yang masih terbuka ditutup. Metode, tanggal, dan bukti wajib.
            </p>
          )}
          <ExecuteDisposalForm caseId={disposalCase.id} alreadyApproved={disposalCase.status === "APPROVED"} />
        </div>
      )}

      {disposalCase.status === "EXECUTED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-900">Pelaksanaan</p>
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
        </div>
      )}

      {canCancel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <CancelDisposalForm caseId={disposalCase.id} />
        </div>
      )}
    </div>
  );
}
