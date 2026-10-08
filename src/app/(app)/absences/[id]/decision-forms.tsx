"use client";

import { ReasonForm } from "@/components/reason-form";
import { useActionState, useState } from "react";
import {
  decideAbsenceRequestAsFirstApprover,
  decideAbsenceRequestAsSecondApprover,
  decideAbsenceRequestAsHrAdmin,
  overrideAbsenceRequest,
  cancelAbsenceRequest,
} from "../actions";
import { t } from "@/lib/i18n/id";

type DecideAction = typeof decideAbsenceRequestAsFirstApprover;

function DecisionButton({
  requestId,
  decision,
  label,
  tone,
  requireNote,
  decideAction,
}: {
  requestId: string;
  decision: "APPROVE" | "REJECT";
  label: string;
  tone: string;
  requireNote: boolean;
  decideAction: DecideAction;
}) {
  const [open, setOpen] = useState(false);
  const action = decideAction.bind(null, requestId, decision);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tone}`}>
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-500">
        {decision === "REJECT" ? t("absence.rejectReasonLabel") : t("absence.noteLabel")} {requireNote && "(wajib)"}
      </label>
      <textarea name="note" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${tone}`}>
          {isPending ? t("common.loading") : label}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function FirstApproverDecisionButtons({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVE"
        label={t("absence.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        decideAction={decideAbsenceRequestAsFirstApprover}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECT"
        label={t("absence.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        decideAction={decideAbsenceRequestAsFirstApprover}
      />
    </div>
  );
}

export function SecondApproverDecisionButtons({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVE"
        label={t("absence.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        decideAction={decideAbsenceRequestAsSecondApprover}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECT"
        label={t("absence.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        decideAction={decideAbsenceRequestAsSecondApprover}
      />
    </div>
  );
}

export function HrAdminDecisionButtons({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVE"
        label={t("absence.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        decideAction={decideAbsenceRequestAsHrAdmin}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECT"
        label={t("absence.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        decideAction={decideAbsenceRequestAsHrAdmin}
      />
    </div>
  );
}

export function OverrideForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const action = overrideAbsenceRequest.bind(null, requestId, newStatus);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        {t("absence.overrideTitle")}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <select
        value={newStatus}
        onChange={(e) => setNewStatus(e.target.value as "APPROVED" | "REJECTED")}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="APPROVED">{t("absenceStatus.APPROVED")}</option>
        <option value="REJECTED">{t("absenceStatus.REJECTED")}</option>
      </select>
      <label className="block text-xs text-slate-600">{t("absence.overrideReasonLabel")} (wajib)</label>
      <textarea name="overrideReason" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("absence.overrideTitle")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function CancelAbsenceForm({ requestId }: { requestId: string }) {
  return (
    <ReasonForm
      action={cancelAbsenceRequest.bind(null, requestId)}
      triggerLabel={t("absence.cancelButton")}
      reasonLabel={t("absence.cancellationReasonLabel")}
    />
  );
}
