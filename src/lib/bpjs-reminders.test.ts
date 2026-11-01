import { describe, expect, it } from "vitest";
import { BPJS_TASK_KEY, bpjsSeverity, buildBpjsRows, deactivationDates, leftText, monthKey, monthlyListDeadline, parseMonthKey, registrationDeadline, taskKind, type BpjsInput } from "./bpjs-reminders";
import { buildBpjsListSheet } from "./bpjs-export";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
const iso = (x: Date) => x.toISOString().slice(0, 10);
// November's two payments are marked by default, so a scenario after the 8th is not about them.
const NOVEMBER_PAID = ["PAY_KES:2026-11", "PAY_TK:2026-11"];
const base = (today: Date, over: Partial<BpjsInput> = {}): BpjsInput => ({ today, newcomers: [], missingStartDate: 0, leavers: [], activeListSize: 81, ...over, done: new Set([...NOVEMBER_PAID, ...(over.done ?? [])]) });

describe("deactivationDates", () => {
  it.each([
    ["2026-11-30", "2026-12-01", "2026-11-18", "2026-12-05"],
    ["2026-12-01", "2026-12-01", "2026-11-18", "2026-12-05"],
    ["2026-12-02", "2027-01-01", "2026-12-18", "2027-01-05"],
    ["2026-12-15", "2027-01-01", "2026-12-18", "2027-01-05"],
    ["2026-12-31", "2027-01-01", "2026-12-18", "2027-01-05"],
    ["2027-01-01", "2027-01-01", "2026-12-18", "2027-01-05"],
    ["2027-01-15", "2027-02-01", "2027-01-18", "2027-02-05"],
  ])("last day %s goes off %s, Kesehatan by %s, TK by %s", (last, off, kes, tk) => {
    const r = deactivationDates(new Date(`${last}T00:00:00Z`));
    expect([iso(r.offDate), iso(r.kesDeadline), iso(r.tkDeadline)]).toEqual([off, kes, tk]);
  });
});

describe("dates and labels", () => {
  it("registration deadline is 7 days after the start", () => expect(iso(registrationDeadline(d(2026, 11, 5)))).toBe("2026-11-12"));
  it("monthly list is due the last day of the month before", () => {
    expect(iso(monthlyListDeadline(2026, 11))).toBe("2026-11-30");
    expect(iso(monthlyListDeadline(2027, 0))).toBe("2026-12-31");
  });
  it("severity: grey far, amber within 3 days, red after", () => {
    expect([bpjsSeverity(10), bpjsSeverity(4), bpjsSeverity(3), bpjsSeverity(0), bpjsSeverity(-1)]).toEqual(["slate", "slate", "amber", "amber", "rose"]);
  });
  it("labels", () => {
    expect([leftText(-4), leftText(0), leftText(1), leftText(2), leftText(19)]).toEqual(["terlambat 4 hari", "hari ini", "besok", "sisa 2 hari", "19 hari lagi"]);
  });
  it("month keys", () => {
    expect(monthKey(2026, 11)).toBe("2026-12");
    expect(monthKey(2026, 12)).toBe("2027-01");
    expect(parseMonthKey("2026-12")).toEqual({ year: 2026, monthIndex: 11 });
    expect(parseMonthKey("2026-13")).toBeNull();
  });
  it("task keys: only known shapes are accepted", () => {
    for (const ok of ["PAY_KES:2026-12", "MONTHLY_LIST:2027-01", "REGISTER_NEW:cmuxs2wmj000z04jrd05va4hk", "DEACTIVATE_TK:cmv6ei2pk000006ll2c4trqlx"]) expect(BPJS_TASK_KEY.test(ok)).toBe(true);
    for (const bad of ["PAY_KES:2026-13", "PAY_KES:abc", "OTHER:2026-12", "REGISTER_NEW:", "DEACTIVATE_KES:a b", "PAY_KES:2026-12\nx"]) expect(BPJS_TASK_KEY.test(bad)).toBe(false);
    expect(taskKind("PAY_TK:2026-12")).toBe("PAY_TK");
  });
});

