"use client";

import { useEffect, useState } from "react";

// Two-step button for anything that cancels, deletes, archives or deactivates:
// the first click only asks "Yakin?", the second one does it. Inside a <form>
// the confirm button is the submit button; outside one, pass onConfirm.
// Disarms itself after a few seconds so a stray click can't stay "loaded".
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  pending,
  className = "text-xs text-rose-600 hover:underline",
}: {
  label: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  disabled?: boolean;
  pending?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (!armed) {
    return (
      <button type="button" disabled={disabled || pending} onClick={() => setArmed(true)} className={`${className} disabled:opacity-60`}>
        {pending ? "…" : label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-2 py-1 text-xs">
      <span className="font-medium text-rose-700">Yakin?</span>
      <button
        type={onConfirm ? "button" : "submit"}
        onClick={onConfirm ? () => { setArmed(false); onConfirm(); } : undefined}
        className="rounded-md bg-rose-600 px-2 py-0.5 font-medium text-white hover:bg-rose-700"
      >
        {confirmLabel ?? `Ya, ${label.toLowerCase()}`}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-slate-500 hover:text-slate-800">
        Batal
      </button>
    </span>
  );
}
