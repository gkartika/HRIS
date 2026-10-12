import { autoReasonLabel } from "@/lib/attendance-auto-day";
import { AccessDenied } from "@/components/access-denied";
import { Fragment } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { resolveCutoffPeriod, previousCutoffPeriod, nextCutoffPeriod, formatCutoffParam, parseCutoffParam } from "@/lib/absence-cutoff";
import { getReconciliationGrid } from "@/lib/attendance-reconciliation-queue";
import { formatMinutesAsHours } from "@/lib/attendance-hours";
import { formatDayCode } from "@/lib/attendance-reconciliation-export";
import { companyToday } from "@/lib/company-time";
import { formatRangeLabel, rangeShortcuts, resolveVisibleRange, sameRange } from "@/lib/grid-date-range";
import { GridEditForm } from "../grid-edit-form";

const SHIFT_TONE: Record<string, string> = {
  SHIFT_1: "text-sky-700",
  SHIFT_2: "text-indigo-700",
  SHIFT_3: "text-violet-700",
  NON_SHIFT: "text-slate-400",
};

type SortKey = "name" | "points";

function formatDayHeader(date: Date): { top: string; bottom: string } {
  return {
    top: String(date.getUTCDate()),
    bottom: new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(date),
  };
}

// Opsi B — the full period grid, every employee x every day. Per direct
// request this is NOT the daily default (Opsi A is) — it's the tool HR uses
// to check the automatic reads and overwrite anything, including a day Opsi
// A already resolved.
export default async function AttendanceReconciliationGridPage({
  searchParams,
}: {
  searchParams: Promise<{
    cutoff?: string;
    from?: string;
    to?: string;
    orgUnitId?: string;
    q?: string;
    sortBy?: string;
    sortDir?: string;
    editEmployeeId?: string;
    editDate?: string;
  }>;
}) {
  const session = await requireSession();
  if (!isHrAdmin(session)) {
    return <AccessDenied />;
  }


  const { cutoff, from: fromParam, to: toParam, orgUnitId, q, sortBy: sortByParam, sortDir: sortDirParam, editEmployeeId, editDate } = await searchParams;
  const search = q?.trim() ?? "";
  const sortBy: SortKey = sortByParam === "points" ? "points" : "name";
  const sortDir: "asc" | "desc" = sortDirParam === "desc" ? "desc" : "asc";
  const referenceDate = parseCutoffParam(cutoff) ?? new Date();
  const period = resolveCutoffPeriod(referenceDate);
  const prevPeriod = previousCutoffPeriod(period);
  const nextPeriod = nextCutoffPeriod(period);
  // Date filter: only narrows the visible day columns. Poin / Jam Kerja and
  // the Excel export always cover the whole period.
  const { range, error: rangeError } = resolveVisibleRange(period, fromParam, toParam);
  const shortcuts = rangeShortcuts(period, companyToday());
  const todayParam = formatCutoffParam(companyToday());
  const periodStartParam = formatCutoffParam(period.start);
  const periodEndParam = formatCutoffParam(period.end);

  const [employeeIds, orgUnits, absenceTypes] = await Promise.all([
    prisma.employee
      .findMany({
        where: {
          activeFlag: true,
          ...(orgUnitId ? { currentPosition: { orgUnitId } } : {}),
          ...(search ? { fullLegalName: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true },
        orderBy: { fullLegalName: "asc" },
      })
      .then((rows) => rows.map((r) => r.id)),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    // LAINNYA is excluded here — in this classify context it's replaced by
    // the "Masuk (Lupa Absen)" pseudo-option (present-override.ts): a day
    // with no punch is usually a forgotten scan, not a real "other" absence.
    prisma.absenceTypeConfig.findMany({
      where: { activeFlag: true, code: { not: "LAINNYA" } },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true },
    }),
  ]);

  const rows = await getReconciliationGrid(period, employeeIds);
  if (sortBy === "points") {
    rows.sort((a, b) => (sortDir === "asc" ? a.points - b.points : b.points - a.points));
  } else if (sortDir === "desc") {
    rows.reverse();
  }

  let editPanel: { employeeName: string; dateParam: string; dateLabel: string; absenceTypeCode: string | null; shiftType: string | null; presentOverride: boolean } | null = null;
  if (editEmployeeId && editDate) {
    const editEmployeeRow = rows.find((r) => r.employeeId === editEmployeeId);
    const editDay = editEmployeeRow?.days.find((d) => formatCutoffParam(d.date) === editDate);
    if (editEmployeeRow && editDay) {
      editPanel = {
        employeeName: editEmployeeRow.employeeName,
        dateParam: editDate,
        dateLabel: new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(editDay.date),
        absenceTypeCode: editDay.absenceTypeCode,
        shiftType: editDay.shiftType,
        presentOverride: editDay.presentOverride,
      };
    }
  }

  // Every link below (period nav, cell edit, sort) carries the same
  // filter/search state forward so navigating never silently drops it.
  const carryParams = (extra: Record<string, string>, withRange = true) => {
    const params = new URLSearchParams();
    params.set("cutoff", formatCutoffParam(period.start));
    if (withRange && !range.isFull) {
      params.set("from", formatCutoffParam(range.from));
      params.set("to", formatCutoffParam(range.to));
    }
    if (orgUnitId) params.set("orgUnitId", orgUnitId);
    if (search) params.set("q", search);
    if (sortBy !== "name") params.set("sortBy", sortBy);
    if (sortDir !== "asc") params.set("sortDir", sortDir);
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params;
  };

  const cellHref = (employeeId: string, dateParam: string) =>
    `/attendance/reconciliation/grid?${carryParams({ editEmployeeId: employeeId, editDate: dateParam }).toString()}`;

  const sortLink = (key: SortKey) => {
    const nextDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
    const params = carryParams({ sortBy: key, sortDir: nextDir });
    params.delete("editEmployeeId");
    params.delete("editDate");
    return `/attendance/reconciliation/grid?${params.toString()}`;
  };

  const periodNavHref = (start: Date) => {
    const params = carryParams({ cutoff: formatCutoffParam(start) }, false);
    params.delete("editEmployeeId");
    params.delete("editDate");
    return `/attendance/reconciliation/grid?${params.toString()}`;
  };

  const rangeHref = (from: Date, to: Date, isAll: boolean) => {
    const params = carryParams({}, false);
    if (!isAll) {
      params.set("from", formatCutoffParam(from));
      params.set("to", formatCutoffParam(to));
    }
    return `/attendance/reconciliation/grid?${params.toString()}`;
  };

  // Only the day columns inside the chosen range are drawn; every row still
  // carries the whole period, which the summary columns use.
  const inRange = (date: Date) => date >= range.from && date <= range.to;
  const headerDays = (rows[0]?.days ?? []).filter((d) => inRange(d.date));
  // The grid itself only runs up to today, so the counts below speak of the
  // days it actually has, not of the whole 30-day period.
  const availableDays = rows[0]?.days.length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-slate-900">Rekonsiliasi Absensi — Grid Lengkap</h1>
          <p className="mt-1 text-sm text-slate-500">Periode {period.label} · klik sel mana pun untuk menetapkan atau menimpa nilainya</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={periodNavHref(prevPeriod.start)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            ← Sebelumnya
          </Link>
          <Link href={periodNavHref(nextPeriod.start)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Berikutnya →
          </Link>
          <Link
            href={`/attendance/reconciliation?cutoff=${formatCutoffParam(period.start)}`}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            Antrian Pengecualian
          </Link>
          <a
            href={`/api/attendance/reconciliation-export?${carryParams({}, false).toString()}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Export Excel
          </a>
        </div>
      </div>

      <form className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="cutoff" value={formatCutoffParam(period.start)} />
        {sortBy !== "name" && <input type="hidden" name="sortBy" value={sortBy} />}
        {sortDir !== "asc" && <input type="hidden" name="sortDir" value={sortDir} />}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Cari Nama</label>
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="mis. Riswanto"
            className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.department")}</label>
          <select name="orgUnitId" defaultValue={orgUnitId ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {orgUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-brand/20 bg-brand-soft/60 p-2">
          <div>
            <label htmlFor="grid-from" className="mb-1 block text-xs text-slate-600">Dari tanggal</label>
            <input
              id="grid-from"
              type="date"
              name="from"
              min={periodStartParam}
              max={periodEndParam}
              defaultValue={formatCutoffParam(range.from)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="grid-to" className="mb-1 block text-xs text-slate-600">Sampai tanggal</label>
            <input
              id="grid-to"
              type="date"
              name="to"
              min={periodStartParam}
              max={periodEndParam}
              defaultValue={formatCutoffParam(range.to)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          {t("common.applyFilter")}
        </button>
        {(search || orgUnitId || !range.isFull) && (
          <Link href={`/attendance/reconciliation/grid?cutoff=${formatCutoffParam(period.start)}`} className="px-2 py-2 text-sm text-slate-500 hover:text-slate-700">
            {t("common.resetFilter")}
          </Link>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Pintasan:</span>
        {shortcuts.map((s) => {
          const active = sameRange(s, range);
          return (
            <Link
              key={s.key}
              href={rangeHref(s.from, s.to, s.key === "all")}
              className={`rounded-full border px-3 py-1 ${active ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
      {rangeError && <p className="mt-2 text-xs text-rose-600">{rangeError}</p>}
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <p>
          {range.isFull ? (
            <>
              Menampilkan <b>seluruh periode</b> · {headerDays.length} hari
            </>
          ) : (
            <>
              Menampilkan <b>{formatRangeLabel(range.from, range.to)}</b> · {headerDays.length} dari {availableDays} hari
              {headerDays.length === 0 && availableDays > 0 && <span className="text-amber-700"> — belum ada data di rentang ini (grid hanya sampai hari ini)</span>}
            </>
          )}
        </p>
        <p className="text-slate-400">Poin dan Jam Kerja selalu dihitung untuk seluruh periode. Export Excel juga memuat seluruh periode.</p>
      </div>

      {editPanel && (
        <div className="mt-4">
          <GridEditForm
            employeeId={editEmployeeId!}
            employeeName={editPanel.employeeName}
            dateParam={editPanel.dateParam}
            dateLabel={editPanel.dateLabel}
            currentAbsenceTypeCode={editPanel.absenceTypeCode}
            currentShiftType={editPanel.shiftType}
            currentPresentOverride={editPanel.presentOverride}
            absenceTypes={absenceTypes}
          />
        </div>
      )}

      <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th rowSpan={2} className="sticky left-0 z-10 min-w-[190px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-500">
                <Link href={sortLink("name")} className="hover:underline">
                  Karyawan {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </Link>
              </th>
              <th rowSpan={2} className="sticky left-[190px] z-10 w-[64px] border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500">
                <Link href={sortLink("points")} className="hover:underline">
                  Poin {sortBy === "points" && (sortDir === "asc" ? "↑" : "↓")}
                </Link>
                <span className="block text-[9px] font-normal text-slate-400">periode</span>
              </th>
              <th rowSpan={2} className="sticky left-[254px] z-10 w-[76px] border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500">
                Jam Kerja Gaji
                <span className="block text-[9px] font-normal text-slate-400">periode</span>
              </th>
              <th rowSpan={2} className="sticky left-[330px] z-10 w-[76px] border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500">
                Jam Kerja Aktual
                <span className="block text-[9px] font-normal text-slate-400">periode</span>
              </th>
              {headerDays.map((d) => {
                const { top, bottom } = formatDayHeader(d.date);
                const isToday = formatCutoffParam(d.date) === todayParam;
                return (
                  <th
                    key={d.date.toISOString()}
                    colSpan={2}
                    className={`border-b border-l border-slate-200 px-1 py-2 text-center text-[10px] font-semibold ${isToday ? "bg-brand-accent-soft text-brand-dark" : "text-slate-500"}`}
                  >
                    {top}
                    <br />
                    {bottom}
                    {isToday && (
                      <>
                        <br />
                        hari ini
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr className="bg-slate-50">
              {headerDays.map((d) => (
                <Fragment key={d.date.toISOString()}>
                  <th className="w-[40px] border-b border-l border-slate-200 px-1 py-1 text-center text-[9px] font-medium text-slate-400">
                    Kode
                  </th>
                  <th className="w-[40px] border-b border-slate-200 px-1 py-1 text-center text-[9px] font-medium text-slate-400">
                    Jam
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-semibold text-slate-900">
                  {row.employeeName}
                  <p className="text-[10px] font-normal text-slate-400">{row.departmentName}</p>
                </td>
                <td
                  className={`sticky left-[190px] z-10 border-l border-slate-100 bg-white px-2 py-2 text-center text-xs font-bold ${
                    row.points < 0 ? "text-rose-600" : "text-slate-400"
                  }`}
                >
                  {row.points}
                </td>
                <td className="sticky left-[254px] z-10 border-l border-slate-100 bg-white px-2 py-2 text-center text-xs font-medium text-slate-700">
                  {formatMinutesAsHours(row.totalMinutes)}
                </td>
                <td className="sticky left-[330px] z-10 border-l border-slate-100 bg-white px-2 py-2 text-center text-xs font-medium text-slate-700">
                  {formatMinutesAsHours(row.totalActualMinutes)}
                </td>
                {row.days.filter((d) => inRange(d.date)).map((d) => {
                  const dateParam = formatCutoffParam(d.date);
                  const isSelected = editEmployeeId === row.employeeId && editDate === dateParam;
                  const label = formatDayCode(d);
                  const effectiveShift = d.shiftType ?? d.assignedShiftType;
                  // One punch but not the pair yet (e.g. checked in today, not out): not "missing", just incomplete.
                  const halfPunched = !d.absenceTypeCode && !d.presentOverride && !d.shiftType && d.hasCheckIn !== d.hasCheckOut;
                  const tone = d.absenceTypeCode
                    ? "text-amber-700"
                    : d.presentOverride || d.shiftType || (d.hasCheckIn && d.hasCheckOut)
                      ? (SHIFT_TONE[effectiveShift] ?? "text-slate-400")
                      : halfPunched
                        ? "text-amber-600"
                        : "text-rose-500";
                  return (
                    <Fragment key={dateParam}>
                      <td className={`border-l border-slate-100 p-0 text-center ${isSelected ? "bg-brand-accent-soft" : ""}`}>
                        <Link
                          href={cellHref(row.employeeId, dateParam)}
                          className={`block px-1 py-2 text-[11px] font-bold hover:bg-slate-50 ${tone}`}
                          title={
                            d.auto && !d.auto.decided && !d.fromLeaveRequest && !d.presentOverride
                              ? `${autoReasonLabel(d.auto)}${d.auto.late ? ` ${formatMinutesAsHours(d.auto.lateMinutes)} dari jam mulai` : ""}, otomatis ${d.auto.kind === "HALF" ? "Setengah Hari (batas " + formatMinutesAsHours(d.auto.halfDayAfterMinutes) + ")" : "hari penuh"}`
                              : d.presentOverride
                              ? "Masuk (Lupa Absen)"
                              : d.fromLeaveRequest
                                ? `${d.absenceTypeLabel} (dari pengajuan yang disetujui)`
                                : (d.absenceTypeLabel ?? (halfPunched ? (d.hasCheckIn ? "Sudah check-in, belum check-out" : "Check-out tercatat, belum ada check-in") : undefined))
                          }
                        >
                          {label}
                        </Link>
                      </td>
                      <td className="border-l border-slate-100 px-1 py-2 text-center text-[10px] text-slate-500">
                        {formatMinutesAsHours(d.minutes)}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={64}>
                  Tidak ada karyawan yang cocok dengan filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
