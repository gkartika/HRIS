"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { printFilterText, shiftPrintLabel, weekPrintRange } from "@/lib/shift-print";
import { saveShiftScheduleWeek, type ShiftChange } from "./actions";

export type SchedulerShift = "SHIFT_2" | "SHIFT_3" | "NON_SHIFT";

export interface SchedulerEmployee {
  id: string;
  name: string;
  employeeNumber: string;
  jobTitle: string;
  departmentId: string | null;
  departmentName: string;
  groupId: string | null;
  groupName: string | null;
}

type Filter = "all" | "default" | SchedulerShift;
type Draft = Record<string, SchedulerShift>;

const SHIFT_META: Record<SchedulerShift, { label: string; pill: string; dot: string }> = {
  SHIFT_2: { label: "Shift 2", pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  SHIFT_3: { label: "Shift 3", pill: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  NON_SHIFT: { label: "Libur", pill: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
};
const SHIFT_ORDER: SchedulerShift[] = ["SHIFT_2", "SHIFT_3", "NON_SHIFT"];

export function ShiftScheduler({
  employees,
  saved: initialSaved,
  prevSaved,
  weekStartIso,
  weekLabel,
  weekTag,
  prevWeekIso,
  nextWeekIso,
  printedBy,
}: {
  printedBy: string;
  employees: SchedulerEmployee[];
  saved: Draft;
  prevSaved: Draft;
  weekStartIso: string;
  weekLabel: string;
  weekTag: string;
  prevWeekIso: string;
  nextWeekIso: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [saved, setSaved] = useState<Draft>(initialSaved);
  const [draft, setDraft] = useState<Draft>(initialSaved);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);
  const lastIndex = useRef<number | null>(null);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => e.departmentId && map.set(e.departmentId, e.departmentName));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const groups = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.groupId && e.groupName && (!departmentId || e.departmentId === departmentId)) map.set(e.groupId, e.groupName);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, departmentId]);

  const shiftOf = (id: string): SchedulerShift | null => draft[id] ?? null;

  const counts = useMemo(() => {
    const c = { all: employees.length, default: 0, SHIFT_2: 0, SHIFT_3: 0, NON_SHIFT: 0 };
    employees.forEach((e) => {
      const s = draft[e.id];
      if (s) c[s]++;
      else c.default++;
    });
    return c;
  }, [employees, draft]);

  const dirtyIds = useMemo(() => {
    const ids = new Set([...Object.keys(draft), ...Object.keys(saved)]);
    return Array.from(ids).filter((id) => (draft[id] ?? null) !== (saved[id] ?? null));
  }, [draft, saved]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees.filter((e) => {
      const s = draft[e.id] ?? null;
      if (filter === "default" && s !== null) return false;
      if (filter !== "all" && filter !== "default" && s !== filter) return false;
      if (departmentId && e.departmentId !== departmentId) return false;
      if (groupId && e.groupId !== groupId) return false;
      if (needle && !`${e.name} ${e.employeeNumber} ${e.jobTitle}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [employees, draft, filter, q, departmentId, groupId]);

  const allShownSelected = rows.length > 0 && rows.every((e) => selected.has(e.id));
  const someShownSelected = rows.some((e) => selected.has(e.id));
  const hiddenSelected = Array.from(selected).filter((id) => !rows.some((e) => e.id === id)).length;

  // Prints the rows as they are shown now (week, shift button, department, search). What is on paper must be
  // what is saved, so unsaved changes have to be saved first.
  function printSheet() {
    if (dirtyIds.length > 0) {
      setMessage({ tone: "error", text: "Simpan jadwal dulu sebelum mencetak, supaya yang tercetak sama dengan yang tersimpan." });
      return;
    }
    flushSync(() => setPrintedAt(new Date()));
    window.print();
  }

  function toggleRow(id: string, index: number, checked: boolean, shiftKey: boolean) {
    // Read the anchor now: the updater below runs later, after lastIndex has
    // already been moved to this row, which would collapse every range to one row.
    const anchor = lastIndex.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && anchor !== null && anchor < rows.length) {
        const [from, to] = [Math.min(index, anchor), Math.max(index, anchor)];
        for (let i = from; i <= to; i++) next.add(rows[i].id);
      } else if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    lastIndex.current = index;
  }

  function toggleAllShown(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((e) => (checked ? next.add(e.id) : next.delete(e.id)));
      return next;
    });
    lastIndex.current = null;
  }

  function apply(target: SchedulerShift | "DEFAULT") {
    if (selected.size === 0) return;
    const count = selected.size;
    setDraft((prev) => {
      const next = { ...prev };
      selected.forEach((id) => {
        if (target === "DEFAULT") delete next[id];
        else next[id] = target;
      });
      return next;
    });
    setSelected(new Set());
    lastIndex.current = null;
    setMessage({
      tone: "ok",
      text:
        target === "DEFAULT"
          ? `${count} karyawan dikembalikan ke default (Shift 1). Belum disimpan.`
          : `${count} karyawan → ${SHIFT_META[target].label}. Belum disimpan.`,
    });
  }

  function copyPreviousWeek() {
    const next: Draft = {};
    let n = 0;
    employees.forEach((e) => {
      const s = prevSaved[e.id];
      if (s) {
        next[e.id] = s;
        n++;
      }
    });
    setDraft(next);
    setSelected(new Set());
    setMessage({ tone: "ok", text: `Disalin dari minggu lalu — ${n} karyawan bukan Shift 1. Periksa lalu simpan.` });
  }

  function save() {
    const changes: ShiftChange[] = dirtyIds.map((id) => ({ employeeId: id, shiftType: draft[id] ?? null }));
    startTransition(async () => {
      const result = await saveShiftScheduleWeek(weekStartIso, changes);
      if (result.ok) {
        setSaved({ ...draft });
        const tally = (s: SchedulerShift) => Object.values(draft).filter((v) => v === s).length;
        setMessage({
          tone: "ok",
          text: `Jadwal ${weekLabel} disimpan: ${tally("SHIFT_2")} Shift 2, ${tally("SHIFT_3")} Shift 3, ${tally("NON_SHIFT")} Libur. Sisanya Shift 1.`,
        });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  function goToWeek(iso: string) {
    if (dirtyIds.length > 0 && !window.confirm("Ada perubahan yang belum disimpan dan akan hilang. Lanjut pindah minggu?")) return;
    router.push(`/shift-assignments?week=${iso}`);
  }

  const chip = (key: Filter, label: string, n: number, dot?: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
        filter === key ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-brand-soft"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span className="font-bold tabular-nums">{n}</span>
    </button>
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => goToWeek(prevWeekIso)}
            aria-label="Minggu sebelumnya"
            className="h-9 w-9 rounded-lg text-slate-600 hover:bg-brand-soft"
          >
            ‹
          </button>
          <div className="min-w-44 px-2 text-center">
            <p className="text-sm font-semibold tabular-nums text-slate-900">{weekLabel}</p>
            <p className="text-[11px] text-slate-500">{weekTag}</p>
          </div>
          <button
            type="button"
            onClick={() => goToWeek(nextWeekIso)}
            aria-label="Minggu berikutnya"
            className="h-9 w-9 rounded-lg text-slate-600 hover:bg-brand-soft"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={copyPreviousWeek}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-brand-soft"
        >
          Salin dari minggu lalu
        </button>
        <button
          type="button"
          onClick={printSheet}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-brand-soft"
        >
          Cetak
        </button>
      </div>

      {dirtyIds.length > 0 && (
        <div className="sticky top-0 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-brand-accent-soft px-3 py-2 text-sm text-amber-900">
          <span>
            <b className="tabular-nums">{dirtyIds.length} perubahan</b> belum disimpan untuk minggu ini.
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setDraft({ ...saved });
              setSelected(new Set());
              setMessage({ tone: "ok", text: "Perubahan dibatalkan." });
            }}
            disabled={isPending}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium hover:bg-amber-50 disabled:opacity-60"
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {isPending ? "Menyimpan..." : "Simpan jadwal"}
          </button>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Saring menurut shift">
        {chip("all", "Semua", counts.all)}
        {chip("default", "Belum diatur", counts.default, "bg-slate-300")}
        {SHIFT_ORDER.map((s) => chip(s, SHIFT_META[s].label, counts[s], SHIFT_META[s].dot))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Yang <b>Belum diatur</b> ({counts.default} orang) otomatis Shift 1 — tidak perlu dicentang.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <label htmlFor="shift-q" className="mb-1 block text-xs text-slate-500">
            Cari nama, nomor, atau jabatan
          </label>
          <input
            id="shift-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="mis. CNC atau Budi"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        {departments.length > 1 ? (
          <div>
            <label htmlFor="shift-dept" className="mb-1 block text-xs text-slate-500">
              Departemen
            </label>
            <select
              id="shift-dept"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setGroupId("");
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Semua departemen</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="self-end rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            Departemen: <b className="font-semibold text-slate-800">{departments[0]?.name ?? "—"}</b>
          </div>
        )}
        {groups.length > 0 && (
          <div>
            <label htmlFor="shift-group" className="mb-1 block text-xs text-slate-500">
              Grup
            </label>
            <select
              id="shift-group"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Semua grup</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">Tips: tahan Shift saat mencentang untuk memilih satu rentang sekaligus.</p>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[24px_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_96px] items-center gap-3 bg-brand-soft px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <input
            type="checkbox"
            aria-label="Pilih semua yang tampil"
            checked={allShownSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allShownSelected && someShownSelected;
            }}
            onChange={(e) => toggleAllShown(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          <span>Nama</span>
          <span>Jabatan</span>
          <span>Departemen</span>
          <span>Grup</span>
          <span className="text-right">Shift</span>
        </div>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {employees.length === 0 ? "Tidak ada karyawan pada cakupan Anda." : "Tidak ada karyawan yang cocok dengan saringan ini."}
          </p>
        )}
        {rows.map((e, index) => {
          const s = shiftOf(e.id);
          const isSelected = selected.has(e.id);
          const changed = (draft[e.id] ?? null) !== (saved[e.id] ?? null);
          return (
            <label
              key={e.id}
              className={`grid cursor-pointer select-none grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-t border-slate-100 px-4 py-2.5 hover:bg-brand-soft md:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_96px] ${
                isSelected ? "bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(ev) => toggleRow(e.id, index, ev.target.checked, (ev.nativeEvent as MouseEvent).shiftKey === true)}
                className="row-span-2 h-4 w-4 accent-brand md:row-span-1"
              />
              <span className="min-w-0">
                <b className="block text-sm font-semibold text-slate-900">{e.name}</b>
                <small className="font-mono text-[11px] text-slate-500">{e.employeeNumber}</small>
              </span>
              <span className="col-start-2 col-span-2 row-start-2 text-xs text-slate-600 md:col-auto md:row-auto md:text-sm md:text-slate-800">
                {e.jobTitle}
                <span className="block text-slate-400 md:hidden">
                  {e.departmentName}
                  {e.groupName ? ` · ${e.groupName}` : ""}
                </span>
              </span>
              <span className="hidden text-sm text-slate-500 md:block">{e.departmentName}</span>
              <span className="hidden text-sm text-slate-500 md:block">{e.groupName ?? "—"}</span>
              <span className="col-start-3 row-start-1 flex items-center justify-end gap-1.5 md:col-auto md:row-auto">
                {changed && <span className="h-1.5 w-1.5 rounded-full bg-brand" title="Belum disimpan" />}
                {s ? (
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${SHIFT_META[s].pill}`}>
                    {SHIFT_META[s].label}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-dark px-4 py-3 text-white shadow-lg">
          <div className="mr-2 font-semibold">
            <span className="mr-2 rounded-md bg-brand-accent px-2 py-0.5 tabular-nums text-brand-dark">{selected.size}</span>
            dipilih
            {hiddenSelected > 0 && (
              <small className="block text-[11px] font-normal opacity-80">{hiddenSelected} di antaranya tidak tampil karena saringan</small>
            )}
          </div>
          {SHIFT_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => apply(s)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${SHIFT_META[s].dot}`} />
              {SHIFT_META[s].label}
            </button>
          ))}
          <button type="button" onClick={() => apply("DEFAULT")} className="px-2 py-2 text-sm underline opacity-90 hover:opacity-100">
            Kembalikan ke default
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              lastIndex.current = null;
            }}
            className="ml-auto px-2 py-2 text-sm underline opacity-90 hover:opacity-100"
          >
            Batal pilih
          </button>
        </div>
      )}

      {/* The paper: not on screen, and the only thing printed (the app around it is hidden while printing). */}
      <style>{`@media print {
        @page { size: A4 portrait; margin: 12mm; }
        body * { visibility: hidden !important; }
        #shift-print-sheet, #shift-print-sheet * { visibility: visible !important; }
        #shift-print-sheet { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff; }
        #shift-print-sheet thead { display: table-header-group; }
        #shift-print-sheet tr { break-inside: avoid; }
      }`}</style>
      <div id="shift-print-sheet" className="hidden print:block">
        <p className="text-[10px] uppercase tracking-widest text-slate-600">PT Cahaya Bukit Perunggu</p>
        <h1 className="text-xl font-bold">JADWAL SHIFT</h1>
        <p className="text-base font-semibold">{weekPrintRange(weekStartIso)}</p>
        <p className="mt-1 text-sm">
          {printFilterText({
            filter,
            departmentName: departmentId ? (departments.find((d) => d.id === departmentId)?.name ?? null) : null,
            groupName: groupId ? (groups.find((g) => g.id === groupId)?.name ?? null) : null,
            search: q,
          })}{" "}
          · <b>{rows.length} karyawan</b>
        </p>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="w-8 border border-slate-500 px-2 py-1.5">No</th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">Nama</th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">No. Karyawan</th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">Departemen</th>
              <th className="border border-slate-500 px-2 py-1.5">Shift</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={e.id}>
                <td className="border border-slate-500 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-slate-500 px-2 py-1.5 font-medium">{e.name}</td>
                <td className="border border-slate-500 px-2 py-1.5">{e.employeeNumber}</td>
                <td className="border border-slate-500 px-2 py-1.5">{e.departmentName}</td>
                <td className="border border-slate-500 px-2 py-1.5 text-center font-semibold">{shiftPrintLabel(shiftOf(e.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[10px] text-slate-600">
          Dicetak oleh {printedBy}
          {printedAt && `, ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(printedAt)}`}.
        </p>
      </div>
    </div>
  );
}
