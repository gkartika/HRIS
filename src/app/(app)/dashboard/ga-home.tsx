import Link from "next/link";
import { getGaHomeData } from "@/lib/ga-home-queries";
import type { Severity, TodoKind } from "@/lib/ga-home";

const FILTERS: { key: TodoKind | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "ga", label: "Permintaan GA" },
  { key: "wo", label: "Work Order" },
  { key: "dp", label: "Disposal" },
  { key: "of", label: "Offboarding" },
  { key: "st", label: "Stok" },
];

const STRIPE: Record<Severity, string> = { rose: "bg-rose-500", amber: "bg-amber-400", slate: "bg-slate-300" };
const PILL: Record<Severity, string> = {
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-600",
};
const TILE_TAG: Record<Severity, { label: string; tone: string }> = {
  rose: { label: "mendesak", tone: "bg-rose-50 text-rose-700" },
  amber: { label: "perhatian", tone: "bg-amber-50 text-amber-800" },
  slate: { label: "aman", tone: "bg-slate-100 text-slate-600" },
};

function filterHref(key: TodoKind | "all"): string {
  return key === "all" ? "/dashboard#ga-home" : `/dashboard?ga=${key}#ga-home`;
}

// Beranda for Admin GA: what is open in every GA area, at a glance, and one
// list of what is waiting for GA. Replaces the nine plain number cards.
export async function GaHome({ filter }: { filter: TodoKind | "all" }) {
  const data = await getGaHomeData();
  const rows = filter === "all" ? data.todo : data.todo.filter((r) => r.kind === filter);

  return (
    <section id="ga-home" className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Status Aset &amp; GA</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {data.todoCounts.all === 0
            ? "Tidak ada yang menunggu tindakan Anda."
            : `${data.todoCounts.all} hal menunggu tindakan Anda. Keputusan Setujui/Tolak ada di bagian Perlu Persetujuan di atas.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.tiles.map((tile) => {
          const tag = TILE_TAG[tile.severity];
          const active = tile.filter !== null && tile.filter === filter;
          return (
            <div key={tile.title} className={`rounded-xl border bg-white p-4 ${active ? "border-brand ring-1 ring-brand" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">{tile.title}</p>
                {tile.total > 0 && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tag.tone}`}>{tag.label}</span>}
              </div>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{tile.total}</p>
              {tile.total === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Tidak ada yang terbuka.</p>
              ) : (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {tile.parts.map((p) => (
                    <li key={p.label} className="flex justify-between gap-2">
                      <span>
                        {p.label}
                        {p.hint && <span className="text-slate-400"> · {p.hint}</span>}
                      </span>
                      <b className="tabular-nums">{p.count}</b>
                    </li>
                  ))}
                </ul>
              )}
              {tile.note && (
                <p className={`mt-2 border-t border-slate-100 pt-2 text-[11px] ${tile.severity === "rose" ? "text-rose-600" : "text-slate-500"}`}>{tile.note}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs">
                {tile.filter !== null && data.todoCounts[tile.filter] > 0 ? (
                  <Link href={active ? "/dashboard#ga-home" : filterHref(tile.filter)} scroll={false} className="text-slate-500 hover:text-slate-700">
                    {active ? "Tampilkan semua" : "Tampilkan di daftar"}
                  </Link>
                ) : (
                  <span />
                )}
                <Link href={tile.openHref} className="font-medium text-indigo-600 hover:underline">
                  Buka daftar →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Perlu ditindak <span className="font-normal text-slate-400">· yang paling lama menunggu di atas</span>
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={filterHref(f.key)}
                  scroll={false}
                  className={`rounded-full border px-2.5 py-1 ${filter === f.key ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {f.label} {data.todoCounts[f.key]}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Tidak ada yang perlu ditindak di kategori ini.</p>
            ) : (
              rows.map((r) => (
                <div key={`${r.kind}-${r.href}-${r.title}`} className="flex items-stretch gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className={`w-1 shrink-0 rounded-full ${STRIPE[r.severity]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-400">{r.type}</p>
                    <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.who}</p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${PILL[r.severity]}`}>{r.statusLabel}</span>
                    {r.timeLabel && <span className="text-[11px] text-slate-400">{r.timeLabel}</span>}
                  </div>
                  <Link href={r.href} className="shrink-0 self-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-white">
                    {r.actionLabel}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Ringkasan aset</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{data.assetSummary.totalAssets}</dd>
                <dt className="text-[11px] text-slate-500">Aset aktif</dt>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{data.assetSummary.inUse}</dd>
                <dt className="text-[11px] text-slate-500">Digunakan</dt>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{data.assetSummary.activeCustodies}</dd>
                <dt className="text-[11px] text-slate-500">Penguasaan aktif</dt>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Stok perlu dibeli</p>
              <Link href="/consumables/stock" className="text-xs text-indigo-600 hover:underline">
                Buka stok →
              </Link>
            </div>
            {data.lowStock.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Semua stok aman.</p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 text-sm">
                {data.lowStock.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate text-slate-900">{s.itemName}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {s.stock} / {s.minStock}
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${s.status === "HABIS" ? PILL.rose : PILL.amber}`}>
                        {s.status === "HABIS" ? "Habis" : "Menipis"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
