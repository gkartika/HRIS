import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { t } from "@/lib/i18n/id";
import { PERIOD_OPTIONS, type DashboardFilters, type DashboardResult } from "@/lib/recruitment-dashboard";
import { RequestedJobLevel } from "@/generated/prisma/enums";
import { FULFILLMENT_SOURCES, FULFILLMENT_SOURCE_BAR, FULFILLMENT_SOURCE_LABEL, type countBySource } from "@/lib/recruitment-source";

const REQUESTED_JOB_LEVELS = Object.values(RequestedJobLevel);
const field = "rounded-lg border border-slate-200 px-3 py-2 text-sm";
const lab = "mb-1 block text-xs text-slate-500";

const fmtDays = (d: number | null) => (d === null ? "—" : `${d.toLocaleString("id-ID")} hari`);
const fmtPercent = (p: number | null) => (p === null ? "—" : `${p.toLocaleString("id-ID")}%`);

// The dashboard as shown on screen: every number is already worked out (recruitment-dashboard.ts).
export function DashboardView({
  filters,
  result,
  filled,
  departments,
  error,
}: {
  filters: DashboardFilters;
  result: DashboardResult;
  filled: ReturnType<typeof countBySource>;
  departments: { id: string; unitName: string }[];
  error: string | null;
}) {
  const departmentName = new Map(departments.map((d) => [d.id, d.unitName]));
  const filtered = Boolean(filters.departmentId || filters.level || filters.source || filters.period !== "12m");
  const noData = result.funnel[0].count === 0 && result.timeToFill.filled === 0 && result.timeToHire.hired === 0 && filled.total === 0;
  const maxFunnel = Math.max(1, result.funnel[0].count);
  const maxTrend = Math.max(1, ...result.trend.flatMap((m) => [m.applied, m.passed, m.hired]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dasbor Rekrutmen</h1>
          <p className="mt-1 text-sm text-slate-500">Angka diambil dari data lowongan dan pelamar; semua filter berlaku ke seluruh isi halaman.</p>
        </div>
        <Link href="/recruitment/applicants" className="text-sm font-medium text-indigo-600 hover:underline">
          Lihat daftar pelamar
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="d-dept" className={lab}>Departemen</label>
          <select id="d-dept" name="dept" defaultValue={filters.departmentId ?? ""} className={field}>
            <option value="">Semua departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.unitName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="d-level" className={lab}>Level</label>
          <select id="d-level" name="level" defaultValue={filters.level ?? ""} className={field}>
            <option value="">Semua level</option>
            {REQUESTED_JOB_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`requestedJobLevel.${l}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="d-source" className={lab}>Sumber pelamar</label>
          <select id="d-source" name="source" defaultValue={filters.source ?? ""} className={field}>
            <option value="">Eksternal dan internal</option>
            <option value="EXTERNAL">Eksternal</option>
            <option value="INTERNAL">Internal</option>
          </select>
        </div>
        <div>
          <label htmlFor="d-period" className={lab}>Periode (tanggal melamar)</label>
          <select id="d-period" name="period" defaultValue={filters.period} className={field}>
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="d-from" className={lab}>Dari tanggal</label>
          <input id="d-from" type="date" name="from" defaultValue={filters.fromText} className={field} />
        </div>
        <div>
          <label htmlFor="d-to" className={lab}>Sampai tanggal</label>
          <input id="d-to" type="date" name="to" defaultValue={filters.toText} className={field} />
        </div>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {t("common.applyFilter")}
        </button>
        {filtered && (
          <Link href="/recruitment/dashboard" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            {t("common.resetFilter")}
          </Link>
        )}
      </form>
      <p className="-mt-3 text-xs text-slate-400">Dua kolom tanggal hanya dipakai bila periode &quot;Pilih tanggal sendiri&quot;.</p>
      {error && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error} Sementara ditampilkan 12 bulan terakhir.
        </p>
      )}

      {noData ? (
        <EmptyState message="Belum ada data rekrutmen pada filter ini." filtered={filtered} resetHref="/recruitment/dashboard" hint="Angka muncul setelah ada pelamar atau lowongan yang terisi." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Posisi terisi</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{filled.total}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                {FULFILLMENT_SOURCES.map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <i className={`inline-block h-2 w-2 rounded-full ${FULFILLMENT_SOURCE_BAR[s]}`} />
                      {FULFILLMENT_SOURCE_LABEL[s]}
                    </span>
                    <b className="tabular-nums">{filled[s]}</b>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">Hiring rate dan waktu ke diterima hanya menghitung pelamar, bukan Mutasi.</p>
            </div>
            <SummaryCard title="Time to Fill" value={fmtDays(result.timeToFill.days)} note={`rata-rata dari lowongan disetujui sampai terisi penuh · dari ${result.timeToFill.filled} posisi terpenuhi`} />
            <SummaryCard title="Time to Hire" value={fmtDays(result.timeToHire.days)} note={`rata-rata dari tanggal melamar sampai diterima · dari ${result.timeToHire.hired} orang diterima`} />
            <SummaryCard title="Hiring Rate" value={fmtPercent(result.hiringRate.percent)} note={`${result.hiringRate.hired} diterima dari ${result.hiringRate.applicants} pelamar`} />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-medium text-slate-900">Funnel rekrutmen</h2>
            <p className="mt-1 text-xs text-slate-500">Pelamar yang sudah melewati satu tahap ikut terhitung di tahap sebelumnya. Persen = dari tahap sebelumnya.</p>
            <ol className="mt-4 space-y-2">
              {result.funnel.map((step) => (
                <li key={step.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-slate-700">{step.label}</span>
                  <span className="h-6 rounded bg-slate-100">
                    <span className="block h-6 rounded bg-indigo-500" style={{ width: `${Math.max(step.count > 0 ? 1.5 : 0, (step.count / maxFunnel) * 100)}%` }} />
                  </span>
                  <span className="min-w-28 text-right tabular-nums text-slate-900">
                    {step.count}
                    {step.fromPrevious !== null && <span className="ml-2 text-xs text-slate-500">{step.fromPrevious.toLocaleString("id-ID")}%</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-900">Tren bulanan</h2>
              <p className="flex flex-wrap gap-4 text-xs text-slate-600">
                <Legend color="bg-indigo-500" label="Pelamar baru" />
                <Legend color="bg-amber-500" label="Lolos tes" />
                <Legend color="bg-emerald-500" label="Diterima" />
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <div className="flex h-44 min-w-fit items-end gap-3" role="img" aria-label="Grafik batang per bulan: pelamar baru, lolos tes, diterima">
                {result.trend.map((m) => (
                  <div key={m.key} className="flex w-14 shrink-0 flex-col items-center gap-1">
                    <div className="flex h-36 items-end gap-0.5">
                      <Bar value={m.applied} max={maxTrend} color="bg-indigo-500" />
                      <Bar value={m.passed} max={maxTrend} color="bg-amber-500" />
                      <Bar value={m.hired} max={maxTrend} color="bg-emerald-500" />
                    </div>
                    <span className="text-[11px] text-slate-500">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-indigo-600">Lihat angkanya</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-1 pr-4 font-medium">Bulan</th>
                      <th className="py-1 pr-4 font-medium">Pelamar baru</th>
                      <th className="py-1 pr-4 font-medium">Lolos tes</th>
                      <th className="py-1 font-medium">Diterima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trend.map((m) => (
                      <tr key={m.key} className="border-t border-slate-100">
                        <td className="py-1 pr-4 text-slate-700">{m.label}</td>
                        <td className="py-1 pr-4 tabular-nums">{m.applied}</td>
                        <td className="py-1 pr-4 tabular-nums">{m.passed}</td>
                        <td className="py-1 tabular-nums">{m.hired}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-medium text-slate-900">Per departemen</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Departemen</th>
                    <th className="px-3 py-2 font-medium">Posisi dibuka</th>
                    <th className="px-3 py-2 font-medium">Pelamar</th>
                    <th className="px-3 py-2 font-medium">Lolos tes</th>
                    <th className="px-3 py-2 font-medium">Diterima</th>
                    <th className="px-3 py-2 font-medium">Hiring Rate</th>
                    <th className="px-3 py-2 font-medium">Time to Fill</th>
                    <th className="px-3 py-2 font-medium">Time to Hire</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.departmentId} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{departmentName.get(r.departmentId) ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{r.openings}</td>
                      <td className="px-3 py-2 tabular-nums">{r.applicants}</td>
                      <td className="px-3 py-2 tabular-nums">{r.passed}</td>
                      <td className="px-3 py-2 tabular-nums">{r.hired}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtPercent(r.hiringRate)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDays(r.timeToFill)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDays(r.timeToHire)}</td>
                    </tr>
                  ))}
                  {result.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-400">Belum ada data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-medium text-slate-900">Eksternal dan internal</h2>
            <p className="mt-1 text-xs text-slate-500">Diterima = karyawan baru (eksternal) atau promosi/mutasi lewat Perubahan Posisi (internal), pada periode ini.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {result.bySource.map((s) => (
                <div key={s.source} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">{s.source === "EXTERNAL" ? "Eksternal (karyawan baru)" : "Internal (promosi / mutasi)"}</p>
                  <p className="mt-1 text-sm text-slate-900">
                    <span className="text-lg font-semibold tabular-nums">{s.hired}</span> diterima · {s.applicants} pelamar
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex h-full w-3.5 flex-col justify-end text-center" title={String(value)}>
      {value > 0 && <span className="mb-0.5 text-[10px] leading-none text-slate-600">{value}</span>}
      <div className={`w-full rounded-t ${color}`} style={{ height: `${value > 0 ? Math.max(3, (value / max) * 85) : 0}%` }} />
    </div>
  );
}
