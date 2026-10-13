"use client";

import { useActionState, useState, startTransition } from "react";
import { updateFixedAsset, type EditAssetState } from "../edit-actions";
import { ASSET_CATEGORIES } from "@/lib/asset-categories";
import { t } from "@/lib/i18n/id";

export interface EditableAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  assetNumber: string;
  modelBrand: string;
  specification: string;
  trackingType: string;
  totalQuantity: string;
  purchaseDate: string;
  purchaseCost: string;
  notes: string;
  /** Units of a Kuantitas asset that are with people right now. */
  outNow: number;
  hasCustodyHistory: boolean;
}

const INPUT = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const LABEL = "mb-1 block text-xs text-slate-500";

// "Ubah Data Aset": every field of the asset in one form, code included. Status
// is not here, it follows handovers, returns and disposals.
export function EditAssetForm({ asset }: { asset: EditableAsset }) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(asset.trackingType);
  const [state, formAction, isPending] = useActionState<EditAssetState, FormData>(async (prev, formData) => {
    const result = await updateFixedAsset(asset.id, prev, formData);
    if (result?.saved) setOpen(false);
    return result;
  }, undefined);

  if (!open) {
    return (
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setTracking(asset.trackingType);
            setOpen(true);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ubah Data Aset
        </button>
        {state?.saved && <span className="text-xs text-emerald-700">Perubahan tersimpan.</span>}
      </div>
    );
  }

  const legacyCategory = asset.category && !(ASSET_CATEGORIES as readonly string[]).includes(asset.category) ? asset.category : null;

  return (
    // onSubmit instead of the form action prop: React clears an action form after it runs, which would wipe
    // everything typed whenever validation fails.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4">
      <p className="text-sm font-medium text-slate-900 md:col-span-4">Ubah Data Aset</p>
      {state?.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{state.error}</p>}
      <div>
        <label className={LABEL}>{t("asset.assetCode")}</label>
        <input name="assetCode" required defaultValue={asset.assetCode} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>{t("asset.assetName")}</label>
        <input name="assetName" required defaultValue={asset.assetName} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>{t("asset.category")}</label>
        <select name="category" defaultValue={asset.category} className={INPUT}>
          <option value="">— Pilih —</option>
          {legacyCategory && <option value={legacyCategory}>{legacyCategory}</option>}
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>{t("asset.assetNumber")}</label>
        <input name="assetNumber" defaultValue={asset.assetNumber} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>{t("asset.modelBrand")}</label>
        <input name="modelBrand" defaultValue={asset.modelBrand} className={INPUT} />
      </div>
      <div className="md:col-span-3">
        <label className={LABEL}>{t("asset.specification")}</label>
        <input name="specification" defaultValue={asset.specification} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>{t("asset.trackingType")}</label>
        {asset.hasCustodyHistory ? (
          <>
            <input type="hidden" name="trackingType" value={asset.trackingType} />
            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {asset.trackingType === "INDIVIDUAL" ? t("asset.trackingTypeIndividual") : t("asset.trackingTypeQuantity")}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Terkunci karena aset sudah pernah diserahkan.</p>
          </>
        ) : (
          <select name="trackingType" value={tracking} onChange={(e) => setTracking(e.target.value)} className={INPUT}>
            <option value="INDIVIDUAL">{t("asset.trackingTypeIndividual")}</option>
            <option value="QUANTITY_TRACKED">{t("asset.trackingTypeQuantity")}</option>
          </select>
        )}
      </div>
      {tracking === "QUANTITY_TRACKED" && (
        <div>
          <label className={LABEL}>{t("asset.totalQuantity")}</label>
          <input name="totalQuantity" type="number" min={Math.max(1, asset.outNow)} step={1} defaultValue={asset.totalQuantity} className={INPUT} />
          {asset.outNow > 0 && <p className="mt-1 text-[11px] text-slate-400">{asset.outNow} unit sedang dipegang; tersedia dihitung ulang otomatis.</p>}
        </div>
      )}
      <div>
        <label className={LABEL}>{t("asset.purchaseDate")}</label>
        <input name="purchaseDate" type="date" defaultValue={asset.purchaseDate} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>{t("asset.purchaseCost")}</label>
        <input name="purchaseCost" type="number" min={0} step="any" defaultValue={asset.purchaseCost} className={INPUT} />
      </div>
      <div className="md:col-span-2">
        <label className={LABEL}>{t("asset.notes")}</label>
        <input name="notes" defaultValue={asset.notes} className={INPUT} />
      </div>
      <div className="flex items-end gap-2 md:col-span-4">
        <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {isPending ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </form>
  );
}
