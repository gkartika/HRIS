"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageConsumables } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  adjustmentDelta,
  isPositiveInteger,
  parseCompanyDateInput,
  type ConsumableCategoryValue,
} from "@/lib/consumables";
import { getItemStock } from "@/lib/consumables-queries";

// `values` echoes what was typed when an action fails: React clears an
// uncontrolled form after every server action, so the forms re-fill their
// fields from it and a validation error never wipes the person's entries.
export type ConsumableActionState = { error?: string; success?: string; values?: Record<string, string> } | undefined;

function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

async function withEcho(formData: FormData, run: () => Promise<ConsumableActionState>): Promise<ConsumableActionState> {
  const result = await run();
  return result?.error ? { ...result, values: echoValues(formData) } : result;
}

const DENIED = t("common.forbidden");
const ITEM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? "").trim();
}

function parseNonNegativeInt(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function touch() {
  revalidatePath("/consumables", "layout");
}

async function createConsumableItemImpl(formData: FormData): Promise<ConsumableActionState> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return { error: DENIED };

  const category = str(formData, "category") as ConsumableCategoryValue;
  const itemCode = str(formData, "itemCode").toUpperCase();
  const itemName = str(formData, "itemName");
  const unit = str(formData, "unit");
  const openingStock = parseNonNegativeInt(str(formData, "openingStock") || "0");
  const minStock = parseNonNegativeInt(str(formData, "minStock") || "0");
  const replacementPeriodMonths = parseNonNegativeInt(str(formData, "replacementPeriodMonths") || "0");

  if (category !== "APD" && category !== "ATK") return { error: "Kategori tidak valid." };
  if (!itemCode || !ITEM_CODE_PATTERN.test(itemCode)) return { error: "Kode barang wajib diisi (huruf besar, angka, tanda hubung)." };
  if (!itemName) return { error: "Nama barang wajib diisi." };
  if (!unit) return { error: "Satuan wajib diisi." };
  if (openingStock === null || minStock === null || replacementPeriodMonths === null) {
    return { error: "Stok awal, stok minimum, dan periode ganti harus berupa bilangan bulat 0 atau lebih." };
  }

  const existing = await prisma.consumableItem.findUnique({ where: { itemCode } });
  if (existing) return { error: `Kode barang "${itemCode}" sudah digunakan.` };

  const item = await prisma.consumableItem.create({
    data: {
      itemCode,
      itemName,
      category,
      unit,
      openingStock,
      minStock,
      replacementPeriodMonths,
      createdByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ConsumableItem",
    recordId: item.id,
    reason: `Created consumable item "${itemName}" (${itemCode})`,
  });

  touch();
  return { success: `Barang ${itemCode} berhasil ditambahkan.` };
}

async function updateConsumableItemImpl(itemId: string, formData: FormData): Promise<ConsumableActionState> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return { error: DENIED };

  const item = await prisma.consumableItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Barang tidak ditemukan." };

  const itemName = str(formData, "itemName");
  const unit = str(formData, "unit");
  const minStock = parseNonNegativeInt(str(formData, "minStock") || "0");
  const replacementPeriodMonths = parseNonNegativeInt(str(formData, "replacementPeriodMonths") || "0");
  if (!itemName) return { error: "Nama barang wajib diisi." };
  if (!unit) return { error: "Satuan wajib diisi." };
  if (minStock === null || replacementPeriodMonths === null) {
    return { error: "Stok minimum dan periode ganti harus berupa bilangan bulat 0 atau lebih." };
  }

  // Opening stock is the ledger's starting point: once any transaction exists,
  // changing it would silently rewrite history — use Penyesuaian Stok instead.
  let openingStock = item.openingStock;
  const openingRaw = formData.get("openingStock");
  if (openingRaw !== null && str(formData, "openingStock") !== String(item.openingStock)) {
    const hasTransactions = (await prisma.consumableTransaction.count({ where: { itemId } })) > 0;
    if (hasTransactions) return { error: "Stok awal tidak bisa diubah setelah ada transaksi. Gunakan Penyesuaian Stok." };
    const parsed = parseNonNegativeInt(str(formData, "openingStock"));
    if (parsed === null) return { error: "Stok awal harus berupa bilangan bulat 0 atau lebih." };
    openingStock = parsed;
  }

  await prisma.consumableItem.update({
    where: { id: itemId },
    data: { itemName, unit, minStock, replacementPeriodMonths, openingStock },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ConsumableItem",
    recordId: itemId,
    reason: `Updated consumable item ${item.itemCode}`,
  });

  touch();
  return { success: `Barang ${item.itemCode} diperbarui.` };
}

// Archive only — there is deliberately no delete. An archived item leaves the
// pickers and the label sheet; its history and stock stay intact.
export async function toggleConsumableItemArchived(itemId: string): Promise<void> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return;

  const item = await prisma.consumableItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await prisma.consumableItem.update({ where: { id: itemId }, data: { archived: !item.archived } });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ConsumableItem",
    recordId: itemId,
    fieldName: "archived",
    oldValueMasked: String(item.archived),
    newValueMasked: String(!item.archived),
    reason: `${item.archived ? "Reactivated" : "Archived"} consumable item ${item.itemCode}`,
  });
  touch();
}

