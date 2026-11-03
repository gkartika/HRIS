import Link from "next/link";
import { getGaHomeData } from "@/lib/ga-home-queries";
import type { Severity, TodoKind } from "@/lib/ga-home";

const FILTERS: { key: TodoKind | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "ga", label: "Permintaan GA" },
  { key: "wo", label: "Work Order" },
  { key: "pm", label: "Perawatan" },
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
              <Link href={tile.openHref} className="mt-1 block w-fit text-3xl font-semibold tabular-nums text-slate-900 hover:text-indigo-700">
                {tile.total}
              </Link>
              {tile.total === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Tidak ada yang terbuka.</p>
              ) : (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {tile.parts.map((p) => {
                    const inner = (
                      <>
                        <span>
                          {p.label}
                          {p.hint && <span className="text-slate-400"> · {p.hint}</span>}
                        </span>
                        <b className="tabular-nums">{p.count}</b>
                      </>
                    );
                    return (
                      <li key={p.label}>
                        {p.href && p.count > 0 ? (
                          <Link href={p.href} className="-mx-1 flex justify-between gap-2 rounded px-1 hover:bg-slate-50 hover:text-indigo-700">
                            {inner}
                          </Link>
                        ) : (
                          <span className="flex justify-between gap-2">{inner}</span>
                        )}
                      </li>
                    );
                  })}
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
                    <Link href={r.href} className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                      {r.title}
                    </Link>
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Ringkasan aset</p>
              <Link href="/assets" className="text-xs text-indigo-600 hover:underline">
                Semua aset →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Link href="/assets?status=AVAILABLE" className="rounded-lg bg-emerald-50 p-2 hover:bg-emerald-100">
                <p className="text-xl font-semibold tabular-nums text-emerald-800">{data.assetSummary.available}</p>
                <p className="text-[11px] text-emerald-800">Belum digunakan</p>
              </Link>
              <Link href="/assets?status=IN_USE" className="rounded-lg bg-slate-50 p-2 hover:bg-slate-100">
                <p className="text-xl font-semibold tabular-nums text-slate-900">{data.assetSummary.inUse}</p>
                <p className="text-[11px] text-slate-500">Digunakan</p>
              </Link>
              <Link href="/assets?status=UNDER_REPAIR" className="rounded-lg bg-slate-50 p-2 hover:bg-slate-100">
                <p className="text-xl font-semibold tabular-nums text-slate-900">{data.assetSummary.other}</p>
                <p className="text-[11px] text-slate-500">Perbaikan / disposal</p>
              </Link>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Per kategori</p>
            <div className="mt-2 space-y-2.5">
              {data.assetSummary.categories.map((c) => (
                <Link key={c.category} href={c.categoryFilter ? `/assets?category=${encodeURIComponent(c.categoryFilter)}` : "/assets"} className="block rounded hover:bg-slate-50">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800">{c.category}</span>
                    <span className="tabular-nums text-slate-500">
                      <b className="text-emerald-700">{c.available}</b> belum digunakan · <b className="text-slate-900">{c.inUse}</b> digunakan
                      {c.other > 0 ? ` · ${c.other} perbaikan` : ""} · {c.total} total{c.records !== c.total ? ` (${c.records} aset)` : ""}
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
                    <div className="bg-indigo-500" style={{ width: `${(c.inUse / Math.max(1, c.total)) * 100}%` }} />
                    <div className="bg-emerald-400" style={{ width: `${(c.available / Math.max(1, c.total)) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(c.other / Math.max(1, c.total)) * 100}%` }} />
                  </div>
                </Link>
              ))}
              {data.assetSummary.categories.length === 0 && <p className="text-sm text-slate-400">Belum ada aset.</p>}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Dihitung per unit (barang yang dilacak per jumlah dihitung per buah). Aset yang sudah dihapuskan tidak dihitung.</p>
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
                  <Link key={s.id} href={`/consumables/stock?q=${encodeURIComponent(s.itemCode)}`} className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50">
                    <span className="min-w-0 truncate text-slate-900">{s.itemName}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {s.stock} / {s.minStock}
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${s.status === "HABIS" ? PILL.rose : PILL.amber}`}>
                        {s.status === "HABIS" ? "Habis" : "Menipis"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
