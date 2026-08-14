"use client";

import { useActionState, useState } from "react";
import { createFixedAsset } from "./actions";
import { t } from "@/lib/i18n/id";

export function CreateAssetForm() {
  const [error, formAction, isPending] = useActionState(createFixedAsset, undefined);
  const [trackingType, setTrackingType] = useState("INDIVIDUAL");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.assetCode")}</label>
        <input name="assetCode" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.assetName")}</label>
        <input name="assetName" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.category")}</label>
        <input name="category" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.trackingType")}</label>
        <select
          name="trackingType"
          value={trackingType}
          onChange={(e) => setTrackingType(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="INDIVIDUAL">{t("asset.trackingTypeIndividual")}</option>
          <option value="QUANTITY_TRACKED">{t("asset.trackingTypeQuantity")}</option>
        </select>
      </div>
      {trackingType === "QUANTITY_TRACKED" && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("asset.totalQuantity")}</label>
          <input name="totalQuantity" type="number" min={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.purchaseDate")}</label>
        <input name="purchaseDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.purchaseCost")}</label>
        <input name="purchaseCost" type="number" min={0} step="any" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">{t("asset.notes")}</label>
        <input name="notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : t("asset.addAsset")}
        </button>
      </div>
    </form>
  );
}
