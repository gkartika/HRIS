"use client";

import { ReasonForm } from "@/components/reason-form";
import { useActionState, useState } from "react";
import {
  startReviewRecruitmentRequest,
  decideRecruitmentRequest,
  decideRecruitmentRequestAsDeptHead,
  cancelRecruitmentRequest,
  closeRecruitmentRequest,
} from "../actions";
import { vacantSeatShortfall } from "@/lib/recruitment";
import { t } from "@/lib/i18n/id";

type DecideAction = typeof decideRecruitmentRequest;

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

export interface DecisionJobOption {
  id: string;
  jobTitle: string;
}

export function StartReviewButton({ requestId }: { requestId: string }) {
  const action = async () => {
    await startReviewRecruitmentRequest(requestId);
  };
  return (
    <form action={action}>
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {t("recruitment.startReviewButton")}
      </button>
    </form>
  );
}

// WF-05/ACC-14: when the HR Manager holds more than one qualifying Position,
// they must pick which capacity they're deciding through — stored on the
// request as decisionPositionId. With exactly one, it's sent as a hidden
// field with nothing for the user to choose.
function DecisionPositionField({ positions }: { positions: DecisionPositionOption[] }) {
  if (positions.length === 0) return null;
  if (positions.length === 1) {
    return <input type="hidden" name="decisionPositionId" value={positions[0].positionId} />;
  }
  return (
    <div>
      <label className="block text-xs text-slate-500">{t("recruitment.decisionPosition")}</label>
      <select name="decisionPositionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        {positions.map((p) => (
          <option key={p.positionId} value={p.positionId}>
            {p.jobTitle} ({p.positionCode})
          </option>
        ))}
      </select>
    </div>
  );
}

// Heads-up only, never a block: hiring needs a vacant position for the chosen
// job to exist in this department, so the HR Manager sees how many there are
// before approving. Admin SDM adds missing positions in Posisi Organisasi.
function VacantSeatNote({
  jobId,
  vacantByJob,
  requestedHeadcount,
}: {
  jobId: string;
  vacantByJob: Record<string, number>;
  requestedHeadcount: number;
}) {
  if (!jobId) return null;
  const vacant = vacantByJob[jobId] ?? 0;
  const shortfall = vacantSeatShortfall(requestedHeadcount, vacant);
  return (
    <p className={`mt-1 text-xs ${shortfall > 0 ? "text-amber-700" : "text-slate-500"}`}>
      {t("recruitment.vacantSeatsForJob", { vacant, requested: requestedHeadcount })}
      {shortfall > 0 && <> {t("recruitment.vacantSeatsShortfall", { shortfall })}</>}
    </p>
  );
}

function DecisionJobField({
  jobs,
  defaultJobId,
  vacantByJob,
  requestedHeadcount,
}: {
  jobs: DecisionJobOption[];
  defaultJobId?: string | null;
  vacantByJob?: Record<string, number>;
  requestedHeadcount?: number;
}) {
  const [selectedJobId, setSelectedJobId] = useState(defaultJobId ?? "");
  return (
    <div>
      <label className="block text-xs text-slate-500">{t("recruitment.setJobToApprove")}</label>
      <select
        name="jobId"
        required
        value={selectedJobId}
        onChange={(e) => setSelectedJobId(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">— Pilih —</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.jobTitle}
          </option>
        ))}
      </select>
      {vacantByJob && requestedHeadcount !== undefined && (
        <VacantSeatNote jobId={selectedJobId} vacantByJob={vacantByJob} requestedHeadcount={requestedHeadcount} />
      )}
    </div>
  );
}

