// Rules for editing the tracking type and stock of an existing asset. Pure
// logic, no Prisma imports, so it is unit testable.
export type AssetTracking = "INDIVIDUAL" | "QUANTITY_TRACKED";

export interface QuantityEditInput {
  currentTracking: AssetTracking;
  currentTotal: number | null;
  currentAvailable: number | null;
  /** The asset has ever been handed to anyone (open or returned). */
  hasCustodyHistory: boolean;
  newTracking: AssetTracking;
  /** The typed total, only read for Kuantitas assets. */
  newTotal: number | null;
}

export type QuantityEditResult =
  | { error: string }
  | { trackingType: AssetTracking; totalQuantity: number | null; availableQuantity: number | null };

const isPositiveInt = (n: number | null): n is number => n !== null && Number.isInteger(n) && n > 0;

// The tracking type can only change while the asset has no custody history, since
// every handover and return is counted in that type's terms. A Kuantitas total can
// change any time, but never below what is out with people right now: the units
// out stay out, and "tersedia" becomes the new total minus those.
export function planQuantityEdit(input: QuantityEditInput): QuantityEditResult {
  const { currentTracking, newTracking, hasCustodyHistory } = input;

  if (newTracking !== currentTracking) {
    if (hasCustodyHistory) return { error: "Tipe pelacakan tidak bisa diubah karena aset ini sudah pernah diserahkan." };
    if (newTracking === "INDIVIDUAL") return { trackingType: "INDIVIDUAL", totalQuantity: null, availableQuantity: null };
    if (!isPositiveInt(input.newTotal)) return { error: "Jumlah total wajib diisi dengan angka lebih dari 0 untuk aset Kuantitas." };
    return { trackingType: "QUANTITY_TRACKED", totalQuantity: input.newTotal, availableQuantity: input.newTotal };
  }

  if (currentTracking === "INDIVIDUAL") return { trackingType: "INDIVIDUAL", totalQuantity: null, availableQuantity: null };

  if (!isPositiveInt(input.newTotal)) return { error: "Jumlah total wajib diisi dengan angka lebih dari 0 untuk aset Kuantitas." };
  const outNow = (input.currentTotal ?? 0) - (input.currentAvailable ?? 0);
  if (input.newTotal < outNow) {
    return { error: `Jumlah total tidak boleh kurang dari ${outNow}, karena ${outNow} unit sedang dipegang. Kembalikan dulu unitnya.` };
  }
  return { trackingType: "QUANTITY_TRACKED", totalQuantity: input.newTotal, availableQuantity: input.newTotal - outNow };
}
