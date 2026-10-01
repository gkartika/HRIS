"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "profil", label: "Profil" },
  { id: "penempatan", label: "Penempatan" },
  { id: "akun", label: "Akun & Absensi" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function EmployeeTabs({
  profil,
  penempatan,
  akun,
}: {
  profil: ReactNode;
  penempatan: ReactNode;
  akun: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("profil");
  const content: Record<TabId, ReactNode> = { profil, penempatan, akun };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${
              active === tab.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-5">{content[active]}</div>
    </div>
  );
}