function DecisionButton({
  requestId,
  decision,
  label,
  tone,
  requireNote,
  positions,
  jobs,
  defaultJobId,
  vacantByJob,
  requestedHeadcount,
  decideAction = decideRecruitmentRequest,
}: {
  requestId: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  label: string;
  tone: string;
  requireNote: boolean;
  positions: DecisionPositionOption[];
  jobs?: DecisionJobOption[];
  defaultJobId?: string | null;
  vacantByJob?: Record<string, number>;
  requestedHeadcount?: number;
  decideAction?: DecideAction;
}) {
  const [open, setOpen] = useState(false);
  const action = decideAction.bind(null, requestId, decision);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`rounded-lg px-4 py-2 text-sm font-medium ${tone}`}
      >
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <DecisionPositionField positions={positions} />
      {decision === "APPROVED" && jobs && (
        <DecisionJobField
          jobs={jobs}
          defaultJobId={defaultJobId}
          vacantByJob={vacantByJob}
          requestedHeadcount={requestedHeadcount}
        />
      )}
      <label className="block text-xs text-slate-500">
        {t("recruitment.decisionNote")} {requireNote && "(wajib)"}
      </label>
      <textarea name="decisionNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${tone}`}
        >
          {isPending ? t("common.loading") : label}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm text-slate-500"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

// WF-15: approval controls are only ever rendered for an active HR Manager
// (the caller only passes non-empty `positions` when the page's own
// canApprove check already confirmed that) — HR Admin never sees these.
export function DecisionButtons({
  requestId,
  positions,
  jobs,
  defaultJobId,
  vacantByJob,
  requestedHeadcount,
}: {
  requestId: string;
  positions: DecisionPositionOption[];
  jobs: DecisionJobOption[];
  defaultJobId?: string | null;
  vacantByJob?: Record<string, number>;
  requestedHeadcount?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVED"
        label={t("recruitment.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        positions={positions}
        jobs={jobs}
        defaultJobId={defaultJobId}
        vacantByJob={vacantByJob}
        requestedHeadcount={requestedHeadcount}
      />
      <DecisionButton
        requestId={requestId}
        decision="RETURNED"
        label={t("recruitment.returnButton")}
        tone="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        requireNote={true}
        positions={positions}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECTED"
        label={t("recruitment.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        positions={positions}
      />
    </div>
  );
}

// Department Manager/Head (Job level 3B) approval gate, ahead of the HR
// Manager, added per direct user request — same button shell as
// DecisionButtons, just bound to decideRecruitmentRequestAsDeptHead and
// with no Jabatan field (that's only ever set at the HR Manager's own
// Approve step).
export function DeptHeadDecisionButtons({
  requestId,
  positions,
}: {
  requestId: string;
  positions: DecisionPositionOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVED"
        label={t("recruitment.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        positions={positions}
        decideAction={decideRecruitmentRequestAsDeptHead}
      />
      <DecisionButton
        requestId={requestId}
        decision="RETURNED"
        label={t("recruitment.returnButton")}
        tone="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        requireNote={true}
        positions={positions}
        decideAction={decideRecruitmentRequestAsDeptHead}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECTED"
        label={t("recruitment.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        positions={positions}
        decideAction={decideRecruitmentRequestAsDeptHead}
      />
    </div>
  );
}

// DM-25/ACC-16: the explicit exception — Requester, HR Manager, or HR Admin
// may cancel an eligible request. Visibility is decided by the server page
// (canCancelRecruitmentRequest); this component just renders the form.
export function CancelRequestForm({ requestId }: { requestId: string }) {
  return (
    <ReasonForm
      action={cancelRecruitmentRequest.bind(null, requestId)}
      triggerLabel={t("recruitment.cancelRequestButton")}
      reasonLabel={t("recruitment.cancellationReason")}
    />
  );
}

// "Tutup": stop hiring on a partly filled request. Visibility is decided by
// the server page (Admin SDM or the active HR Manager, status Terisi Sebagian).
export function CloseRequestForm({ requestId }: { requestId: string }) {
  return (
    <ReasonForm
      action={closeRecruitmentRequest.bind(null, requestId)}
      triggerLabel={t("recruitment.closeRequestButton")}
      reasonLabel={t("recruitment.closeReason")}
      fieldName="closeReason"
      required
      variant="slate"
    />
  );
}
