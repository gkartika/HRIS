import { describe, expect, it } from "vitest";
import {
  candidateMilestones,
  computeDashboard,
  monthsBetween,
  parseDashboardFilters,
  rangeForFilters,
  type DashboardCandidate,
  type DashboardRequest,
} from "./recruitment-dashboard";

const d = (s: string) => new Date(`${s}T03:00:00Z`);

function candidate(over: Partial<DashboardCandidate> = {}): DashboardCandidate {
  return {
    id: "c1",
    source: "EXTERNAL",
    status: "TESTING",
    appliedAt: d("2026-03-01"),
    statusChangedAt: d("2026-03-01"),
    decidedAt: null,
    departmentId: "dep1",
    interviewInvitedAt: null,
    hasOffer: false,
    hasMovement: false,
    tests: [],
    ...over,
  };
}

describe("candidateMilestones", () => {
  it("a new applicant only reached the first stage", () => {
    expect(candidateMilestones(candidate({ tests: [{ passed: null, doneAt: null }] })).stage).toBe(1);
  });

  it("passing every test is stage 2, dated by the last test", () => {
    const m = candidateMilestones(
      candidate({ status: "TEST_PASSED", tests: [{ passed: true, doneAt: d("2026-03-02") }, { passed: true, doneAt: d("2026-03-04") }] })
    );
    expect(m.stage).toBe(2);
    expect(m.passedAt).toEqual(d("2026-03-04"));
  });

  it("one failed test is not a pass", () => {
    expect(candidateMilestones(candidate({ status: "TEST_FAILED", tests: [{ passed: true, doneAt: d("2026-03-02") }, { passed: false, doneAt: d("2026-03-03") }] })).stage).toBe(1);
  });

  it("an interview counts the applicant as passed too (cumulative)", () => {
    const m = candidateMilestones(candidate({ status: "INTERVIEWING", interviewInvitedAt: d("2026-03-10"), tests: [{ passed: true, doneAt: d("2026-03-02") }] }));
    expect(m.stage).toBe(3);
    expect(m.invitedAt).toEqual(d("2026-03-10"));
    expect(m.passedAt).toEqual(d("2026-03-02"));
  });

  it("decision made = interview finished; offer/movement = stage 5; hired = 6 with the hire date", () => {
    expect(candidateMilestones(candidate({ interviewInvitedAt: d("2026-03-10"), decidedAt: d("2026-03-12") })).stage).toBe(4);
    expect(candidateMilestones(candidate({ status: "OFFERING", hasOffer: true })).stage).toBe(5);
    expect(candidateMilestones(candidate({ status: "MOVEMENT", hasMovement: true })).stage).toBe(5);
    const hired = candidateMilestones(candidate({ status: "HIRED", statusChangedAt: d("2026-04-01") }));
    expect(hired.stage).toBe(6);
    expect(hired.hiredAt).toEqual(d("2026-04-01"));
  });
});

