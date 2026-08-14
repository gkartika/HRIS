"use client";

import { useActionState } from "react";
import { createAssetLocation } from "./actions";
import { t } from "@/lib/i18n/id";

export function CreateAssetLocationForm() {
  const [error, formAction, isPending] = useActionState(createAssetLocation, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-slate-500">{t("asset.locationName")}</label>
        <input name="locationName" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs text-slate-500">{t("asset.description")}</label>
        <input name="description" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : t("asset.addLocation")}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
