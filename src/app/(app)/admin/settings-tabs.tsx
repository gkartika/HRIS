import Link from "next/link";
import { SETTINGS_GROUPS } from "./settings-groups";

// Header + tab bar shared by every Pengaturan page. `current` is the href of
// the active tab (matched exactly, query string included).
export function SettingsTabs({ groupId, current }: { groupId: string; current: string }) {
  const group = SETTINGS_GROUPS.find((g) => g.id === groupId);
  if (!group) return null;

  return (
    <div className="mb-5">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-slate-500" aria-label="Navigasi">
        <Link href="/admin" className="font-medium text-indigo-600 hover:underline">
          Pengaturan
        </Link>
        <span>/</span>
        <span>{group.title}</span>
      </nav>
      {group.pages.length > 1 && (
        <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label={group.title}>
          {group.pages.map((p) => {
            const active = p.href === current;
            return (
              <Link
                key={p.href}
                href={p.href}
                role="tab"
                aria-selected={active}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium ${
                  active ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
