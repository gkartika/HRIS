import { describe, expect, it } from "vitest";
import { formatLossDate, isOpenReport, validateRequestText } from "./ga-request-rules";

describe("validateRequestText", () => {
  it("asks only a short description for a new asset need", () => {
    expect(validateRequestText("NEW_ASSET_NEED", "monitor kedua 24 inci")).toBeNull();
    expect(validateRequestText("NEW_ASSET_NEED", "monitor")).toContain("minimal 10");
    expect(validateRequestText("NEW_ASSET_NEED", "          ")).toContain("minimal 10");
  });

  it("makes a damage or loss report say what happened", () => {
    expect(validateRequestText("DAMAGE_OR_ABNORMAL_CONDITION", "rusak")).toContain("apa yang rusak");
    expect(validateRequestText("DAMAGE_OR_ABNORMAL_CONDITION", "layar berkedip sejak senin, jatuh dari meja")).toBeNull();
    expect(validateRequestText("LOSS", "hilang")).toContain("kronologi");
    expect(validateRequestText("LOSS", "terakhir dipakai selasa sore di area tambang")).toBeNull();
  });
});

describe("isOpenReport", () => {
  it("is open until the report is finished, turned down or decided", () => {
    expect(isOpenReport("DAMAGE_OR_ABNORMAL_CONDITION", "SUBMITTED")).toBe(true);
    expect(isOpenReport("DAMAGE_OR_ABNORMAL_CONDITION", "WORK_ORDER_CREATED")).toBe(true);
    expect(isOpenReport("DAMAGE_OR_ABNORMAL_CONDITION", "COMPLETED")).toBe(false);
    expect(isOpenReport("DAMAGE_OR_ABNORMAL_CONDITION", "REJECTED")).toBe(false);
    expect(isOpenReport("LOSS", "SUBMITTED")).toBe(true);
    expect(isOpenReport("LOSS", "LOSS_CONFIRMED")).toBe(false);
    expect(isOpenReport("NEW_ASSET_NEED", "SUBMITTED")).toBe(false);
  });
});

describe("formatLossDate", () => {
  it("writes the date day first, or nothing when it is not a date", () => {
    expect(formatLossDate("2026-10-14")).toBe("14/10/2026");
    expect(formatLossDate("")).toBeNull();
    expect(formatLossDate("besok")).toBeNull();
  });
});
