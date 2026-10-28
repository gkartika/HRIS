import { describe, expect, it } from "vitest";
import { categoryCounts, categoryOf, departmentBreakdown, groupByCategory, onboardingContractSeverity, payrollProgress, startLabel, type HcTodoRow } from "./hc-home";

const row = (over: Partial<HcTodoRow>): HcTodoRow => ({
  kind: "ct",
  type: "Kontrak",
  title: "t",
  who: "w",
  statusLabel: "s",
  severity: "slate",
  urgency: 0,
  timeLabel: "",
  actionLabel: "a",
  href: "/x",
  ...over,
});

describe("categoryOf", () => {
  it("sorts every kind of to-do into one of the six kinds of work", () => {
    expect(categoryOf({ kind: "ob", type: "Onboarding" })).toBe("ob");
    expect(categoryOf({ kind: "ob", type: "Akun login" })).toBe("data");
    expect(categoryOf({ kind: "rc", type: "Perpanjangan kontrak" })).toBe("ct");
    expect(categoryOf({ kind: "ct", type: "Kontrak" })).toBe("ct");
    expect(categoryOf({ kind: "mv", type: "Perubahan Posisi" })).toBe("mv");
    expect(categoryOf({ kind: "ab", type: "Absensi & cuti" })).toBe("ab");
    expect(categoryOf({ kind: "of", type: "Offboarding" })).toBe("of");
  });
});

describe("groupByCategory", () => {
  it("drops empty groups and puts the one with the most urgent row first, rows most urgent first", () => {
    const groups = groupByCategory([
      row({ kind: "ob", type: "Onboarding", title: "late-slate", urgency: 1 }),
      row({ kind: "ob", type: "Onboarding", title: "amber", severity: "amber", urgency: 1 }),
      row({ kind: "of", type: "Offboarding", title: "rose", severity: "rose", urgency: 5 }),
      row({ kind: "ob", type: "Akun login", title: "accounts" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["of", "ob", "data"]);
    expect(groups[1].rows.map((r) => r.title)).toEqual(["amber", "late-slate"]);
  });

  it("equally urgent groups keep the fixed order of the kinds of work", () => {
    const groups = groupByCategory([row({ kind: "ab", type: "Absensi & cuti" }), row({ kind: "ct" }), row({ kind: "mv", type: "Perubahan Posisi" })]);
    expect(groups.map((g) => g.key)).toEqual(["ct", "mv", "ab"]);
  });

  it("counts per kind and in total", () => {
    const counts = categoryCounts([row({ kind: "ct" }), row({ kind: "rc" }), row({ kind: "ob", type: "Akun login" })]);
    expect(counts).toEqual({ all: 3, ob: 0, of: 0, ct: 2, mv: 0, ab: 0, data: 1 });
  });
});

describe("a new employee's contract", () => {
  it("is quiet while the start is far off, amber close to it and red once the person has started without it", () => {
    expect(onboardingContractSeverity(21)).toBe("slate");
    expect(onboardingContractSeverity(3)).toBe("slate");
    expect(onboardingContractSeverity(2)).toBe("amber");
    expect(onboardingContractSeverity(0)).toBe("amber");
    expect(onboardingContractSeverity(-1)).toBe("rose");
  });

  it("says when the person starts", () => {
    expect(startLabel(-2)).toBe("terlambat 2 hari");
    expect(startLabel(0)).toBe("masuk hari ini");
    expect(startLabel(1)).toBe("masuk besok");
    expect(startLabel(7)).toBe("masuk 7 hari lagi");
  });
});

describe("departmentBreakdown", () => {
  it("lists the biggest first and sums the tail into Lainnya", () => {
    const counts = new Map([["A", 5], ["B", 9], ["C", 1], ["D", 3]]);
    expect(departmentBreakdown(counts, 4)).toEqual([{ name: "B", count: 9 }, { name: "A", count: 5 }, { name: "D", count: 3 }, { name: "C", count: 1 }]);
    expect(departmentBreakdown(counts, 2)).toEqual([{ name: "B", count: 9 }, { name: "A", count: 5 }, { name: "Lainnya", count: 4 }]);
  });
});

describe("payrollProgress", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it("counts both ends of the period and clamps outside it", () => {
    const p = payrollProgress(d("2026-10-21"), d("2026-11-20"), d("2026-10-28"));
    expect(p).toMatchObject({ totalDays: 31, elapsedDays: 8, daysLeft: 23 });
    expect(payrollProgress(d("2026-10-21"), d("2026-11-20"), d("2026-10-01")).elapsedPercent).toBe(0);
    expect(payrollProgress(d("2026-10-21"), d("2026-11-20"), d("2026-12-01")).elapsedPercent).toBe(100);
  });
});
