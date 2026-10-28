"use client";

import Link from "next/link";
import { ReasonForm } from "@/components/reason-form";
import { useActionState, useState } from "react";
import {
  decideMovementRequest,
  decideMovementRequestAsDeptHead,
  executeMovementRequest,
  cancelMovementRequest,
  updateMovementHrFields,
} from "../actions";
import { t } from "@/lib/i18n/id";

type DecideAction = typeof decideMovementRequest;

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

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

function DecisionButton({
  requestId,
  decision,
  label,
  tone,
  requireNote,
  positions,
  decideAction = decideMovementRequest,
}: {
  requestId: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  label: string;
  tone: string;
  requireNote: boolean;
  positions: DecisionPositionOption[];
  decideAction?: DecideAction;
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
      <DecisionPositionField positions={positions} />
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
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function MovementDecisionButtons({
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

// Perubahan Posisi refactor: Department Head 3B approval gate, ahead of the
// HR Manager — same button shell as MovementDecisionButtons, just bound to
// decideMovementRequestAsDeptHead.
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
        decideAction={decideMovementRequestAsDeptHead}
      />
      <DecisionButton
        requestId={requestId}
        decision="RETURNED"
        label={t("recruitment.returnButton")}
        tone="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        requireNote={true}
        positions={positions}
        decideAction={decideMovementRequestAsDeptHead}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECTED"
        label={t("recruitment.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        positions={positions}
        decideAction={decideMovementRequestAsDeptHead}
      />
    </div>
  );
}

export function ExecuteMovementButton({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const action = async () => {
    setIsPending(true);
    const result = await executeMovementRequest(requestId);
    setIsPending(false);
    setError(result);
  };
  return (
    <div>
      <form action={action}>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("movement.executeButton")}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// Tambah Posisi: Admin SDM picks the real seat (or first creates it) and carries the request out.
export function ExecuteAddPositionForm({
  requestId,
  positions,
  mode = "ADD_POSITION",
}: {
  requestId: string;
  mode?: "ADD_POSITION" | "MUTATION";
  positions: { id: string; label: string; heldByEmployee: boolean }[];
}) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [positionId, setPositionId] = useState("");
  const usable = positions.filter((p) => !p.heldByEmployee);
  const action = async () => {
    setIsPending(true);
    const result = await executeMovementRequest(requestId, positionId);
    setIsPending(false);
    setError(result);
  };
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="added-position" className="mb-1 block text-xs text-slate-500">
          {mode === "MUTATION" ? t("movement.pickMutationPosition") : t("movement.pickAddedPosition")}
        </label>
        <select
          id="added-position"
          required
          value={positionId}
          onChange={(e) => setPositionId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Pilih —</option>
          {usable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{mode === "MUTATION" ? t("movement.pickMutationPositionHint") : t("movement.pickAddedPositionHint")}</p>
      </div>
      <p className="text-xs text-slate-600">
        {t("movement.createPositionFirst")}{" "}
        <Link href="/admin/positions" className="font-medium text-indigo-600 underline">
          Buka Struktur Organisasi
        </Link>
      </p>
      <button
        type="submit"
        disabled={isPending || !positionId}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("movement.executeButton")}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

export function CancelMovementForm({ requestId }: { requestId: string }) {
  return (
    <ReasonForm
      action={cancelMovementRequest.bind(null, requestId)}
      triggerLabel={t("recruitment.cancelRequestButton")}
      reasonLabel={t("recruitment.cancellationReason")}
    />
  );
}

// Perubahan Posisi refactor: HR Admin-only supporting fields (FR-HC-01-09's
// 3-month attendance block + evaluation reference + confidential notes) —
// never rendered for the Level-3 requester (enforced by the parent page
// only ever passing this component to an HR Admin viewer).
export function MovementHrFieldsForm({
  requestId,
  initial,
}: {
  requestId: string;
  initial: {
    attendanceAlpha: number | null;
    attendanceSakit: number | null;
    attendanceIjin: number | null;
    attendanceIjinHalfDay: number | null;
    attendanceCuti: number | null;
    performanceEvaluationRef: string | null;
    hrConfidentialNotes: string | null;
  };
}) {
  const action = updateMovementHrFields.bind(null, requestId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <p className="mb-1 text-xs text-slate-500">{t("movement.attendanceTitle")}</p>
        <div className="grid grid-cols-5 gap-2">
          {(
            [
              ["attendanceAlpha", "movement.attendanceAlpha", initial.attendanceAlpha],
              ["attendanceSakit", "movement.attendanceSakit", initial.attendanceSakit],
              ["attendanceIjin", "movement.attendanceIjin", initial.attendanceIjin],
              ["attendanceIjinHalfDay", "movement.attendanceIjinHalfDay", initial.attendanceIjinHalfDay],
              ["attendanceCuti", "movement.attendanceCuti", initial.attendanceCuti],
            ] as const
          ).map(([name, labelKey, value]) => (
            <div key={name}>
              <label className="mb-1 block text-xs text-slate-500">{t(labelKey)}</label>
              <input
                type="number"
                min={0}
                name={name}
                defaultValue={value ?? ""}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.performanceEvaluationRef")}</label>
        <input
          type="text"
          name="performanceEvaluationRef"
          defaultValue={initial.performanceEvaluationRef ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.hrConfidentialNotes")}</label>
        <textarea
          name="hrConfidentialNotes"
          rows={2}
          defaultValue={initial.hrConfidentialNotes ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("common.save")}
      </button>
    </form>
  );
}
