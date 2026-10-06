"use client";

import { useState } from "react";

// Small modal shell shared by the consumables forms. The body is rendered only
// while open, so each open starts with a fresh form (and a fresh action state).
// `close` is handed to the body so a form can dismiss itself after success.
export function Dialog({
  triggerLabel,
  triggerClassName,
  title,
  description,
  children,
}: {
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  description?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            <div className="mt-3">{children(close)}</div>
          </div>
        </div>
      )}
    </>
  );
}
