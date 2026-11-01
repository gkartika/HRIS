import { describe, expect, it } from "vitest";
import {
  addMonthsUtc,
  approversText,
  canCancel,
  canEdit,
  currentStep,
  disciplineValidUntil,
  extraWorkAmountProblem,
  formatAmount,
  formatFormNumber,
  hoursBetween,
  kindFromPath,
  leaveTimesProblem,
  parseAmount,
  parseClock,
  statusLine,
  suggestedDisciplineKind,
} from "./production-forms";
import { buildExtraWorkSheet, buildLeaveWorkSheet } from "./production-forms-export";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("form numbers and paths", () => {
  it("builds TJK, IMP and SP numbers and finds a form kind from its path", () => {
    expect(formatFormNumber("EXTRA_WORK", 2026, 7)).toBe("TJK-2026-0007");
    expect(formatFormNumber("LEAVE_WORK", 2026, 11)).toBe("IMP-2026-0011");
    expect(formatFormNumber("DISCIPLINE", 2026, 123)).toBe("SP-2026-0123");
    expect(kindFromPath("extra-work")).toBe("EXTRA_WORK");
    expect(kindFromPath("leave-work")).toBe("LEAVE_WORK");
    expect(kindFromPath("discipline")).toBe("DISCIPLINE");
    expect(kindFromPath("lembur")).toBeNull();
  });
});

describe("Surat Peringatan validity", () => {
  it("is 6 months from the day it was handed over, clamped to a shorter month", () => {
    expect(disciplineValidUntil(d("2026-11-03"))).toEqual(d("2027-05-03"));
    expect(addMonthsUtc(d("2026-08-31"), 6)).toEqual(d("2027-02-28"));
    expect(addMonthsUtc(d("2026-10-31"), 4)).toEqual(d("2027-02-28"));
    expect(addMonthsUtc(d("2026-07-12"), 6)).toEqual(d("2027-01-12"));
  });

  it("suggests the next step above the highest warning still valid", () => {
    expect(suggestedDisciplineKind([])).toBe("WARNING");
    expect(suggestedDisciplineKind(["WARNING"])).toBe("SP1");
    expect(suggestedDisciplineKind(["SP1"])).toBe("SP2");
    expect(suggestedDisciplineKind(["WARNING", "SP2"])).toBe("SP3");
    expect(suggestedDisciplineKind(["SP3"])).toBe("SP3");
  });
});

describe("times and amounts", () => {
  it("reads clock times typed with a dot or a colon", () => {
    expect(parseClock("16.00")).toBe(960);
    expect(parseClock("16:30")).toBe(990);
    expect(parseClock("8:5")).toBe(485);
    expect(parseClock("24.00")).toBeNull();
    expect(parseClock("16.60")).toBeNull();
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("")).toBeNull();
  });

  it("works out the hours between start and end, also past midnight", () => {
    expect(hoursBetween("16.00", "20.30")).toBe(4.5);
    expect(hoursBetween("16.00", "18.00")).toBe(2);
    expect(hoursBetween("22.00", "02.00")).toBe(4);
    expect(hoursBetween("16.00", "x")).toBeNull();
  });

  it("reads amounts with a decimal comma or point and refuses anything else", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("2")).toBe(2);
    expect(parseAmount("0.25")).toBe(0.25);
    expect(parseAmount("1,555")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(3)).toBe(3);
  });

  it("hours need at least 1 (fractions fine), workdays more than 0", () => {
    expect(extraWorkAmountProblem("HOURS", 0.5)).toBe("Minimal 1 jam.");
    expect(extraWorkAmountProblem("HOURS", 1)).toBeNull();
    expect(extraWorkAmountProblem("HOURS", 1.5)).toBeNull();
    expect(extraWorkAmountProblem("HOURS", 25)).toMatch(/Paling banyak 24 jam/);
    expect(extraWorkAmountProblem("HOURS", null)).toMatch(/angka/);
    expect(extraWorkAmountProblem("WORKDAYS", 0)).toMatch(/lebih dari 0/);
    expect(extraWorkAmountProblem("WORKDAYS", 1)).toBeNull();
    expect(extraWorkAmountProblem("WORKDAYS", 0.5)).toBeNull();
    expect(extraWorkAmountProblem("WORKDAYS", 32)).toMatch(/Paling banyak 31/);
  });

  it("izin times: leave time required, return time optional and after the leave time", () => {
    expect(leaveTimesProblem("10.30", "14.00")).toBeNull();
    expect(leaveTimesProblem("10.30", null)).toBeNull();
    expect(leaveTimesProblem("10.30", "")).toBeNull();
    expect(leaveTimesProblem("", null)).toMatch(/jam keluar/);
    expect(leaveTimesProblem("10.30", "09.00")).toMatch(/sesudah/);
    expect(leaveTimesProblem("10.30", "xx")).toMatch(/tidak valid/);
  });

  it("shows amounts with a decimal comma", () => {
    expect(formatAmount(4.5, "HOURS")).toBe("4,5 jam");
    expect(formatAmount(2, "HOURS")).toBe("2 jam");
    expect(formatAmount(1, "WORKDAYS")).toBe("1 hari kerja");
  });
});

