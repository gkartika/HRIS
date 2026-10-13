import { describe, expect, it } from "vitest";
import { interpretAssetRow, isBlankAssetRow, nextAssetCode, parseImportDate, parseImportMoney, toAssetImportRow } from "./asset-import";

const row = (raw: Record<string, string>) => toAssetImportRow(raw);

describe("toAssetImportRow", () => {
  it("reads template headers and Indonesian headers alike, ignoring case and punctuation", () => {
    const r = row({ "Kode Aset": " A-1 ", "Nama Aset": "Laptop", "Model/Tipe/Merek": "Dell", "No Aset": "N1", Spesifikasi: "i5", "Tipe Pelacakan": "Kuantitas", "Jumlah Total": "5", "Tanggal Pembelian": "1/2/2026", "Harga Beli": "10", Catatan: "x", Kategori: "IT", Lain: "diabaikan" });
    expect(r).toMatchObject({ assetCode: "A-1", assetName: "Laptop", modelBrand: "Dell", assetNumber: "N1", specification: "i5", trackingType: "Kuantitas", totalQuantity: "5", category: "IT", notes: "x" });
  });

  it("treats missing columns as blank and detects an empty row", () => {
    expect(isBlankAssetRow(row({ assetCode: "", assetName: "  " }))).toBe(true);
    expect(isBlankAssetRow(row({ notes: "ada" }))).toBe(false);
  });
});

describe("parseImportDate", () => {
  it("reads ISO and day-first dates and rejects impossible ones", () => {
    expect(parseImportDate("2026-03-12")?.toISOString().slice(0, 10)).toBe("2026-03-12");
    expect(parseImportDate("12/03/2026")?.toISOString().slice(0, 10)).toBe("2026-03-12");
    expect(parseImportDate("5-1-2026")?.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(parseImportDate("31/02/2026")).toBeNull();
    expect(parseImportDate("kemarin")).toBeNull();
    expect(parseImportDate("")).toBeNull();
  });
});

describe("parseImportMoney", () => {
  it("handles Indonesian and plain formats", () => {
    expect(parseImportMoney("12000000")).toBe(12000000);
    expect(parseImportMoney("Rp 12.000.000")).toBe(12000000);
    expect(parseImportMoney("12.000.000,50")).toBe(12000000.5);
    expect(parseImportMoney("12,000,000.50")).toBe(12000000.5);
    expect(parseImportMoney("1500,5")).toBe(1500.5);
    expect(parseImportMoney("mahal")).toBeNull();
    expect(parseImportMoney("-5")).toBeNull();
  });
});

describe("interpretAssetRow", () => {
  it("accepts a row with only a note and fills in the rest", () => {
    const a = interpretAssetRow(row({ notes: "kursi lama" }));
    expect(a.assetCode).toBeNull();
    expect(a.displayName).toBe("(Tanpa nama)");
    expect(a.trackingType).toBeNull();
    expect(a.warnings.some((w) => w.includes("Nama aset kosong"))).toBe(true);
  });

  it("names an asset after its model, then its asset number, when the name is empty", () => {
    expect(interpretAssetRow(row({ modelBrand: "Toyota Hilux" })).displayName).toBe("Toyota Hilux");
    expect(interpretAssetRow(row({ assetNumber: "N-7" })).displayName).toBe("N-7");
  });

  it("moves an unknown category into the notes instead of rejecting", () => {
    const a = interpretAssetRow(row({ assetName: "Meja", category: "Furniture", notes: "baru" }));
    expect(a.category).toBeNull();
    expect(a.notes).toBe("baru | Kategori dari berkas: Furniture");
    expect(interpretAssetRow(row({ assetName: "PC", category: "it" })).category).toBe("IT");
  });

  it("defaults tracking type and quantity instead of failing", () => {
    expect(interpretAssetRow(row({ assetName: "x", trackingType: "aneh" })).warnings.join()).toContain("tidak dikenali");
    const q = interpretAssetRow(row({ assetName: "Helm", trackingType: "Kuantitas" }));
    expect(q.trackingType).toBe("QUANTITY_TRACKED");
    expect(q.totalQuantity).toBe(1);
    expect(interpretAssetRow(row({ assetName: "Helm", trackingType: "KUANTITAS", totalQuantity: "50" })).totalQuantity).toBe(50);
    expect(interpretAssetRow(row({ assetName: "Helm", trackingType: "Kuantitas", totalQuantity: "-2" })).totalQuantity).toBe(1);
  });

  it("drops an unreadable date or price with a note", () => {
    const a = interpretAssetRow(row({ assetName: "x", purchaseDate: "besok", purchaseCost: "gratis" }));
    expect(a.purchaseDate).toBeNull();
    expect(a.purchaseCost).toBeNull();
    expect(a.warnings).toHaveLength(2);
  });
});

describe("nextAssetCode", () => {
  it("continues after the highest AST- number and ignores other codes", () => {
    expect(nextAssetCode([])).toBe("AST-0001");
    expect(nextAssetCode(["AST-0007", "AST-0003", "LAP-9", "ast-0010"])).toBe("AST-0011");
  });
});
