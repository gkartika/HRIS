// The fixed list behind the Kategori dropdown on Master Aset Tetap. Stored as
// plain text on FixedAsset.category, so rows saved before the dropdown existed
// keep whatever they had.
export const ASSET_CATEGORIES = ["Umum", "IT", "Kendaraan"] as const;

// "it" / " IT " -> "IT"; anything not on the list -> null.
export function normalizeAssetCategory(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  return ASSET_CATEGORIES.find((c) => c.toLowerCase() === value) ?? null;
}
