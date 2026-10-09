import Link from "next/link";
import { getHcHomeData, type HcHomeData } from "@/lib/hc-home-queries";
import { groupByHorizon, type HcTodoRow, type Horizon } from "@/lib/hc-home";
import type { Severity } from "@/lib/ga-home";
import { TriggerEvaluationButton } from "./trigger-evaluation-button";

const STRIPE: Record<Severity, string> = { rose: "bg-rose-500", amber: "bg-amber-400", slate: "bg-slate-300" };
const PILL: Record<Severity, string> = {
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-600",
};
const GROUP_PILL: Record<Horizon, string> = {
  late: "bg-rose-50 text-rose-700",
  today: "bg-amber-50 text-amber-800",
  week: "bg-slate-100 text-slate-600",
  upcoming: "bg-slate-100 text-slate-600",
};
const SEGMENT_COLOR: Record<string, string> = {
  PKWTT: "bg-brand",
  PKWT: "bg-[#a8672a]",
  HARIAN_LEPAS: "bg-brand-accent",
  MAGANG: "bg-slate-400",
};

function TodoItem({ row }: { row: HcTodoRow }) {
  return (
    <div className="flex items-stretch gap-3 px-4 py-3 hover:bg-slate-50">
      <span className={`w-1 shrink-0 rounded-full ${STRIPE[row.severity]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-400">{row.type}</p>
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
          <Link href={row.href} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-white">
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

function SetupCard({ warnings }: { warnings: HcHomeData["warnings"] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Cek pengaturan</p>
        <Link href="/admin" className="text-xs text-indigo-600 hover:underline">
          Pengaturan →
        </Link>
      </div>
      {warnings.length === 0 ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Semua pengaturan siap: penyetuju cuti, libur, akses HR Manager, dan posisi kosong.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {warnings.map((w) => (
            <div key={w.text} className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-slate-800">
              <span>{w.text}</span>
              <Link href={w.href} className="shrink-0 font-medium text-indigo-600 hover:underline">
                {w.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadcountCard({ headcount }: { headcount: HcHomeData["headcount"] }) {
  const total = headcount.segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Ringkasan karyawan</p>
        <Link href="/employees" className="text-xs text-indigo-600 hover:underline">
          Data Karyawan →
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-xl font-semibold tabular-nums text-slate-900">{headcount.active}</dd>
          <dt className="text-[11px] text-slate-500">Aktif</dt>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-xl font-semibold tabular-nums text-slate-900">{headcount.vacantPositions}</dd>
          <dt className="text-[11px] text-slate-500">Posisi kosong</dt>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dd className="text-xl font-semibold tabular-nums text-slate-900">{headcount.withoutAccount}</dd>
          <dt className="text-[11px] text-slate-500">Tanpa akun</dt>
        </div>
      </dl>
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200" role="presentation">
            {headcount.segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.code} className={SEGMENT_COLOR[s.code]} style={{ width: `${(s.count / total) * 100}%` }} />
              ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
            {headcount.segments.map((s) => (
              <li key={s.code} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-sm ${SEGMENT_COLOR[s.code]}`} />
                {s.label} {s.count}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Beranda for Admin SDM: one list of what is waiting for HC, grouped by when
// it needs doing, with the payroll period, setup warnings and headcount at the
// side. Replaces the four plain number cards and the expiring-contracts table.
export async function HcHome() {
  const data = await getHcHomeData();
  const groups = groupByHorizon(data.todo);

  return (
    <section id="hc-home" className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Yang perlu Anda kerjakan</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {data.todo.length === 0
            ? "Tidak ada yang menunggu tindakan Anda."
            : `${data.todo.length} hal menunggu tindakan Anda, dikelompokkan menurut kapan harus dikerjakan. Keputusan Setujui/Tolak ada di bagian Perlu Persetujuan di atas.`}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
              Semua pekerjaan HC sudah selesai.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.horizon}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.label}</p>
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GROUP_PILL[g.horizon]}`}>{g.rows.length}</span>
                  <span className="text-[11px] text-slate-400">{g.hint}</span>
                </div>
                <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {g.rows.map((row) => (
                    <TodoItem key={`${row.kind}-${row.href}-${row.title}`} row={row} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <PayrollCard payroll={data.payroll} />
          <SetupCard warnings={data.warnings} />
          <HeadcountCard headcount={data.headcount} />
        </div>
      </div>
    </section>
  );
}
