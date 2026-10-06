import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { resolveCutoffPeriod, previousCutoffPeriod, nextCutoffPeriod, formatCutoffParam, parseCutoffParam } from "@/lib/absence-cutoff";
import { getUnresolvedDays, getAttendanceNotices } from "@/lib/attendance-reconciliation-queue";
import { ClassifyRowForm } from "./classify-row-form";

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

// Opsi A — the day-to-day default (per direct request): most employee-days
// need zero action (punch matched, or an approved Cuti/Izin already covers
// it), so only the days that genuinely need a human call show up here.
// Opsi B (the full grid, linked below) is the separate check-and-override
// tool for auditing or correcting anything, including days already resolved
// here.
export default async function AttendanceReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ cutoff?: string }>;
}) {
  const session = await requireSession();
  if (!isHrAdmin(session)) {
    return <AccessDenied />;
  }


  const { cutoff } = await searchParams;
  const referenceDate = parseCutoffParam(cutoff) ?? new Date();
  const period = resolveCutoffPeriod(referenceDate);
  const prevPeriod = previousCutoffPeriod(period);
  const nextPeriod = nextCutoffPeriod(period);

  const [unresolvedDays, absenceTypes, totalRecordsInPeriod, attendanceNotices] = await Promise.all([
    getUnresolvedDays(period),
    // LAINNYA is excluded here — in this classify context it's replaced by
    // the "Masuk (Lupa Absen)" pseudo-option (present-override.ts): a day
    // with no punch is usually a forgotten scan, not a real "other" absence.
    prisma.absenceTypeConfig.findMany({
      where: { activeFlag: true, code: { not: "LAINNYA" } },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true },
    }),
    prisma.dailyAttendanceRecord.count({ where: { attendanceDate: { gte: period.start, lte: period.end } } }),
    getAttendanceNotices(period),
  ]);

  const resolvedCount = totalRecordsInPeriod - unresolvedDays.length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Rekonsiliasi Absensi</h1>
          <p className="mt-1 text-sm text-slate-500">Periode {period.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/attendance/reconciliation?cutoff=${formatCutoffParam(prevPeriod.start)}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ← Periode Sebelumnya
          </Link>
          <Link
            href={`/attendance/reconciliation?cutoff=${formatCutoffParam(nextPeriod.start)}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Periode Berikutnya →
          </Link>
          <Link
            href={`/attendance/reconciliation/grid?cutoff=${formatCutoffParam(period.start)}`}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            Buka Grid Lengkap
          </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-4">
        <div className="flex flex-1 min-w-[240px] items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-800">{resolvedCount}</p>
            <p className="text-xs text-emerald-700">hari-karyawan otomatis lengkap atau sudah diklasifikasikan</p>
          </div>
        </div>
        <div className="flex flex-1 min-w-[240px] items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-rose-800">{unresolvedDays.length}</p>
            <p className="text-xs text-rose-700">hari perlu keputusan Anda</p>
          </div>
        </div>
        <div className="flex flex-1 min-w-[240px] items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-800">{attendanceNotices.length}</p>
            <p className="text-xs text-amber-700">catatan terlambat / di luar lokasi — tidak perlu tindakan</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        {unresolvedDays.length === 0 ? (
          <p className="text-sm text-slate-400">Tidak ada yang perlu diklasifikasikan untuk periode ini.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {unresolvedDays.map((row) => (
              <div key={`${row.employeeId}:${row.date.toISOString()}`} className="flex flex-wrap items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="w-56 shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{row.employeeName}</p>
                  <p className="text-xs text-slate-400">{row.departmentName}</p>
                </div>
                <div className="w-40 shrink-0 text-sm text-slate-700">{formatDayLabel(row.date)}</div>
                <div className="flex-grow rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{row.reason}</div>
                <ClassifyRowForm
                  employeeId={row.employeeId}
                  dateParam={formatCutoffParam(row.date)}
                  assignedShiftType={row.assignedShiftType}
                  absenceTypes={absenceTypes}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Catatan Terlambat &amp; Di Luar Lokasi</p>
          <p className="text-xs text-slate-400">Informasi saja — sudah lengkap check-in/check-out, tidak perlu diklasifikasikan</p>
        </div>
        {attendanceNotices.length === 0 ? (
          <p className="text-sm text-slate-400">Tidak ada catatan untuk periode ini.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {attendanceNotices.map((n) => (
              <div key={`${n.employeeId}:${n.date.toISOString()}`} className="flex flex-wrap items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="w-48 shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{n.employeeName}</p>
                  <p className="text-xs text-slate-400">{n.departmentName}</p>
                </div>
                <div className="w-40 shrink-0 text-sm text-slate-700">{formatDayLabel(n.date)}</div>
                <div className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                  <span>
                    Check-in <b className="text-slate-900">{n.checkInTime ?? "—"}</b> &middot; Check-out{" "}
                    <b className="text-slate-900">{n.checkOutTime ?? "—"}</b>
                  </span>
                  {n.locationNote && <span className="text-slate-400">{n.locationNote}</span>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {n.late && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      ● Terlambat
                    </span>
                  )}
                  {n.outsideGeofence && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                      ● Di Luar Lokasi
                    </span>
                  )}
                </div>
                <div className="min-w-[200px] flex-grow rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  <span className="text-slate-400">Alasan: </span>
                  {n.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
