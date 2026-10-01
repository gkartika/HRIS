"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

const BUTTON_OUTLINE = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50";
const BUTTON_ROSE_OUTLINE = "rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50";
const BUTTON_PRIMARY = "rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function EmployeeHeader({
  name,
  employeeNumber,
  badges,
  movementHref,
  shiftHref,
  offboardingHref,
  editHref,
  holdPanel,
}: {
  name: string;
  employeeNumber: string;
  badges: ReactNode;
  movementHref: string | null;
  shiftHref: string | null;
  offboardingHref: string | null;
  editHref: string | null;
  holdPanel: ReactNode | null;
}) {
  const [showHold, setShowHold] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-base font-semibold text-indigo-700">
            {initialsOf(name)}
          </div>
          <div>
            <h1 className="text-lg font-medium text-slate-900">{name}</h1>
            <p className="font-mono text-xs text-slate-400">{employeeNumber}</p>
            <div className="mt-2 flex flex-wrap gap-2">{badges}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {movementHref && (
            <Link href={movementHref} className={BUTTON_OUTLINE}>
              Ajukan Mutasi
            </Link>
          )}
          {shiftHref && (
            <Link href={shiftHref} className={BUTTON_OUTLINE}>
              Penugasan Absensi
            </Link>
          )}
          {holdPanel && (
            <button type="button" onClick={() => setShowHold((s) => !s)} className={BUTTON_OUTLINE}>
              Tahan Akun
            </button>
          )}
          {offboardingHref && (
            <Link href={offboardingHref} className={BUTTON_ROSE_OUTLINE}>
              Mulai Offboarding
            </Link>
          )}
          {editHref && (
            <Link href={editHref} className={BUTTON_PRIMARY}>
              Ubah
            </Link>
          )}
        </div>
      </div>
      {showHold && holdPanel && <div className="mt-4 border-t border-slate-100 pt-4">{holdPanel}</div>}
    </div>
  );
}
