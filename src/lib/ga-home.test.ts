import { describe, expect, it } from "vitest";
import {
  countBy,
  daysSince,
  daysUntil,
  deadlineLabel,
  deadlineSeverity,
  oldestAge,
  sortTodo,
  waitingLabel,
  waitingSeverity,
  type TodoRow,
} from "./ga-home";

// 12:00 WIB on a given day.
const wib = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 5));
const now = wib(2026, 10, 6);

describe("daysSince / daysUntil", () => {
  it("counts company calendar days", () => {
    expect(daysSince(wib(2026, 10, 1), now)).toBe(5);
    expect(daysSince(wib(2026, 10, 6), now)).toBe(0);
  });
  it("uses the WIB day, not the UTC day", () => {
    // 23:30 WIB on 5 Oct is 16:30 UTC on 5 Oct; 00:30 WIB on 6 Oct is 17:30 UTC on 5 Oct.
    const earlyToday = new Date(Date.UTC(2026, 9, 5, 17, 30));
    expect(daysSince(earlyToday, now)).toBe(0);
  });
  it("never goes negative for a future date", () => {
    expect(daysSince(wib(2026, 10, 9), now)).toBe(0);
  });
  it("counts days left and overdue", () => {
    expect(daysUntil(wib(2026, 10, 9), now)).toBe(3);
    expect(daysUntil(wib(2026, 10, 4), now)).toBe(-2);
  });
});

describe("severity", () => {
  it("waiting: amber from 3 days, rose from 7", () => {
    expect(waitingSeverity(0)).toBe("slate");
    expect(waitingSeverity(2)).toBe("slate");
    expect(waitingSeverity(3)).toBe("amber");
    expect(waitingSeverity(6)).toBe("amber");
    expect(waitingSeverity(7)).toBe("rose");
  });
  it("deadline: rose when overdue or within 3 days, amber within 7", () => {
    expect(deadlineSeverity(-1)).toBe("rose");
    expect(deadlineSeverity(3)).toBe("rose");
    expect(deadlineSeverity(4)).toBe("amber");
    expect(deadlineSeverity(7)).toBe("amber");
    expect(deadlineSeverity(8)).toBe("slate");
  });
});

describe("labels", () => {
  it("words the wait and the deadline", () => {
    expect(waitingLabel(0)).toBe("baru hari ini");
    expect(waitingLabel(5)).toBe("menunggu 5 hari");
    expect(deadlineLabel(-2)).toBe("terlambat 2 hari");
    expect(deadlineLabel(0)).toBe("batas hari ini");
    expect(deadlineLabel(3)).toBe("3 hari lagi");
  });
});

const row = (title: string, severity: TodoRow["severity"], urgency: number): TodoRow => ({
  kind: "ga",
  type: "t",
  title,
  who: "",
  statusLabel: "",
  severity,
  urgency,
  timeLabel: "",
  actionLabel: "",
  href: "/",
});

describe("sortTodo", () => {
  it("orders rose before amber before slate, longest wait first inside each", () => {
    const sorted = sortTodo([row("a", "slate", 99), row("b", "amber", 3), row("c", "rose", 1), row("d", "amber", 6), row("e", "rose", 12)]);
    expect(sorted.map((r) => r.title)).toEqual(["e", "c", "d", "b", "a"]);
  });
  it("does not change the input order", () => {
    const input = [row("a", "slate", 1), row("b", "rose", 1)];
    sortTodo(input);
    expect(input.map((r) => r.title)).toEqual(["a", "b"]);
  });
});

describe("oldestAge / countBy", () => {
  it("returns the age of the oldest date, or null for none", () => {
    expect(oldestAge([], now)).toBeNull();
    expect(oldestAge([wib(2026, 10, 5), wib(2026, 9, 24), wib(2026, 10, 1)], now)).toBe(12);
  });
  it("counts by key", () => {
    expect(countBy(["a", "b", "a"], (x) => x)).toEqual({ a: 2, b: 1 });
  });
});