describe("computeDashboard", () => {
  const range = { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-06-30T23:59:59Z") };
  const now = new Date("2026-06-30T10:00:00Z");

  const candidates: DashboardCandidate[] = [
    candidate({ id: "a", status: "HIRED", appliedAt: d("2026-03-01"), statusChangedAt: d("2026-03-31"), tests: [{ passed: true, doneAt: d("2026-03-03") }], interviewInvitedAt: d("2026-03-10"), decidedAt: d("2026-03-15"), hasOffer: true }),
    candidate({ id: "b", status: "TEST_FAILED", appliedAt: d("2026-03-05"), statusChangedAt: d("2026-03-06"), tests: [{ passed: false, doneAt: d("2026-03-06") }] }),
    candidate({ id: "c", status: "TEST_PASSED", appliedAt: d("2026-04-02"), statusChangedAt: d("2026-04-04"), tests: [{ passed: true, doneAt: d("2026-04-04") }] }),
    // Applied before the period, hired inside it: counts for Time to Hire, not as an applicant.
    candidate({ id: "e", source: "INTERNAL", status: "HIRED", appliedAt: d("2025-12-20"), statusChangedAt: d("2026-01-09"), hasMovement: true, departmentId: "dep2" }),
  ];
  const requests: DashboardRequest[] = [
    { id: "r1", departmentId: "dep1", status: "FILLED", approvedAt: d("2026-02-01"), filledAt: d("2026-03-03") },
    { id: "r2", departmentId: "dep1", status: "RECRUITMENT_IN_PROGRESS", approvedAt: d("2026-05-01"), filledAt: null },
    { id: "r3", departmentId: "dep2", status: "FILLED", approvedAt: d("2025-11-01"), filledAt: d("2025-12-01") },
  ];

  const result = computeDashboard({ candidates, requests, range, now });

  it("Time to Fill counts only requests filled inside the period", () => {
    expect(result.timeToFill).toEqual({ days: 30, filled: 1 });
  });

  it("Time to Hire uses the hire date inside the period, whenever the person applied", () => {
    // a: 1 Mar -> 31 Mar = 30 days; e: 20 Dec -> 9 Jan = 20 days
    expect(result.timeToHire).toEqual({ days: 25, hired: 2 });
  });

  it("Hiring Rate = hired among applicants of the period", () => {
    expect(result.hiringRate).toEqual({ percent: 33.3, hired: 1, applicants: 3 });
  });

  it("funnel is cumulative with conversion from the previous stage", () => {
    expect(result.funnel.map((s) => s.count)).toEqual([3, 2, 1, 1, 1, 1]);
    expect(result.funnel[1].fromPrevious).toBe(66.7);
    expect(result.funnel[0].fromPrevious).toBeNull();
  });

  it("trend places each count in the month of its own date", () => {
    const march = result.trend.find((m) => m.key === "2026-03");
    expect(march).toMatchObject({ applied: 2, passed: 1, hired: 1 });
    expect(result.trend.find((m) => m.key === "2026-01")).toMatchObject({ applied: 0, hired: 1 });
    expect(result.trend[0].key).toBe("2026-01");
    expect(result.trend.at(-1)?.key).toBe("2026-06");
  });

  it("per department rows", () => {
    const dep1 = result.rows.find((r) => r.departmentId === "dep1");
    expect(dep1).toMatchObject({ openings: 2, applicants: 3, passed: 2, hired: 1, hiringRate: 33.3, timeToFill: 30, timeToHire: 30 });
    const dep2 = result.rows.find((r) => r.departmentId === "dep2");
    expect(dep2).toMatchObject({ openings: 0, applicants: 0, hired: 0, hiringRate: null, timeToFill: null, timeToHire: 20 });
  });

  it("splits external and internal", () => {
    expect(result.bySource).toEqual([
      { source: "EXTERNAL", applicants: 3, hired: 1 },
      { source: "INTERNAL", applicants: 0, hired: 1 },
    ]);
  });

  it("is quiet when there is nothing", () => {
    const empty = computeDashboard({ candidates: [], requests: [], range, now });
    expect(empty.timeToFill.days).toBeNull();
    expect(empty.hiringRate.percent).toBeNull();
    expect(empty.funnel.every((s) => s.count === 0)).toBe(true);
  });
});

describe("filters", () => {
  const levels = ["STAFF_OPERATOR", "SUPERVISOR"];

  it("falls back to safe defaults", () => {
    expect(parseDashboardFilters({ period: "nope", level: "BOSS", source: "x", from: "31/12/2026" }, levels)).toEqual({
      departmentId: null,
      level: null,
      source: null,
      period: "12m",
      fromText: "",
      toText: "",
    });
    expect(parseDashboardFilters({ level: "SUPERVISOR", source: "INTERNAL", dept: "d1" }, levels)).toMatchObject({ level: "SUPERVISOR", source: "INTERNAL", departmentId: "d1" });
  });

  it("presets run up to now; all time is open", () => {
    const now = new Date("2026-10-20T05:00:00Z");
    const six = rangeForFilters(parseDashboardFilters({ period: "6m" }, levels), now).range;
    expect(six.from).toEqual(new Date("2026-04-19T17:00:00Z")); // 20 Apr 00:00 WIB
    expect(six.to).toEqual(now);
    expect(rangeForFilters(parseDashboardFilters({ period: "all" }, levels), now).range).toEqual({ from: null, to: null });
    expect(rangeForFilters(parseDashboardFilters({ period: "year" }, levels), now).range.from).toEqual(new Date("2025-12-31T17:00:00Z"));
  });

  it("custom range covers the whole last day, and bad input gives a message", () => {
    const now = new Date("2026-10-20T05:00:00Z");
    const ok = rangeForFilters(parseDashboardFilters({ period: "custom", from: "2026-01-01", to: "2026-01-31" }, levels), now);
    expect(ok.error).toBeNull();
    expect(ok.range.from).toEqual(new Date("2025-12-31T17:00:00Z"));
    expect(ok.range.to).toEqual(new Date("2026-01-31T16:59:59.999Z"));
    expect(rangeForFilters(parseDashboardFilters({ period: "custom" }, levels), now).error).toBeTruthy();
    expect(rangeForFilters(parseDashboardFilters({ period: "custom", from: "2026-02-01", to: "2026-01-01" }, levels), now).error).toBeTruthy();
    expect(rangeForFilters(parseDashboardFilters({ period: "custom", from: "2026-02-31" }, levels), now).error).toBeTruthy();
  });

  it("lists every month between two dates", () => {
    expect(monthsBetween(new Date("2025-11-15T00:00:00Z"), new Date("2026-02-02T00:00:00Z"))).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
