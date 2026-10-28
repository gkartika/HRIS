import Link from "next/link";
import { getHcHomeData, type HcHomeData } from "@/lib/hc-home-queries";
import { categoryCounts, groupByCategory, HC_FILTERS, type HcCategory, type HcTodoRow } from "@/lib/hc-home";
import type { Severity } from "@/lib/ga-home";
import { TriggerEvaluationButton } from "./trigger-evaluation-button";

const STRIPE: Record<Severity, string> = { rose: "bg-rose-500", amber: "bg-amber-400", slate: "bg-slate-300" };
const PILL: Record<Severity, string> = {
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-600",
};
const SEGMENT_COLOR: Record<string, string> = {
  PKWTT: "bg-brand",
  PKWT: "bg-[#a8672a]",
  HARIAN_LEPAS: "bg-brand-accent",
  MAGANG: "bg-slate-400",
};
// How many rows of one group show in the "Semua" view; the rest is one click away.
const GROUP_LIMIT = 5;

function filterHref(key: HcCategory | "all"): string {
  return key === "all" ? "/dashboard#hc-home" : `/dashboard?hc=${key}#hc-home`;
}

function TodoItem({ row }: { row: HcTodoRow }) {
  return (
    <div className="flex items-stretch gap-3 px-4 py-3 hover:bg-slate-50">
      <span className={`w-1 shrink-0 rounded-full ${STRIPE[row.severity]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-500">{row.type}</p>
        <p className="text-sm font-medium text-slate-900">{row.title}</p>
        <p className="text-xs text-slate-500">{row.who}</p>
      </div>
      <div className="hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${PILL[row.severity]}`}>{row.statusLabel}</span>
        {row.timeLabel && <span className="text-[11px] text-slate-400">{row.timeLabel}</span>}
      </div>
      <div className="shrink-0 self-center">
        {row.startEvaluationContractId ? (
          <TriggerEvaluationButton contractId={row.startEvaluationContractId} />
        ) : (
          <Link href={row.href} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            {row.actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function PayrollCard({ payroll }: { payroll: HcHomeData["payroll"] }) {
  const { progress } = payroll;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Periode payroll</p>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{payroll.label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {progress.daysLeft === 0 ? "Batas hari ini" : `${progress.daysLeft} hari lagi`}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
        <div className="h-full bg-brand" style={{ width: `${progress.elapsedPercent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {payroll.unresolvedDays === 0
          ? "Tidak ada hari absensi yang belum selesai."
          : `${payroll.unresolvedDays} hari absensi (${payroll.unresolvedEmployees} karyawan) belum selesai. Selesaikan sebelum batas, lalu ekspor Excel.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={payroll.reconciliationHref} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
          Buka Rekonsiliasi
        </Link>
        <a href={payroll.exportHref} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-slate-50">
          Export Excel
        </a>
      </div>
    </div>
  );
}

// A quick look at the organisation today: how many people, on what employment status, in which department, how many seats
// are filled and who is coming or going.
function OutlookCard({ outlook }: { outlook: HcHomeData["outlook"] }) {
  const biggest = Math.max(1, ...outlook.departments.map((d) => d.count));
  const segmentTotal = Math.max(1, outlook.segments.reduce((sum, s) => sum + s.count, 0));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Gambaran organisasi</p>
        <Link href="/employees" className="text-xs text-indigo-600 hover:underline">
          Data Karyawan →
        </Link>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
        {outlook.active} <span className="text-sm font-normal text-slate-500">karyawan aktif</span>
      </p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status kepegawaian</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-200" role="presentation">
        {outlook.segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.code} className={SEGMENT_COLOR[s.code]} style={{ width: `${(s.count / segmentTotal) * 100}%` }} />
          ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
        {outlook.segments.map((s) => (
          <span key={s.code} className="flex items-center justify-between">
            <span>
              <i className={`mr-1.5 inline-block h-2 w-2 rounded-sm ${SEGMENT_COLOR[s.code]}`} />
              {s.label}
            </span>
            <b className="tabular-nums">{s.count}</b>
          </span>
        ))}
      </div>

      {outlook.departments.length > 0 && (
        <>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Per departemen</p>
          <div className="mt-2 space-y-1.5">
            {outlook.departments.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate text-slate-700" title={d.name}>
                  {d.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" role="presentation">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.max(3, Math.round((d.count / biggest) * 100))}%` }} />
                </div>
                <b className="w-8 text-right tabular-nums text-slate-900">{d.count}</b>
              </div>
            ))}
            {outlook.withoutPosition > 0 && <p className="text-[11px] text-slate-400">{outlook.withoutPosition} karyawan belum punya posisi.</p>}
          </div>
        </>
      )}

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pergerakan</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-lg font-semibold tabular-nums text-slate-900">
            {outlook.positionsFilled} <span className="text-xs font-normal text-slate-400">/ {outlook.positionsTotal}</span>
          </dd>
          <dt className="text-[11px] text-slate-500">Posisi terisi ({outlook.vacantPositions} kosong)</dt>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{outlook.joinedThisMonth}</dd>
          <dt className="text-[11px] text-slate-500">Masuk bulan ini</dt>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{outlook.leaving}</dd>
          <dt className="text-[11px] text-slate-500">Sedang keluar</dt>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{outlook.contractsEnding90}</dd>
          <dt className="text-[11px] text-slate-500">Kontrak berakhir 90 hari</dt>
        </div>
      </dl>
    </div>
  );
}

// Beranda for Admin SDM: a reminder of what to do (grouped by kind of work) and a quick look at the organisation today.
// The Setujui/Tolak decisions stay in the approvals section above.
export async function HcHome({ filter }: { filter: HcCategory | "all" }) {
  const data = await getHcHomeData();
  const counts = categoryCounts(data.todo);
  const groups = groupByCategory(data.todo).filter((g) => filter === "all" || g.key === filter);

  return (
    <section id="hc-home" className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Beranda Admin SDM</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {data.todo.length === 0
            ? "Tidak ada yang menunggu tindakan Anda."
            : `${data.todo.length} hal menunggu tindakan Anda. Keputusan Setujui/Tolak ada di bagian Perlu Persetujuan di atas.`}
        </p>
      </div>

      {data.warnings.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {data.warnings.map((w) => (
            <p key={w.text}>
              <b>Perlu dicek:</b> {w.text}{" "}
              <Link href={w.href} className="ml-1 font-medium text-indigo-700 underline">
                {w.actionLabel} →
              </Link>
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <p className="text-sm font-semibold text-slate-900">
            Kerjakan sekarang <span className="font-normal text-slate-400">· per jenis pekerjaan, yang paling mendesak di atas</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {HC_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={filterHref(f.key)}
                scroll={false}
                className={`rounded-full border px-2.5 py-1 ${filter === f.key ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {f.label} <b className="tabular-nums">{counts[f.key]}</b>
              </Link>
            ))}
          </div>
          <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {groups.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">{filter === "all" ? "Semua pekerjaan HC sudah selesai." : "Tidak ada yang perlu dikerjakan di kategori ini."}</p>
            ) : (
              groups.map((g) => {
                const shown = filter === "all" ? g.rows.slice(0, GROUP_LIMIT) : g.rows;
                return (
                  <div key={g.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 bg-slate-50 px-4 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {g.label} <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium normal-case tabular-nums text-slate-700 ring-1 ring-slate-200">{g.rows.length}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">{g.hint}</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {shown.map((row) => (
                        <TodoItem key={`${row.kind}-${row.href}-${row.title}`} row={row} />
                      ))}
                      {shown.length < g.rows.length && (
                        <Link href={filterHref(g.key)} scroll={false} className="block px-4 py-2 text-xs font-medium text-indigo-600 hover:bg-slate-50">
                          Tampilkan {g.rows.length - shown.length} lagi di {g.label} →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <OutlookCard outlook={data.outlook} />
          <PayrollCard payroll={data.payroll} />
        </div>
      </div>
    </section>
  );
}
