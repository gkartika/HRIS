import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { formatCutoffParam, parseCutoffParam } from "@/lib/absence-cutoff";
import { resolvePeriod, previousPeriod, nextPeriod, parseReportView, type ReportViewType } from "@/lib/report-period";
import { getMandaysLostReport, type BucketGranularity } from "@/lib/mandays-lost";

const VIEW_OPTIONS: { value: ReportViewType; label: string }[] = [
  { value: "cycle", label: "Siklus Gaji" },
  { value: "year", label: "Tahunan" },
];

// 2 decimals throughout, not 1: with a company-wide denominator in the
// thousands, a single lost day rounds to "0.0%" at 1 decimal, which reads
// as a calculation error sitting right next to a nonzero Total column.
function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

// "Report 2026" replacement — per direct request, a mandays-lost breakdown
// by Department, viewable per salary-cycle/year, plus the % of scheduled
// working days actually lost. See mandays-lost.ts for the
// counting/percentage rules and report-period.ts for the 2 period kinds.
export default async function MandaysLostReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; ref?: string }>;
}) {
  const session = await requireSession();
  if (!isHrAdmin(session)) {
    return <AccessDenied />;
  }

  const { view: viewParam, ref } = await searchParams;
  const view = parseReportView(viewParam);
  const referenceDate = parseCutoffParam(ref) ?? new Date();
  const period = resolvePeriod(view, referenceDate);
  const prev = previousPeriod(view, period);
  const next = nextPeriod(view, period);
  // Siklus Gaji buckets by week, matching the original spreadsheet's
  // "mandays lost every week" cadence; Tahunan buckets by month. (A
  // separate single-week/single-month daily drill-down was dropped, per
  // direct feedback, as redundant with these two's own Total/% columns.)
  const bucketBy: BucketGranularity = view === "year" ? "month" : "week";

  const report = await getMandaysLostReport(period, bucketBy);

  const viewHref = (v: ReportViewType) => `/attendance/mandays-lost?view=${v}&ref=${formatCutoffParam(period.start)}`;
  const navHref = (date: Date) => `/attendance/mandays-lost?view=${view}&ref=${formatCutoffParam(date)}`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Mandays Lost</h1>
          <p className="mt-1 text-sm text-slate-500">Periode {period.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={navHref(prev.start)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            ← Sebelumnya
          </Link>
          <Link href={navHref(next.start)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Berikutnya →
          </Link>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {VIEW_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={viewHref(opt.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              view === opt.value ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-4">
        <div className="flex flex-1 min-w-[240px] items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <path d="M4 19h16M8 15l4-6 3 4 3-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-rose-800">{report.grandTotal}</p>
            <p className="text-xs text-rose-700">total mandays lost periode ini</p>
          </div>
        </div>
        <div className="flex flex-1 min-w-[240px] items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-800">{formatPercent(report.grandPercent)}</p>
            <p className="text-xs text-amber-700">
              dari {report.grandScheduled} mandays terjadwal periode ini
            </p>
          </div>
        </div>
      </div>

      <section className="mt-5 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-medium text-slate-500">Departemen</th>
              {report.buckets.map((b) => (
                <th key={b.bucketStart.toISOString()} className="border-b border-l border-slate-200 px-3 py-3 text-center text-xs font-medium text-slate-500">
                  {b.label}
                </th>
              ))}
              <th className="border-b border-l border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-700">Total</th>
              <th className="border-b border-l border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-700">%</th>
            </tr>
          </thead>
          <tbody>
            {report.departmentRows.map((row) => (
              <tr key={row.departmentId} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-sm text-slate-800">{row.departmentName}</td>
                {row.byBucket.map((n, i) => (
                  <td key={i} className={`border-l border-slate-100 px-3 py-2.5 text-center text-sm ${n > 0 ? "font-semibold text-rose-700" : "text-slate-300"}`}>
                    {n}
                  </td>
                ))}
                <td className="border-l border-slate-100 px-3 py-2.5 text-center text-sm font-bold text-slate-900">{row.total}</td>
                <td className="border-l border-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-amber-700">{formatPercent(row.percent)}</td>
              </tr>
            ))}
            {report.departmentRows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={report.buckets.length + 3}>
                  Tidak ada karyawan aktif untuk periode ini.
                </td>
              </tr>
            )}
          </tbody>
          {report.departmentRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">Total</td>
                {report.totalByBucket.map((n, i) => (
                  <td key={i} className="border-l border-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-slate-700">
                    {n}
                  </td>
                ))}
                <td className="border-l border-slate-100 px-3 py-2.5 text-center text-sm font-bold text-slate-900">{report.grandTotal}</td>
                <td className="border-l border-slate-100 px-3 py-2.5 text-center text-sm font-bold text-amber-700">{formatPercent(report.grandPercent)}</td>
              </tr>
              <tr className="border-t border-slate-100 bg-slate-50">
                <td className="px-4 py-2 text-xs font-medium text-slate-500">%</td>
                {report.percentByBucket.map((p, i) => (
                  <td key={i} className="border-l border-slate-100 px-3 py-2 text-center text-xs font-semibold text-amber-700">
                    {formatPercent(p)}
                  </td>
                ))}
                <td className="border-l border-slate-100 px-3 py-2 text-center text-xs text-slate-300">—</td>
                <td className="border-l border-slate-100 px-3 py-2 text-center text-xs text-slate-300">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">Rincian per Jenis</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {report.byType.map((tp) => (
            <div key={tp.code} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">
                <span className="font-mono text-xs text-slate-400">{tp.code}</span> — {tp.label}
              </span>
              <span className="font-semibold text-slate-900">{tp.count} hari</span>
            </div>
          ))}
          {report.byType.length === 0 && <p className="py-2 text-sm text-slate-400">Belum ada data.</p>}
        </div>
      </section>
    </div>
  );
}
