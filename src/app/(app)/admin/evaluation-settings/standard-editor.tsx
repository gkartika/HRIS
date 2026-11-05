"use client";

import { useActionState, useState, useTransition } from "react";
import { PERFORMANCE_GRADE_NAME } from "@/lib/evaluation";
import { addCriterionVariantAction, removeCriterionVariantAction, saveCriterionStandardAction, saveStandardHeaderAction } from "./actions";

export interface StandardRow {
  id: string;
  label: string;
  section: "PERFORMANCE" | "TATA_NILAI";
  active: boolean;
  definition: string;
  note: string;
  scale: number[];
  variants: { key: string; label: string; levels: string; subordinates: "" | "yes" | "no"; texts: Record<number, string> }[];
  /** the texts of a criterion without versions */
  plain: Record<number, string>;
}

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function StandardHeaderForm({ docNumber, revision, effectiveDate }: { docNumber: string; revision: string; effectiveDate: string }) {
  const [message, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => (await saveStandardHeaderAction(prev, fd)) ?? "Tersimpan.", undefined);
  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Kepala dokumen</h2>
      <p className="mt-0.5 text-xs text-slate-500">Tampil di panduan lengkap dan halaman cetak.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">No. Dokumen</label>
          <input name="docNumber" defaultValue={docNumber} maxLength={60} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">No. Revisi</label>
          <input name="revision" defaultValue={revision} maxLength={60} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tgl Berlaku</label>
          <input name="effectiveDate" defaultValue={effectiveDate} maxLength={60} className={input} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {isPending ? "Menyimpan..." : "Simpan"}
        </button>
        {message && <p className={`text-xs ${message === "Tersimpan." ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </div>
    </form>
  );
}

function CriterionStandardForm({ row }: { row: StandardRow }) {
  const save = saveCriterionStandardAction.bind(null, row.id);
  const [message, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => (await save(prev, fd)) ?? "Tersimpan.", undefined);
  const [error, setError] = useState<string | null>(null);
  const [working, startTransition] = useTransition();
  const names = row.section === "PERFORMANCE";
  const tata = row.section === "TATA_NILAI";
  const versions = row.variants.length > 0 ? row.variants : [{ key: "DEFAULT", label: "", levels: "", subordinates: "" as const, texts: row.plain }];
  const declared = row.variants.length > 0;

  function run(task: () => Promise<string | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result) setError(result);
    });
  }

  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium text-slate-900">
        <span className={row.active ? "" : "text-slate-400 line-through"}>{row.label}</span>
        {declared && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">{row.variants.length} versi</span>}
        {!row.definition && versions.every((v) => Object.values(v.texts).every((x) => !x)) && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">belum ada standar</span>
        )}
      </summary>
      <form action={formAction} className="space-y-4 border-t border-slate-100 p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Definisi kriteria</label>
          <textarea name="definition" defaultValue={row.definition} rows={2} maxLength={2000} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Catatan khusus (opsional, tampil di kotak kuning)</label>
          <textarea name="note" defaultValue={row.note} rows={2} maxLength={2000} className={input} />
        </div>

        {versions.map((v) => (
          <fieldset key={v.key} className="space-y-3 rounded-lg border border-slate-200 p-3">
            {declared && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <label className="mb-1 block text-xs text-slate-500">Nama versi</label>
                    <input name={`label_${v.key}`} defaultValue={v.label} maxLength={120} required className={input} />
                  </div>
                  {row.variants.length > 1 && (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        if (window.confirm(`Hapus versi "${v.label}" beserta teksnya? Evaluasi yang sudah dirilis tidak terpengaruh.`)) run(() => removeCriterionVariantAction(row.id, v.key));
                      }}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      Hapus versi
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Berlaku untuk level (mis. 1A, 1B, HL)</label>
                    <input name={`levels_${v.key}`} defaultValue={v.levels} className={input} />
                    <p className="mt-0.5 text-[11px] text-slate-400">HL = Harian Lepas. Dipakai bila pilihan bawahan di samping kosong.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Berlaku bila karyawan</label>
                    <select name={`sub_${v.key}`} defaultValue={v.subordinates} className={`${input} bg-white`}>
                      <option value="">Tidak ditentukan oleh bawahan</option>
                      <option value="yes">Memiliki bawahan</option>
                      <option value="no">Tidak memiliki bawahan</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              {[...row.scale].reverse().map((n) => (
                <div key={n}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Nilai {n}
                    {names && PERFORMANCE_GRADE_NAME[n] ? ` · ${PERFORMANCE_GRADE_NAME[n]}` : ""}
                  </label>
                  <textarea name={`text_${v.key}_${n}`} defaultValue={v.texts[n] ?? ""} rows={tata ? 4 : 3} maxLength={2000} className={input} />
                </div>
              ))}
              {tata && <p className="text-[11px] text-slate-400">Satu perilaku per baris; tampil sebagai daftar.</p>}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {isPending ? "Menyimpan..." : "Simpan standar"}
          </button>
          <button type="button" disabled={working} onClick={() => run(() => addCriterionVariantAction(row.id))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            + Tambah versi
          </button>
          {message && <p className={`text-xs ${message === "Tersimpan." ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <p className="text-xs text-slate-400">Tambah versi hanya bila teks nilainya berbeda menurut level jabatan atau ada/tidaknya bawahan. Simpan dulu sebelum menambah atau menghapus versi; isian yang belum disimpan akan hilang.</p>
      </form>
    </details>
  );
}

export function StandardEditor({ rows }: { rows: StandardRow[] }) {
  const sections: { title: string; items: StandardRow[] }[] = [
    { title: "Bagian 1 — Performance", items: rows.filter((r) => r.section === "PERFORMANCE") },
    { title: "Bagian 2 — Tata Nilai", items: rows.filter((r) => r.section === "TATA_NILAI") },
  ];
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Standar penilaian — {s.title}</h2>
          <div className="space-y-2">
            {s.items.map((r) => (
              <CriterionStandardForm key={`${r.id}-${r.variants.map((v) => v.key).join(",")}`} row={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
