import { describe, expect, it } from "vitest";
import { cancelEmail, cancelledLabel, cancelNoticeVisible, cancelProblem, canCancelInterview, closeReasonText, type CancelState } from "./interview-cancel";

const open: CancelState = { candidateStatus: "INTERVIEWING", interviewDecision: null, hasInterview: true, alreadyCancelled: false, submittedInterviewers: 0 };
const now = new Date("2026-11-04T08:00:00Z");
const later = new Date("2026-11-05T03:00:00Z");
const earlier = new Date("2026-11-03T03:00:00Z");

describe("canCancelInterview", () => {
  it("only while scheduled and nobody has assessed", () => {
    expect(canCancelInterview(open)).toBe(true);
    expect(canCancelInterview({ ...open, hasInterview: false })).toBe(false);
    expect(canCancelInterview({ ...open, alreadyCancelled: true })).toBe(false);
    expect(canCancelInterview({ ...open, submittedInterviewers: 1 })).toBe(false);
    expect(canCancelInterview({ ...open, candidateStatus: "OFFERING" })).toBe(false);
    expect(canCancelInterview({ ...open, candidateStatus: "WITHDRAWN" })).toBe(false);
    expect(canCancelInterview({ ...open, interviewDecision: "ACCEPTED" })).toBe(false);
  });
});

describe("cancelProblem", () => {
  const ok = { kind: "WITHDREW", note: "Mengabari lewat WhatsApp" };
  it("accepts a withdrawal before the interview", () => expect(cancelProblem(open, ok, later, now)).toBeNull());
  it("accepts a no-show after the time passed", () => expect(cancelProblem(open, { kind: "NO_SHOW", note: "Tidak muncul" }, earlier, now)).toBeNull());
  it("a no-show before the time is refused", () => expect(cancelProblem(open, { kind: "NO_SHOW", note: "Tidak muncul" }, later, now)).toContain("belum lewat"));
  it("needs a kind and a note", () => {
    expect(cancelProblem(open, { kind: "", note: "x yz" }, later, now)).toContain("Pilih");
    expect(cancelProblem(open, { kind: "WITHDREW", note: "  " }, later, now)).toContain("Catatan");
    expect(cancelProblem(open, { kind: "OTHER", note: "abc" }, later, now)).toContain("Pilih");
  });
  it("refuses when no interview, cancelled already, wrong stage or already assessed", () => {
    expect(cancelProblem({ ...open, hasInterview: false }, ok, null, now)).toContain("belum punya jadwal");
    expect(cancelProblem({ ...open, alreadyCancelled: true }, ok, later, now)).toContain("sudah dibatalkan");
    expect(cancelProblem({ ...open, candidateStatus: "REJECTED" }, ok, later, now)).toContain("tahap interview");
    expect(cancelProblem({ ...open, submittedInterviewers: 2 }, ok, later, now)).toContain("Akhiri proses");
  });
});

describe("texts", () => {
  it("close reason joins kind, quick reason and note", () => {
    expect(closeReasonText("WITHDREW", "Alasan pribadi / keluarga", "Mengabari lewat WhatsApp")).toBe("Mengundurkan diri sebelum interview: Alasan pribadi / keluarga: Mengabari lewat WhatsApp");
    expect(closeReasonText("NO_SHOW", null, " tidak muncul ")).toBe("Tidak datang, tanpa kabar sebelum interview: tidak muncul");
  });
  it("e-mail names the applicant, the slot and why", () => {
    const m = cancelEmail({ candidateName: "Dewi", positionTitle: "Operator", tanggal: "Kamis, 5 November 2026", jam: "10.00 WIB", kind: "WITHDREW" });
    expect(m.subject).toBe("Interview dibatalkan (SAPA)");
    expect(m.text).toContain("Dewi");
    expect(m.text).toContain("pelamar mengundurkan diri");
    expect(cancelEmail({ candidateName: "D", positionTitle: "O", tanggal: "t", jam: "j", kind: "NO_SHOW" }).text).toContain("pelamar tidak datang");
  });
  it("the cancelled row stays 7 days for the interviewer", () => {
    expect(cancelNoticeVisible(new Date("2026-10-30T00:00:00Z"), now)).toBe(true);
    expect(cancelNoticeVisible(new Date("2026-10-28T00:00:00Z"), now)).toBe(false);
    expect(cancelNoticeVisible(null, now)).toBe(false);
  });
  it("label", () => {
    expect(cancelledLabel("NO_SHOW")).toBe("Pelamar tidak datang");
    expect(cancelledLabel("WITHDREW")).toBe("Pelamar mengundurkan diri");
  });
});
