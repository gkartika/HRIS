"use client";

import { useActionState } from "react";
import { putAccountOnHold, reactivateAccount } from "./account-actions";

const STATUS_LABEL: Record<string, string> = {
  INVITED: "Diundang",
  ACTIVE: "Aktif",
  LOCKED: "Terkunci (percobaan login gagal)",
  DISABLED: "Ditahan",
};

const STATUS_TONE: Record<string, string> = {
  INVITED: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  LOCKED: "bg-amber-50 text-amber-700",
  DISABLED: "bg-rose-50 text-rose-700",
};

function HoldForm({ employeeId }: { employeeId: string }) {
  const action = putAccountOnHold.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <label className="block text-xs text-slate-500">Alasan Penahanan Akun</label>
      <textarea
        name="holdReason"
        required
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="mis. dugaan pelanggaran, investigasi keamanan, dsb."
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {isPending ? "..." : "Tahan Akun"}
      </button>
    </form>
  );
}

function ReactivateForm({ employeeId }: { employeeId: string }) {
  const action = reactivateAccount.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <label className="block text-xs text-slate-500">Catatan (opsional)</label>
      <textarea
        name="reactivateNote"
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? "..." : "Aktifkan Kembali"}
      </button>
    </form>
  );
}

// Emergency account suspension — lighter-weight than full Offboarding exit
// clearance: only blocks login (Account.accountStatus), never touches
// Assignments/Contracts/Employee.activeFlag. Added per direct user request
// (UAT-18) as the "put an account on hold" control HR Admin/HR Manager can
// use immediately, independent of the multi-day Offboarding process.
export function AccountHoldPanel({
  employeeId,
  accountStatus,
  usernameOrEmail,
}: {
  employeeId: string;
  accountStatus: string;
  usernameOrEmail: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-900">Status Akun</h2>
          <p className="mt-1 text-xs text-slate-500">{usernameOrEmail}</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_TONE[accountStatus] ?? "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABEL[accountStatus] ?? accountStatus}
        </span>
      </div>
      {accountStatus === "ACTIVE" ? (
        <HoldForm employeeId={employeeId} />
      ) : (
        <ReactivateForm employeeId={employeeId} />
      )}
    </div>
  );
}
