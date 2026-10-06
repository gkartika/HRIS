"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluateIssueWarnings, parseCompanyDateInput } from "@/lib/consumables";
import {
  getEmployeeLastIssues,
  recordConsumableIssue,
  searchConsumableEmployees,
  type EmployeeSearchResult,
} from "./take-actions";
import dynamic from "next/dynamic";

// The camera scanner (and its QR decoder) is only needed when someone taps
// "Scan QR", so it is not part of the everyday take screen's first load.
const QrScanner = dynamic(() => import("./qr-scanner").then((m) => m.QrScanner), { ssr: false });

export interface TakeItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  stock: number;
  replacementPeriodMonths: number;
}

interface CartLine {
  itemId: string;
  quantity: number;
}

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const LABEL = "mb-1 block text-xs text-slate-500";
const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" });

export function TakeForm({ items, departments }: { items: TakeItem[]; departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"EMPLOYEE" | "DEPARTMENT">("EMPLOYEE");
  const [employee, setEmployee] = useState<EmployeeSearchResult | null>(null);
  const [empQuery, setEmpQuery] = useState("");
  const [empResults, setEmpResults] = useState<EmployeeSearchResult[]>([]);
  const [lastIssues, setLastIssues] = useState<Record<string, string>>({});
  const [deptId, setDeptId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [recordedBy, setRecordedBy] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function onEmpQueryChange(value: string) {
    setEmpQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setEmpResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    searchTimer.current = setTimeout(async () => {
      const results = await searchConsumableEmployees(value);
      if (seq === searchSeq.current) setEmpResults(results);
    }, 250);
  }

  async function pickEmployee(e: EmployeeSearchResult) {
    setEmployee(e);
    setEmpQuery("");
    setEmpResults([]);
    setLastIssues(await getEmployeeLastIssues(e.id));
  }

  function switchMode(next: "EMPLOYEE" | "DEPARTMENT") {
    setMode(next);
    setNotice(null);
  }

  function addItem(item: TakeItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) return prev.map((l) => (l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { itemId: item.id, quantity: 1 }];
    });
    setItemQuery("");
  }

  function addByCode(code: string): boolean {
    const wanted = code.trim().toLowerCase();
    const item = items.find((i) => i.itemCode.toLowerCase() === wanted);
    if (!item) {
      setNotice({ kind: "error", text: `Kode "${code}" tidak dikenali atau barang sudah diarsipkan.` });
      return false;
    }
    addItem(item);
    setNotice({ kind: "info", text: `${item.itemName} ditambahkan ke keranjang.` });
    return true;
  }

  const itemMatches = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.itemCode.toLowerCase().includes(q) || i.itemName.toLowerCase().includes(q)).slice(0, 8);
  }, [items, itemQuery]);

  function onItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // A hardware scanner types the code and presses Enter; so does a person.
    if (!addByCode(itemQuery) && itemMatches.length === 1) addItem(itemMatches[0]);
  }

  const occurredAt = parseCompanyDateInput(date);
  const dateError = occurredAt === "invalid" ? "Tanggal tidak valid." : occurredAt === "future" ? "Tanggal tidak boleh di masa depan." : null;

  const warnings = useMemo(() => {
    const when = occurredAt instanceof Date ? occurredAt : new Date();
    return lines.map((line) => {
      const item = itemById.get(line.itemId)!;
      const last = mode === "EMPLOYEE" && lastIssues[line.itemId] ? new Date(lastIssues[line.itemId]) : null;
      return {
        line,
        item,
        last,
        w: evaluateIssueWarnings({
          stock: item.stock,
          quantity: line.quantity,
          lastIssueAt: last,
          periodMonths: item.replacementPeriodMonths,
          occurredAt: when,
        }),
      };
    });
  }, [lines, itemById, lastIssues, mode, occurredAt]);

  const hasWarning = warnings.some((x) => x.w.hasWarning);
  const recipientChosen = mode === "EMPLOYEE" ? !!employee : !!deptId;
  const quantitiesValid = lines.every((l) => Number.isInteger(l.quantity) && l.quantity > 0);
  const canSubmit =
    recipientChosen && lines.length > 0 && quantitiesValid && !dateError && (!hasWarning || reason.trim() !== "") && !submitting;

  async function submit() {
    setSubmitting(true);
    setNotice(null);
    const result = await recordConsumableIssue({
      recipientType: mode,
      employeeId: mode === "EMPLOYEE" ? employee?.id : undefined,
      orgUnitId: mode === "DEPARTMENT" ? deptId : undefined,
      lines,
      purpose,
      warningReason: reason,
      recordedByLabel: recordedBy,
      occurredAt: date,
    });
    setSubmitting(false);
    if ("error" in result) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({ kind: "ok", text: result.success });
    setLines([]);
    setReason("");
    setPurpose("");
    setDate("");
    setEmployee(null);
    setLastIssues({});
    setDeptId("");
    router.refresh(); // pull the new stock figures into the item list
  }

  const noticeTone = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {notice && <p className={`rounded-lg border px-4 py-2 text-sm ${noticeTone[notice.kind]}`}>{notice.text}</p>}

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">1. Siapa yang mengambil</p>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
              {(["EMPLOYEE", "DEPARTMENT"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-indigo-600 font-semibold text-white" : "text-slate-600"}`}
                >
                  {m === "EMPLOYEE" ? "Karyawan" : "Departemen"}
                </button>
              ))}
            </div>
          </div>

          {mode === "EMPLOYEE" ? (
            <div className="mt-3">
              {employee ? (
                <div className="flex items-start justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{employee.fullLegalName}</p>
                    <p className="text-xs text-slate-500">
                      {employee.employeeNumber} · {employee.departmentName ?? "Tanpa departemen"}
                      {employee.positionTitle ? ` · ${employee.positionTitle}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployee(null);
                      setLastIssues({});
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <label className={LABEL}>Cari nama atau NIP karyawan</label>
                  <input value={empQuery} onChange={(e) => onEmpQueryChange(e.target.value)} placeholder="mis. Rindi" className={INPUT} />
                  {empResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {empResults.map((e) => (
                        <li key={e.id}>
                          <button type="button" onClick={() => pickEmployee(e)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                            <span className="text-sm text-slate-900">{e.fullLegalName}</span>
                            <span className="block text-xs text-slate-400">
                              {e.employeeNumber} · {e.departmentName ?? "Tanpa departemen"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {empQuery.trim().length >= 2 && empResults.length === 0 && (
                    <p className="mt-1 text-[11.5px] text-slate-400">Tidak ada karyawan aktif yang cocok.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <label className={LABEL}>Departemen</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={INPUT}>
                <option value="">— Pilih Departemen —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11.5px] text-slate-400">Pengambilan atas nama departemen tidak dicek terhadap periode ganti.</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">2. Barang yang diambil</p>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Scan QR
            </button>
          </div>
          <div className="relative mt-3">
            <input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              onKeyDown={onItemKeyDown}
              placeholder="Cari nama atau kode barang (atau scan)"
              className={INPUT}
            />
            {itemMatches.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {itemMatches.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => addItem(i)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50">
                      <span>
                        <span className="text-sm text-slate-900">{i.itemName}</span>
                        <span className="ml-2 font-mono text-xs text-slate-400">{i.itemCode}</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        sisa {i.stock} {i.unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">Keranjang kosong.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {warnings.map(({ line, item, w }) => (
                <li key={line.itemId} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">{item.itemName}</p>
                    <p className="text-xs text-slate-400">
                      <span className="font-mono">{item.itemCode}</span> · sisa {item.stock} {item.unit}
                      {w.beforePeriod && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">Sebelum periode</span>}
                      {w.exceedsStock && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700">Melebihi stok</span>}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l) => (l.itemId === line.itemId ? { ...l, quantity: Number(e.target.value) } : l)))
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm"
                    aria-label={`Jumlah ${item.itemName}`}
                  />
                  <span className="w-10 text-xs text-slate-500">{item.unit}</span>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                    className="text-xs text-rose-600 hover:text-rose-700"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-4 lg:col-span-2">
        {hasWarning && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Perlu perhatian</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
              {warnings.flatMap(({ item, last, w, line }) => [
                w.beforePeriod && w.nextEligible && last ? (
                  <li key={`${line.itemId}-p`}>
                    {item.itemName}: terakhir diambil {dateFmt.format(last)}, baru boleh lagi mulai {dateFmt.format(w.nextEligible)} (periode {item.replacementPeriodMonths} bulan).
                  </li>
                ) : null,
                w.exceedsStock ? (
                  <li key={`${line.itemId}-s`}>
                    {item.itemName}: diambil {line.quantity}, stok tercatat {Math.max(0, item.stock)} {item.unit} (kurang {w.shortfall}).
                  </li>
                ) : null,
              ])}
            </ul>
            <label className="mb-1 mt-3 block text-xs font-medium text-amber-900">Alasan tetap dicatat (wajib)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="mis. rusak karena kecelakaan kerja / stok belum diinput"
              className={INPUT}
            />
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">3. Keterangan</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className={LABEL}>Keperluan (opsional)</label>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Tanggal (kosong = hari ini)</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Dicatat oleh (opsional)</label>
                <input value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} className={INPUT} />
              </div>
            </div>
            {dateError && <p className="text-xs text-rose-600">{dateError}</p>}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : hasWarning ? "Catat dengan peringatan" : "Catat pengambilan"}
          </button>
          {!recipientChosen && <p className="mt-2 text-[11.5px] text-slate-400">Pilih pengambil terlebih dahulu.</p>}
        </section>
      </div>

      {scanning && <QrScanner onCode={addByCode} onClose={() => setScanning(false)} />}
    </div>
  );
}