async function recordConsumableReceiptImpl(formData: FormData): Promise<ConsumableActionState> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return { error: DENIED };

  const itemId = str(formData, "itemId");
  const quantity = Number(str(formData, "quantity"));
  const reference = str(formData, "reference") || null;
  const note = str(formData, "note") || null;
  const recordedByLabel = str(formData, "recordedByLabel") || null;
  const occurredAt = parseCompanyDateInput(str(formData, "occurredAt"));

  if (!itemId) return { error: "Pilih barang terlebih dahulu." };
  if (!isPositiveInteger(quantity)) return { error: "Jumlah masuk harus bilangan bulat lebih dari 0." };
  if (occurredAt === "invalid") return { error: "Tanggal tidak valid." };
  if (occurredAt === "future") return { error: "Tanggal tidak boleh di masa depan." };

  const item = await prisma.consumableItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Barang tidak ditemukan." };
  if (item.archived) return { error: "Barang ini sudah diarsipkan." };

  const tx = await prisma.consumableTransaction.create({
    data: {
      itemId,
      type: "RECEIPT",
      quantityDelta: quantity,
      occurredAt,
      reference,
      note,
      recordedByAccountId: session.user.id,
      recordedByLabel,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ConsumableTransaction",
    recordId: tx.id,
    reason: `Barang masuk ${quantity} ${item.unit} — ${item.itemCode}`,
  });

  touch();
  return { success: `Barang masuk ${quantity} ${item.unit} untuk ${item.itemName} tercatat.` };
}

async function recordConsumableAdjustmentImpl(formData: FormData): Promise<ConsumableActionState> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return { error: DENIED };

  const itemId = str(formData, "itemId");
  const physicalStock = parseNonNegativeInt(str(formData, "physicalStock"));
  const reason = str(formData, "reason");
  const recordedByLabel = str(formData, "recordedByLabel") || null;

  if (!itemId) return { error: "Pilih barang terlebih dahulu." };
  if (physicalStock === null) return { error: "Stok fisik harus bilangan bulat 0 atau lebih." };
  if (!reason) return { error: "Alasan penyesuaian wajib diisi." };

  const item = await prisma.consumableItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Barang tidak ditemukan." };
  if (item.archived) return { error: "Barang ini sudah diarsipkan." };

  // The delta is computed from live stock inside the transaction, so a take
  // recorded a moment earlier is never overwritten by a stale screen value.
  const result = await prisma.$transaction(async (db) => {
    const systemStock = await getItemStock(db, itemId, item.openingStock);
    const delta = adjustmentDelta(systemStock, physicalStock);
    if (delta === 0) return { noChange: true as const, systemStock };
    const tx = await db.consumableTransaction.create({
      data: {
        itemId,
        type: "ADJUSTMENT",
        quantityDelta: delta,
        systemStockSnapshot: systemStock,
        physicalStock,
        reason,
        recordedByAccountId: session.user.id,
        recordedByLabel,
      },
    });
    return { noChange: false as const, systemStock, delta, txId: tx.id };
  });

  if (result.noChange) return { error: `Stok fisik sama dengan stok sistem (${result.systemStock}). Tidak ada yang perlu disesuaikan.` };

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "ConsumableTransaction",
    recordId: result.txId,
    reason: `Penyesuaian stok ${item.itemCode}: ${result.systemStock} → ${physicalStock}`,
  });

  touch();
  return { success: `Stok ${item.itemName} disesuaikan: ${result.systemStock} → ${physicalStock} ${item.unit}.` };
}

// Cancel, never delete: the row stays visible and stops counting toward stock.
async function cancelConsumableTransactionImpl(txId: string, formData: FormData): Promise<ConsumableActionState> {
  const session = await requireSession();
  if (!canManageConsumables(session)) return { error: DENIED };

  const reason = str(formData, "reason");
  if (!reason) return { error: "Alasan pembatalan wajib diisi." };

  const tx = await prisma.consumableTransaction.findUnique({ where: { id: txId }, include: { item: true } });
  if (!tx) return { error: "Transaksi tidak ditemukan." };

  // Guarded write: only an uncancelled row flips, so two clicks can't both win.
  const { count } = await prisma.consumableTransaction.updateMany({
    where: { id: txId, cancelledAt: null },
    data: { cancelledAt: new Date(), cancelledByAccountId: session.user.id, cancelReason: reason },
  });
  if (count === 0) return { error: "Transaksi ini sudah dibatalkan." };

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ConsumableTransaction",
    recordId: txId,
    fieldName: "cancelledAt",
    reason: `Cancelled ${tx.type} of ${tx.item.itemCode}: ${reason}`,
  });

  touch();
  return { success: "Transaksi dibatalkan." };
}

export async function createConsumableItem(_prev: ConsumableActionState, formData: FormData): Promise<ConsumableActionState> {
  return withEcho(formData, () => createConsumableItemImpl(formData));
}

export async function updateConsumableItem(itemId: string, _prev: ConsumableActionState, formData: FormData): Promise<ConsumableActionState> {
  return withEcho(formData, () => updateConsumableItemImpl(itemId, formData));
}

export async function recordConsumableReceipt(_prev: ConsumableActionState, formData: FormData): Promise<ConsumableActionState> {
  return withEcho(formData, () => recordConsumableReceiptImpl(formData));
}

export async function recordConsumableAdjustment(_prev: ConsumableActionState, formData: FormData): Promise<ConsumableActionState> {
  return withEcho(formData, () => recordConsumableAdjustmentImpl(formData));
}

export async function cancelConsumableTransaction(txId: string, _prev: ConsumableActionState, formData: FormData): Promise<ConsumableActionState> {
  return withEcho(formData, () => cancelConsumableTransactionImpl(txId, formData));
}
