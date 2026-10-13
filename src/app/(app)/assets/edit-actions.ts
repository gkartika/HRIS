"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAssets } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ASSET_CATEGORIES, normalizeAssetCategory } from "@/lib/asset-categories";
import { planQuantityEdit } from "@/lib/asset-edit";

export type EditAssetState = { error?: string; saved?: boolean } | undefined;

// Edit every field of an existing asset, including its code. Status is not a
// field here: it follows the handovers, returns and disposals.
export async function updateFixedAsset(assetId: string, _prevState: EditAssetState, formData: FormData): Promise<EditAssetState> {
  const session = await requireSession();
  if (!canManageAssets(session)) return { error: t("common.forbidden") };

  const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId }, include: { _count: { select: { custodies: true } } } });
  if (!asset) return { error: "Aset tidak ditemukan." };

  const text = (name: string) => (formData.get(name) as string | null)?.trim() ?? "";
  const assetCode = text("assetCode");
  const assetName = text("assetName");
  if (!assetCode) return { error: "Kode aset wajib diisi." };
  if (!assetName) return { error: "Nama aset wajib diisi." };

  if (assetCode !== asset.assetCode) {
    const taken = await prisma.fixedAsset.findUnique({ where: { assetCode } });
    if (taken) return { error: `Kode aset "${assetCode}" sudah digunakan.` };
  }

  // A category saved before the dropdown existed may be kept as it is; anything new must be on the list.
  const categoryRaw = text("category");
  let category: string | null;
  if (!categoryRaw) category = null;
  else if (categoryRaw === asset.category) category = asset.category;
  else {
    category = normalizeAssetCategory(categoryRaw);
    if (!category) return { error: `Kategori harus salah satu dari: ${ASSET_CATEGORIES.join(", ")}.` };
  }

  const purchaseDateRaw = text("purchaseDate");
  let purchaseDate: Date | null = null;
  if (purchaseDateRaw) {
    purchaseDate = new Date(purchaseDateRaw);
    if (Number.isNaN(purchaseDate.getTime())) return { error: "Tanggal pembelian tidak valid." };
  }
  const purchaseCostRaw = text("purchaseCost");
  let purchaseCost: number | null = null;
  if (purchaseCostRaw) {
    purchaseCost = Number(purchaseCostRaw);
    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) return { error: "Harga beli tidak valid." };
  }

  const trackingRaw = text("trackingType");
  if (trackingRaw !== "INDIVIDUAL" && trackingRaw !== "QUANTITY_TRACKED") return { error: "Tipe pelacakan tidak valid." };
  const totalRaw = text("totalQuantity");
  const plan = planQuantityEdit({
    currentTracking: asset.trackingType,
    currentTotal: asset.totalQuantity,
    currentAvailable: asset.availableQuantity,
    hasCustodyHistory: asset._count.custodies > 0,
    newTracking: trackingRaw,
    newTotal: totalRaw ? Number(totalRaw) : null,
  });
  if ("error" in plan) return { error: plan.error };

  const next = {
    assetCode,
    assetName,
    category,
    assetNumber: text("assetNumber") || null,
    modelBrand: text("modelBrand") || null,
    specification: text("specification") || null,
    trackingType: plan.trackingType,
    totalQuantity: plan.totalQuantity,
    availableQuantity: plan.availableQuantity,
    purchaseDate,
    purchaseCost,
    notes: text("notes") || null,
  };

  const show = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? "" : String(v));
  const changes = (Object.keys(next) as (keyof typeof next)[])
    .filter((key) => show(next[key]) !== show(asset[key]))
    .map((key) => ({ field: key, from: show(asset[key]), to: show(next[key]) }));
  if (changes.length === 0) return { saved: true };

  await prisma.fixedAsset.update({ where: { id: assetId }, data: next });
  for (const c of changes) {
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "FixedAsset",
      recordId: assetId,
      fieldName: c.field,
      oldValueMasked: c.from || null,
      newValueMasked: c.to || null,
      reason: `Edited asset ${next.assetCode}`,
    });
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return { saved: true };
}