describe("status", () => {
  const now = new Date("2026-11-02T05:00:00Z");
  const base = { submittedAt: new Date("2026-11-01T05:00:00Z"), leaderDecidedAt: new Date("2026-10-31T05:00:00Z"), leaderDecidedByName: "Riswanto" };

  it("steps follow the status and a rejected or cancelled form has no stepper", () => {
    expect(currentStep("DRAFT")).toBe(0);
    expect(currentStep("RETURNED")).toBe(0);
    expect(currentStep("SUBMITTED")).toBe(1);
    expect(currentStep("LEADER_APPROVED")).toBe(2);
    expect(currentStep("COMPLETED")).toBe(4);
    expect(currentStep("REJECTED")).toBe(-1);
    expect(currentStep("CANCELLED")).toBe(-1);
  });

  it("a form is editable while draft or returned and can be withdrawn until it is completed", () => {
    expect(canEdit("DRAFT")).toBe(true);
    expect(canEdit("RETURNED")).toBe(true);
    expect(canEdit("SUBMITTED")).toBe(false);
    for (const s of ["DRAFT", "RETURNED", "SUBMITTED", "LEADER_APPROVED"] as const) expect(canCancel(s)).toBe(true);
    for (const s of ["COMPLETED", "REJECTED", "CANCELLED"] as const) expect(canCancel(s)).toBe(false);
  });

  it("says in plain words who is holding the form", () => {
    const approvers = [{ name: "Riswanto", level: "3A" }, { name: "Suhartono", level: "3B" }];
    expect(approversText(approvers)).toBe("Riswanto (3A) atau Suhartono (3B)");
    expect(approversText([])).toBe("belum ada yang bisa menyetujui");
    expect(statusLine("EXTRA_WORK", { ...base, status: "SUBMITTED" }, approvers, now)).toBe("Menunggu Riswanto (3A) atau Suhartono (3B) · sejak kemarin");
    expect(statusLine("EXTRA_WORK", { ...base, status: "LEADER_APPROVED" }, approvers, now)).toBe("Disetujui Riswanto. Menunggu Admin SDM (persetujuan payroll) · sejak 2 hari");
    expect(statusLine("LEAVE_WORK", { ...base, status: "LEADER_APPROVED" }, approvers, now)).toContain("Menunggu keputusan Admin SDM");
    expect(statusLine("DISCIPLINE", { ...base, status: "LEADER_APPROVED" }, approvers, now)).toContain("menyerahkan ke karyawan");
    expect(statusLine("DISCIPLINE", { ...base, status: "COMPLETED" }, approvers, now)).toBe("Sudah diserahkan ke karyawan");
    expect(statusLine("EXTRA_WORK", { ...base, status: "DRAFT" }, approvers, now)).toBe("Draf, belum diajukan");
  });
});

describe("payroll Excel sheets", () => {
  const work = {
    requestNumber: "TJK-2026-0007",
    workDate: d("2026-11-02"),
    employeeNumber: "CBP-0001",
    employeeName: "Agus Setiawan",
    unit: "HOURS" as const,
    startTime: "16.00",
    endTime: "20.30",
    reason: "Mengejar target",
    approvedBy: "Riswanto (3A)",
    note: null,
  };

  it("pays the final amount when Admin SDM changed it, the requested amount otherwise, as plain numbers", () => {
    const sheet = buildExtraWorkSheet([{ ...work, requested: 4.5, final: null }, { ...work, employeeName: "Dedi", requested: 4, final: 3.5, note: "Absensi pulang 19.30" }]);
    expect(sheet[0]).toContain("Jumlah dibayar");
    expect(sheet[1]).toEqual(["TJK-2026-0007", "2026-11-02", "CBP-0001", "Agus Setiawan", "Jam", 4.5, 4.5, "16.00", "20.30", "Mengejar target", "Riswanto (3A)", ""]);
    expect(sheet[2][5]).toBe(4);
    expect(sheet[2][6]).toBe(3.5);
    expect(sheet[2][11]).toBe("Absensi pulang 19.30");
    expect(buildExtraWorkSheet([])).toHaveLength(1);
    expect(buildExtraWorkSheet([{ ...work, unit: "WORKDAYS", requested: 1, final: null }])[1][4]).toBe("Hari kerja");
  });

  it("izin rows carry the decision and the absence code it was written as", () => {
    const row = { requestNumber: "IMP-2026-0011", workDate: d("2026-11-02"), employeeNumber: "CBP-0002", employeeName: "Budi", leaveTime: "10.30", returnTime: "14.00", reason: "KTP", approvedBy: "Suhartono (3B)", note: null };
    expect(buildLeaveWorkSheet([{ ...row, decision: "HALF_DAY" }])[1]).toEqual(["IMP-2026-0011", "2026-11-02", "CBP-0002", "Budi", "10.30", "14.00", "Setengah hari", "SH", "KTP", "Suhartono (3B)", ""]);
    const full = buildLeaveWorkSheet([{ ...row, returnTime: null, decision: "FULL_DAY" }])[1];
    expect(full[5]).toBe("tidak kembali");
    expect(full[6]).toBe("Satu hari penuh");
    expect(full[7]).toBe("I");
  });
});