describe("buildBpjsRows", () => {
  const dewi = { id: "dewi00000001", name: "Dewi Lestari", status: "Harian lepas", startDate: d(2026, 11, 5) };
  const rudi = { id: "rudi00000001", name: "Rudi Hartono", status: "Magang", startDate: d(2026, 11, 11) };
  const siti = { caseId: "siti00000001", name: "Siti Rahma", status: "PKWT", lastWorkingDay: d(2026, 11, 30) };
  const andi = { caseId: "andi00000001", name: "Andi Pratama", status: "PKWTT", lastWorkingDay: d(2026, 12, 15) };

  it("Monday 16 Nov: two newcomers (one late), both leavers twice, no payment, no monthly list", () => {
    const rows = buildBpjsRows(base(d(2026, 11, 16), { newcomers: [dewi, rudi], leavers: [siti, andi] }));
    const byKey = Object.fromEntries(rows.map((r) => [r.bpjsTaskKey, r]));
    expect(rows).toHaveLength(2 + 4);
    expect(byKey["REGISTER_NEW:dewi00000001"].statusLabel).toBe("Terlambat 4 hari");
    expect(byKey["REGISTER_NEW:dewi00000001"].severity).toBe("rose");
    expect(byKey["REGISTER_NEW:rudi00000001"].statusLabel).toBe("Sisa 2 hari");
    expect(byKey["REGISTER_NEW:rudi00000001"].severity).toBe("amber");
    expect(byKey["DEACTIVATE_KES:siti00000001"].severity).toBe("amber");
    expect(byKey["DEACTIVATE_TK:siti00000001"].severity).toBe("slate");
    expect(byKey["DEACTIVATE_KES:andi00000001"].severity).toBe("slate");
    expect(rows.every((r) => r.kind === "bp")).toBe(true);
  });

  it("Monday 7 Dec: both payments tomorrow, Siti's TK is 2 days late", () => {
    const rows = buildBpjsRows(base(d(2026, 12, 7), { leavers: [siti], done: new Set(["DEACTIVATE_KES:siti00000001", "MONTHLY_LIST:2026-12"]) }));
    const byKey = Object.fromEntries(rows.map((r) => [r.bpjsTaskKey, r]));
    expect(rows).toHaveLength(3);
    expect(byKey["PAY_KES:2026-12"].statusLabel).toBe("Besok");
    expect(byKey["PAY_TK:2026-12"].statusLabel).toBe("Besok");
    expect(byKey["DEACTIVATE_TK:siti00000001"].statusLabel).toBe("Terlambat 2 hari");
  });

  it("a reminder whose deadline is after the go-live date but not marked stays red", () => {
    const rows = buildBpjsRows(base(d(2026, 12, 7), { leavers: [siti] }));
    const kes = rows.find((r) => r.bpjsTaskKey === "DEACTIVATE_KES:siti00000001");
    expect(kes?.severity).toBe("rose");
    expect(kes?.statusLabel).toBe("Terlambat 19 hari");
  });

  it("payment: not before the 5th, from the 5th, last month's unmarked one stays red", () => {
    const november = ["PAY_KES:2026-11", "PAY_TK:2026-11"];
    const keys = (today: Date, done: string[] = []) => buildBpjsRows(base(today, { done: new Set([...november, ...done]) })).map((r) => r.bpjsTaskKey).filter((k) => k?.startsWith("PAY"));
    expect(keys(d(2026, 12, 4))).toEqual([]);
    expect(keys(d(2026, 12, 5))).toEqual(["PAY_KES:2026-12", "PAY_TK:2026-12"]);
    expect(keys(d(2026, 12, 9))).toEqual(["PAY_KES:2026-12", "PAY_TK:2026-12"]);
    expect(keys(d(2026, 12, 9), ["PAY_KES:2026-12"])).toEqual(["PAY_TK:2026-12"]);
    expect(keys(d(2027, 1, 3), ["PAY_KES:2026-12", "PAY_TK:2026-12"])).toEqual([]);
    expect(keys(d(2027, 1, 3), ["PAY_KES:2026-12"])).toEqual(["PAY_TK:2026-12"]);
    // November was never marked: it stays red after its due date
    const rows = buildBpjsRows({ today: d(2026, 11, 20), newcomers: [], missingStartDate: 0, leavers: [], activeListSize: 81, done: new Set() }).filter((r) => r.bpjsTaskKey?.startsWith("PAY"));
    expect(rows.map((r) => r.bpjsTaskKey)).toEqual(["PAY_KES:2026-11", "PAY_TK:2026-11"]);
    expect(rows[0].severity).toBe("rose");
  });

  it("nothing from before the go-live date is shown (no October payment, no October newcomer)", () => {
    const old = { id: "old000000001", name: "Lama", status: "Magang", startDate: d(2026, 10, 10) };
    const rows = buildBpjsRows(base(d(2026, 11, 2), { newcomers: [old] }));
    expect(rows).toEqual([]);
  });

  it("a newcomer who has not started yet is not shown; a marked one disappears", () => {
    const future = { id: "future000001", name: "Baru", status: "Magang", startDate: d(2026, 11, 20) };
    expect(buildBpjsRows(base(d(2026, 11, 16), { newcomers: [future] }))).toEqual([]);
    expect(buildBpjsRows(base(d(2026, 11, 16), { newcomers: [dewi], done: new Set(["REGISTER_NEW:dewi00000001"]) }))).toEqual([]);
  });

  it("monthly list: not before the 25th, then for next month, with a link and no Sudah button", () => {
    expect(buildBpjsRows(base(d(2026, 11, 24)))).toEqual([]);
    const rows = buildBpjsRows(base(d(2026, 11, 25)));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toContain("Desember");
    expect(rows[0].href).toBe("/bpjs?bulan=2026-12");
    expect(rows[0].bpjsTaskKey).toBeUndefined();
    expect(rows[0].severity).toBe("slate");
    expect(buildBpjsRows(base(d(2026, 11, 28)))[0].severity).toBe("amber");
  });

  it("monthly list: once marked it is gone; unmarked after the 1st it is red", () => {
    expect(buildBpjsRows(base(d(2026, 11, 26), { done: new Set(["MONTHLY_LIST:2026-12"]) }))).toEqual([]);
    const late = buildBpjsRows(base(d(2026, 12, 3)));
    expect(late.some((r) => r.title.includes("Desember") && r.severity === "rose")).toBe(true);
  });

  it("people without a start date become one quiet row", () => {
    const rows = buildBpjsRows(base(d(2026, 11, 16), { missingStartDate: 63 }));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("63 harian lepas dan magang belum ada tanggal masuk");
    expect(rows[0].severity).toBe("slate");
    expect(rows[0].href).toBe("/bpjs#tanggal-masuk");
  });
});

describe("buildBpjsListSheet", () => {
  it("numbers the rows and keeps NIK as text", () => {
    const sheet = buildBpjsListSheet([
      { name: "Dewi", status: "Harian lepas", section: "CNC", nik: "3201010101010001", birthDate: d(2003, 3, 12), bpjsTkNumber: null },
      { name: "Rudi", status: "Magang", section: "—", nik: null, birthDate: null, bpjsTkNumber: "123" },
    ]);
    expect(sheet[0]).toHaveLength(7);
    expect(sheet[1]).toEqual([1, "Dewi", "Harian lepas", "CNC", "3201010101010001", "2003-03-12", ""]);
    expect(sheet[2]).toEqual([2, "Rudi", "Magang", "—", "", "", "123"]);
  });
});
