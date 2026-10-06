import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { SETTINGS_GROUPS } from "./settings-groups";

export default async function AdminHomePage() {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) {
    return <AccessDenied />;
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Pengaturan</h1>
      <p className="mt-1 text-sm text-slate-500">
        Semua pengaturan aplikasi ada di sini. Pilih tombol di kartu untuk membuka halamannya.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {SETTINGS_GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <section key={g.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{g.title}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{g.desc}</p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {g.pages.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
