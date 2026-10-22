import Link from "next/link";
import { getRecruitmentHomeData, type RecruitmentHomeData } from "@/lib/recruitment-home-queries";
import { actionableCount, REC_FILTERS, type RecKind } from "@/lib/recruitment-home";
import type { Severity } from "@/lib/ga-home";

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
const AUDIENCE: Record<string, string> = { EXTERNAL: "Eksternal", INTERNAL: "Internal", BOTH: "Eksternal + internal" };

function filterHref(key: RecKind | "all"): string {
  return key === "all" ? "/dashboard#rec-home" : `/dashboard?rec=${key}#rec-home`;
}

// Beranda for Admin Rekrutmen: what is open in every recruitment step at a glance, one list of
// what is waiting for the recruiter, and the vacancies and setup checks at the side. Same layout
// as the Admin GA and Admin SDM Beranda.
export async function RecruitmentAdminHome({ filter }: { filter: RecKind | "all" }) {
  return <RecruitmentHomeView data={await getRecruitmentHomeData()} filter={filter} />;
}

function RecruitmentHomeView({ data, filter }: { data: RecruitmentHomeData; filter: RecKind | "all" }) {
  const rows = filter === "all" ? data.rows : data.rows.filter((r) => r.kind === filter);
  const { summary } = data;
  const waiting = actionableCount(data.rows);
  const barTotal = Math.max(1, summary.applicants);

  return (
    <section id="rec-home" className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Status Rekrutmen</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {waiting === 0
            ? "Tidak ada yang menunggu tindakan Anda."
            : `${waiting} hal menunggu tindakan Anda. Perubahan Posisi pelamar internal juga dijalankan dari sini.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.tiles.map((tile) => {
          const tag = TILE_TAG[tile.severity];
          const active = tile.filter !== null && tile.filter === filter;
          const canFilter = tile.filter !== null && data.counts[tile.filter] > 0;
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
              {tile.note && <p className={`mt-2 border-t border-slate-100 pt-2 text-[11px] ${tile.noteSevere ? "text-rose-600" : "text-slate-500"}`}>{tile.note}</p>}
              <div className="mt-2 flex items-center justify-between text-xs">
                {canFilter ? (
                  <Link href={active ? "/dashboard#rec-home" : filterHref(tile.filter as RecKind)} scroll={false} className="text-slate-500 hover:text-slate-700">
                    {active ? "Tampilkan semua" : "Tampilkan di daftar"}
                  </Link>
                ) : (
                  <span />
                )}
                <Link href={tile.openHref} className="font-medium text-indigo-600 hover:underline">
                  {tile.openHref === "/recruitment/dashboard" ? "Buka Dasbor Rekrutmen →" : "Buka daftar →"}
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
              {REC_FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={filterHref(f.key)}
                  scroll={false}
                  className={`rounded-full border px-2.5 py-1 ${filter === f.key ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {f.label} {data.counts[f.key]}
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Ringkasan 30 hari</p>
              <Link href="/recruitment/dashboard" className="text-xs text-indigo-600 hover:underline">
                Dasbor →
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{summary.applicants}</dd>
                <dt className="text-[11px] text-slate-500">Pelamar baru</dt>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{summary.passed}</dd>
                <dt className="text-[11px] text-slate-500">Lolos tes</dt>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dd className="text-xl font-semibold tabular-nums text-slate-900">{summary.hired}</dd>
                <dt className="text-[11px] text-slate-500">Diterima</dt>
              </div>
            </dl>
            {summary.applicants > 0 && (
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
                <div className="bg-brand" style={{ width: `${Math.min(100, (summary.hired / barTotal) * 100)}%` }} />
                <div className="bg-amber-400" style={{ width: `${Math.max(0, Math.min(100, ((summary.passed - summary.hired) / barTotal) * 100))}%` }} />
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              {summary.hiringRate === null ? "Belum ada pelamar dalam 30 hari terakhir." : `Hiring rate ${summary.hiringRate.toLocaleString("id-ID")}%`}
              {summary.avgDaysToHire !== null && ` · rata-rata ${summary.avgDaysToHire.toLocaleString("id-ID")} hari dari melamar sampai diterima`}
              {summary.hiringRate !== null && "."}
            </p>
          </div>

          {data.unopenedRequests.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  Belum dibuka <span className={`ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${PILL.amber}`}>{data.unopenedRequests.length} permintaan</span>
                </p>
                <Link href="/recruitment" className="text-xs text-indigo-600 hover:underline">
                  Semua permintaan →
                </Link>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Sudah disetujui, belum dibuka untuk pelamar. Yang paling lama menunggu di atas.</p>
              <div className="mt-2 divide-y divide-slate-100 text-sm">
                {data.unopenedRequests.slice(0, 6).map((r) => (
                  <Link key={r.id} href={`/recruitment/${r.id}`} className={`flex items-center justify-between gap-2 py-2 hover:bg-slate-50 ${r.held ? "opacity-70" : ""}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-slate-900">{r.jobLabel}</span>
                      <span className="text-[11px] text-slate-400">
                        {r.requestNumber} · {r.department} · {r.seatsLeft} posisi
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block rounded-md px-2 py-0.5 text-[11px] font-medium ${r.held ? "bg-amber-100 text-amber-800" : PILL[r.severity]}`}>{r.held ? "Ditahan" : r.waitingLabel}</span>
                      <span className={`mt-1 inline-block text-xs ${r.held ? "text-slate-400" : "font-medium text-indigo-600"}`}>{r.held ? "tidak bisa dibuka" : "Buka lowongan →"}</span>
                    </span>
                  </Link>
                ))}
                {data.unopenedRequests.length > 6 && <p className="pt-2 text-xs text-slate-400">dan {data.unopenedRequests.length - 6} permintaan lain.</p>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Lowongan dibuka</p>
              <Link href="/recruitment" className="text-xs text-indigo-600 hover:underline">
                Semua lowongan →
              </Link>
            </div>
            {data.vacancies.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Belum ada lowongan yang dibuka untuk pelamar.</p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 text-sm">
                {data.vacancies.slice(0, 6).map((v) => (
                  <Link key={v.id} href={`/recruitment/${v.id}`} className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-slate-900">{v.jobLabel}</span>
                      <span className="text-[11px] text-slate-400">
                        {v.requestNumber} · {AUDIENCE[v.openFor]}
                        {v.accessCode && (v.openFor === "EXTERNAL" || v.openFor === "BOTH") ? ` · kode ${v.accessCode}` : ""}
                      </span>
                    </span>
                    {v.problems.length > 0 ? (
                      <span title={v.problems.join(" ")} className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${PILL.amber}`}>
                        Belum siap
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-500">
                        {v.applicants} pelamar · {v.seatsLeft} posisi
                      </span>
                    )}
                  </Link>
                ))}
                {data.vacancies.length > 6 && <p className="pt-2 text-xs text-slate-400">dan {data.vacancies.length - 6} lowongan lain.</p>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Cek pengaturan</p>
              <Link href="/recruitment/settings" className="text-xs text-indigo-600 hover:underline">
                Pengaturan →
              </Link>
            </div>
            {data.warnings.shown.length === 0 ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Semua pengaturan siap: soal tes terisi dan lowongan yang dibuka bisa menerima pelamar.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.warnings.shown.map((w) => (
                  <div key={w.text} className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-slate-800">
                    <span>{w.text}</span>
                    <Link href={w.href} className="shrink-0 font-medium text-indigo-600 hover:underline">
                      {w.actionLabel}
                    </Link>
                  </div>
                ))}
                {data.warnings.hidden > 0 && <p className="text-[11px] text-slate-400">dan {data.warnings.hidden} lainnya.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
