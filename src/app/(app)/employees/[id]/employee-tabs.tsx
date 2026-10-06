import Link from "next/link";
import type { ReactNode } from "react";

export const EMPLOYEE_TABS = [
  { id: "profil", label: "Profil" },
  { id: "penempatan", label: "Penempatan" },
  { id: "akun", label: "Akun & Absensi" },
] as const;
export type EmployeeTabId = (typeof EMPLOYEE_TABS)[number]["id"];

export function parseEmployeeTab(value: string | undefined): EmployeeTabId {
  return EMPLOYEE_TABS.find((t) => t.id === value)?.id ?? "profil";
}

// The tab is in the URL (?tab=penempatan), and the server only renders and
// queries the tab that is open — the other two are never loaded until asked for.
export function EmployeeTabs({ active, children }: { active: EmployeeTabId; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2" role="tablist">
        {EMPLOYEE_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "profil" ? "?" : `?tab=${tab.id}`}
            scroll={false}
            role="tab"
            aria-selected={active === tab.id}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${
              active === tab.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="p-5">{children}</div>
    </div>
  );
}
