import Link from "next/link";
import { currentStep, FORM_LABEL, formHref, STEP_LABELS, statusLine } from "@/lib/production-forms";
import { getProductionHomeData, type FormRow } from "@/lib/production-forms-queries";
import { getDepartmentApprovers, getProductionDepartment } from "@/lib/production-forms-service";
import type { ProductionFormKind, ProductionFormStatus } from "@/generated/prisma/enums";

export type PfTab = "proses" | "perlu" | "selesai" | "semua";

const CARDS: { kind: ProductionFormKind; hint: string; href: string; tone: string }[] = [
  { kind: "EXTRA_WORK", hint: "Karyawan yang bekerja di luar jam biasa", href: "/production-forms/extra-work/new", tone: "bg-indigo-600" },
  { kind: "LEAVE_WORK", hint: "Karyawan keluar saat jam kerja", href: "/production-forms/leave-work/new", tone: "bg-sky-600" },
  { kind: "DISCIPLINE", hint: "Teguran, SP 1, SP 2, SP 3", href: "/production-forms/discipline/new", tone: "bg-slate-700" },
];

const ICON: Record<ProductionFormKind, string> = {
  EXTRA_WORK: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  LEAVE_WORK: "M14 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5M10 17l-5-5 5-5M5 12h11",
  DISCIPLINE: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v4",
};

function Icon({ kind, className = "h-6 w-6" }: { kind: ProductionFormKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[kind]} />
    </svg>
  );
}

function Steps({ status }: { status: ProductionFormStatus }) {
  const now = currentStep(status);
  if (now < 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${i < now ? "bg-emerald-500 text-white" : i === now ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-400"}`}>{i < now ? "✓" : i + 1}</span>
          <span className={`hidden text-[11px] sm:inline ${i === now ? "font-semibold text-slate-800" : "text-slate-400"}`}>{label}</span>
          {i < STEP_LABELS.length - 1 && <span className="h-px w-4 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

const TAB_LABEL: Record<PfTab, string> = { proses: "Sedang diproses", perlu: "Perlu diperbaiki", selesai: "Selesai", semua: "Semua" };
const tabHref = (t: PfTab) => (t === "proses" ? "/dashboard#pf-home" : `/dashboard?pf=${t}#pf-home`);

// Beranda of the Production clerk: three big buttons for the daily forms, what has to be fixed on top, and where every
// form is in plain words.
export async function ProductionAdminHome({ tab, name }: { tab: PfTab; name: string }) {
  const dept = await getProductionDepartment();
  if (!dept) {
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Departemen Production tidak ditemukan di struktur organisasi. Hubungi Admin SDM.</p>;
  }
  const [data, approvers] = await Promise.all([getProductionHomeData(dept.id), getDepartmentApprovers(dept.id)]);
  const now = new Date();
  const hour = Number(new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 13));
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
  const open = (r: FormRow) => r.status === "DRAFT" || r.status === "RETURNED" || r.status === "SUBMITTED" || r.status === "LEADER_APPROVED";
  const counts: Record<PfTab, number> = {
    proses: data.forms.filter(open).length,
    perlu: data.needsFix.length,
    selesai: data.forms.filter((r) => r.status === "COMPLETED").length,
    semua: data.forms.length,
  };
  const rows = (tab === "proses" ? data.forms.filter(open) : tab === "perlu" ? data.needsFix : tab === "selesai" ? data.forms.filter((r) => r.status === "COMPLETED") : data.forms).slice(0, 30);

  return (
    <section id="pf-home" className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-slate-900">{greeting}{name ? `, ${name}` : ""}</p>
        <p className="text-xs text-slate-500">Production · {data.employees} karyawan aktif</p>
      </div>

      {data.needsFix.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500 text-sm font-bold text-white">{data.needsFix.length}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900">{data.needsFix.length === 1 ? "Satu formulir dikembalikan dan perlu Anda perbaiki" : `${data.needsFix.length} formulir dikembalikan dan perlu Anda perbaiki`}</p>
            <p className="truncate text-xs text-rose-800">{data.needsFix[0].title}</p>
          </div>
          <Link href={`${formHref(data.needsFix[0].kind, data.needsFix[0].id)}/edit`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            Perbaiki
          </Link>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.kind} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${c.tone}`}>
                <Icon kind={c.kind} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{FORM_LABEL[c.kind]}</p>
                <p className="text-xs text-slate-500">{c.hint}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              {data.counts[c.kind] === 0 ? (
                <span className="text-xs text-slate-500">tidak ada yang menunggu</span>
              ) : (
                <Link href={`/production-forms?tab=menunggu&jenis=${c.kind}`} className="text-xs text-indigo-600 hover:underline">
                  {data.counts[c.kind]} menunggu →
                </Link>
              )}
              <Link href={c.href} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                + Buat baru
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Formulir saya</p>
            <Link href="/production-forms" className="text-xs text-indigo-600 hover:underline">Cari dan lihat semua →</Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {(Object.keys(TAB_LABEL) as PfTab[]).map((t) => (
              <Link key={t} href={tabHref(t)} scroll={false} className={`rounded-full border px-3 py-1.5 ${tab === t ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                {TAB_LABEL[t]} <b className="tabular-nums">{counts[t]}</b>
              </Link>
            ))}
          </div>
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">{tab === "proses" ? "Tidak ada formulir yang sedang diproses." : "Tidak ada formulir di sini."}</p>
            ) : (
              rows.map((r) => (
                <Link key={`${r.kind}-${r.id}`} href={formHref(r.kind, r.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-slate-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon kind={r.kind} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
                    <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.subtitle}</p>
                  </div>
                  <div className="min-w-0">
                    <Steps status={r.status} />
                    <p className="mt-1 text-xs text-slate-600">{statusLine(r.kind, r, approvers, now)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Gambaran Production</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {data.employees} <span className="text-sm font-normal text-slate-500">karyawan aktif</span>
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              {data.sections.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-slate-700" title={s.name}>{s.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" role="presentation">
                    <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.max(3, Math.round((s.count / Math.max(1, data.sections[0].count)) * 100))}%` }} />
                  </div>
                  <b className="w-8 text-right tabular-nums">{s.count}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Bulan ini (periode {data.month.label})</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2"><dd className="text-lg font-semibold tabular-nums">{data.month.extraWork}</dd><dt className="text-[11px] text-slate-500">Tambahan jam kerja</dt></div>
              <div className="rounded-lg bg-slate-50 p-2"><dd className="text-lg font-semibold tabular-nums">{data.month.leaveWork}</dd><dt className="text-[11px] text-slate-500">Izin</dt></div>
              <div className="rounded-lg bg-slate-50 p-2"><dd className="text-lg font-semibold tabular-nums">{data.month.discipline}</dd><dt className="text-[11px] text-slate-500">SP</dt></div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
