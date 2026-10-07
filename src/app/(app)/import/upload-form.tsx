"use client";

import { useActionState } from "react";
import { Download, Upload as UploadIcon } from "lucide-react";
import { uploadAndPreviewImport } from "./actions";
import { t } from "@/lib/i18n/id";
import type { DatasetKey } from "@/lib/import-export/registry";

export function UploadForm({ dataset, label }: { dataset: DatasetKey; label: string }) {
  const action = uploadAndPreviewImport.bind(null, dataset);
  const [error, formAction, isPending] = useActionState(action, undefined);
  // Fingerprint machine exports are commonly XLSX rather than CSV — every
  // other dataset in this app stays CSV-only.
  // The old inventory sheets are Excel files, so the consumables datasets
  // take XLSX as well.
  const isConsumable = dataset.startsWith("consumable-");
  const acceptedTypes = dataset === "fingerprint-attendance" || isConsumable ? ".csv,.xlsx,.xls" : ".csv";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-900">{label}</h3>
        <div className="flex items-center gap-3">
          <a
            href={`/api/import-export/template/${dataset}`}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            <Download size={12} /> {t("importUi.downloadSample")}
          </a>
          <a
            href={`/api/import-export/export/${dataset}`}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            <UploadIcon size={12} className="rotate-180" /> Ekspor CSV
          </a>
        </div>
      </div>
      {dataset === "fingerprint-attendance" && (
        <p className="mb-2 text-xs text-slate-400">
          Mendukung format ekspor CSV standar (fingerprintDeviceUserId/eventType/eventAt) maupun ekspor mentah
          mesin fingerprint (Name/Date-Time/Status) — formatnya terdeteksi otomatis. Untuk ekspor mentah, isi ID
          Perangkat Fingerprint karyawan di Penugasan Absensi dengan nama persis seperti yang tampil di mesin.
        </p>
      )}
      {dataset === "assignments" && (
        <p className="mb-2 text-xs text-slate-400">
          Berlaku Sejak (effectiveFrom) boleh dikosongkan: otomatis diisi Tanggal Bergabung karyawan, atau hari ini jika
          belum ada. Tanggalnya bisa diubah nanti di tab Penempatan karyawan. Jika diisi, formatnya YYYY-MM-DD (mis. 2026-01-31).
        </p>
      )}
      {isConsumable && (
        <p className="mb-2 text-xs text-slate-400">
          Impor dalam urutan: Master Barang, lalu Riwayat Stok Masuk &amp; Penyesuaian, lalu Riwayat Pengambilan. Kolom
          mengikuti sistem inventori lama (Kode Barang, Nama Karyawan, Jumlah, dst). Nama karyawan yang tidak cocok
          satu-satunya tetap diimpor sebagai teks. Berkas yang sama bisa diunggah ulang tanpa menggandakan data.
        </p>
      )}
      <form action={formAction} className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept={acceptedTypes}
          required
          className="flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("importUi.uploadButton")}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
