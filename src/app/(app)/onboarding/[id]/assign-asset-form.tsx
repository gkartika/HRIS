"use client";

import { useState } from "react";
import { assignAssetDuringOnboarding } from "../actions";
import { t } from "@/lib/i18n/id";

interface AssetOption {
  id: string;
  label: string;
  trackingType: string;
  availableQuantity: number | null;
}

export function AssignAssetDuringOnboardingForm({
  caseId,
  employeeId,
  assets,
}: {
  caseId: string;
  employeeId: string;
  assets: AssetOption[];
}) {
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const selectedAsset = assets.find((a) => a.id === assetId);

  async function handleSubmit(formData: FormData) {
    if (!assetId) {
      setError("Aset wajib dipilih.");
      return;
    }
    formData.set("employeeId", employeeId);
    setIsPending(true);
    const result = await assignAssetDuringOnboarding(caseId, assetId, undefined, formData);
    setIsPending(false);
    setError(result);
    if (!result) setAssetId("");
  }

  if (assets.length === 0) {
    return <p className="mt-2 pl-7 text-xs text-slate-400">Tidak ada aset tersedia untuk diserahkan saat ini.</p>;
  }

  return (
    <form action={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 pl-7 md:grid-cols-4">
      <div className="md:col-span-2">
        <select
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Pilih Aset untuk Diserahkan —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {selectedAsset?.trackingType === "QUANTITY_TRACKED" && (
        <div>
          <input
            name="quantity"
            type="number"
            min={1}
            max={selectedAsset.availableQuantity ?? undefined}
            defaultValue={1}
            placeholder={t("asset.quantity")}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      )}
      <div>
        <input
          name="conditionAtHandover"
          placeholder={t("asset.conditionAtHandoverLabel")}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "..." : t("asset.assignButton")}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 md:col-span-4">{error}</p>}
    </form>
  );
}
