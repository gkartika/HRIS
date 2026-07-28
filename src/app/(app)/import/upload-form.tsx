"use client";

import { useActionState } from "react";
import { uploadAndPreviewImport } from "./actions";
import { t } from "@/lib/i18n/id";

export function UploadForm() {
  const [error, formAction, isPending] = useActionState(uploadAndPreviewImport, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-6">
      <label className="mb-2 block text-xs text-slate-500">{t("importUi.uploadLabel")}</label>
      <div className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv"
          required
          className="flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("importUi.uploadButton")}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <a
        href="/sample-employee-import.csv"
        download
        className="mt-3 inline-block text-xs text-indigo-600 hover:underline"
      >
        {t("importUi.downloadSample")}
      </a>
    </form>
  );
}
