import { describe, expect, it } from "vitest";
import { groupByHorizon, horizonForDeadline, horizonForWaiting, payrollProgress, sortRows, type HcTodoRow } from "./hc-home";

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
  horizon: "today",
  ...over,
});

describe("horizonForWaiting", () => {
  it("is today for the first six days and late from the seventh", () => {
    expect(horizonForWaiting(0)).toBe("today");
    expect(horizonForWaiting(6)).toBe("today");
    expect(horizonForWaiting(7)).toBe("late");
  });
});

describe("horizonForDeadline", () => {
  it("puts past deadlines in late and splits the rest by how close they are", () => {
    expect(horizonForDeadline(-1)).toBe("late");
    expect(horizonForDeadline(0)).toBe("today");
    expect(horizonForDeadline(2)).toBe("today");
    expect(horizonForDeadline(3)).toBe("week");
    expect(horizonForDeadline(7)).toBe("week");
    expect(horizonForDeadline(8)).toBe("upcoming");
  });
});

describe("sortRows", () => {
  it("orders by severity, then by urgency within a severity", () => {
    const sorted = sortRows([
      row({ title: "amber-old", severity: "amber", urgency: 9 }),
      row({ title: "rose-new", severity: "rose", urgency: 1 }),
      row({ title: "amber-new", severity: "amber", urgency: 2 }),
      row({ title: "rose-old", severity: "rose", urgency: 5 }),
    ]);
    expect(sorted.map((r) => r.title)).toEqual(["rose-old", "rose-new", "amber-old", "amber-new"]);
  });
});

describe("groupByHorizon", () => {
  it("returns groups in reading order and drops empty ones", () => {
    const groups = groupByHorizon([
      row({ title: "a", horizon: "upcoming" }),
      row({ title: "b", horizon: "late", severity: "rose" }),
      row({ title: "c", horizon: "late", severity: "amber" }),
    ]);
    expect(groups.map((g) => g.horizon)).toEqual(["late", "upcoming"]);
    expect(groups[0].rows.map((r) => r.title)).toEqual(["b", "c"]);
  });

  it("returns no groups when there is nothing to do", () => {
    expect(groupByHorizon([])).toEqual([]);
  });
});

describe("payrollProgress", () => {
  const start = new Date(Date.UTC(2026, 9, 21));
  const end = new Date(Date.UTC(2026, 10, 20));

  it("counts a 31-day period with both ends inclusive", () => {
    const p = payrollProgress(start, end, new Date(Date.UTC(2026, 9, 21)));
    expect(p.totalDays).toBe(31);
    expect(p.elapsedDays).toBe(1);
    expect(p.daysLeft).toBe(30);
  });

  it("is on its last day on the 20th", () => {
    const p = payrollProgress(start, end, end);
    expect(p.daysLeft).toBe(0);
    expect(p.elapsedPercent).toBe(100);
  });

  it("stays inside 0 to 100 percent outside the period", () => {
    expect(payrollProgress(start, end, new Date(Date.UTC(2026, 9, 1))).elapsedPercent).toBe(0);
    expect(payrollProgress(start, end, new Date(Date.UTC(2026, 11, 1))).elapsedPercent).toBe(100);
  });
});
