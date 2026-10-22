// Prisma-backed steps after the tests: essay review, interview, final decision, offering
// letter, and the hooks that finish an applicant when the employee is created or an
// internal move is carried out.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/account-tokens";
import { appBaseUrl, sendMail } from "@/lib/mailer";
import { randomStorageKey } from "@/lib/file-storage";
import { nextStatusAfterFulfillment, computeFulfillmentCounts } from "@/lib/recruitment";
import { HELD_MESSAGE } from "@/lib/recruitment-request-changes";
import { fillTemplate, isValidSignatureDataUrl, fileExtension, validateOfferFile } from "@/lib/recruitment-candidates";
import { FULFILLABLE_STATUSES, getRecruitmentSettings, refreshCandidateStatus, setCandidateStatus, type EngineResult } from "@/lib/recruitment-service";
import type { Prisma } from "@/generated/prisma/client";
import type {
  RecruitmentInterviewDecision,
  RecruitmentInterviewMode,
  RecruitmentOfferResponse,
} from "@/generated/prisma/enums";

export const OFFER_VALID_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- email ----------

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function htmlBody(text: string, link?: { url: string; label: string }): string {
  const paragraphs = text
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = link
    ? `<p><a href="${link.url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(link.label)}</a></p><p style="color:#5d647d;font-size:12px">Atau salin tautan ini: ${link.url}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1c2033">${paragraphs}${button}</div>`;
}

// Sending can fail (no mail account configured, bad address). That must never undo the
// step that was just saved, so callers get true/false and tell the user.
export async function trySend(to: string | null | undefined, subject: string, text: string, link?: { url: string; label: string }): Promise<boolean> {
  if (!to) return false;
  try {
    await sendMail({ to, subject, text: link ? `${text}\n\n${link.url}` : text, html: htmlBody(text, link) });
    return true;
  } catch (error) {
    console.error("[recruitment] email failed", error);
    return false;
  }
}

export async function emailOfEmployee(employeeId: string): Promise<string | null> {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { personalEmail: true, account: { select: { usernameOrEmail: true } } },
  });
  if (!e) return null;
  const login = e.account?.usernameOrEmail;
  return e.personalEmail?.trim() || (login && login.includes("@") ? login : null);
}

async function mailEmployee(employeeId: string, subject: string, text: string, link?: { url: string; label: string }) {
  return trySend(await emailOfEmployee(employeeId), subject, text, link);
}

// People who can be picked as reviewer or interviewer: active employees with a working login.
export async function listSelectableStaff() {
  return prisma.employee.findMany({
    where: { activeFlag: true, account: { is: { accountStatus: "ACTIVE" } } },
    select: { id: true, fullLegalName: true, employeeNumber: true, currentPosition: { select: { job: { select: { jobTitle: true } } } } },
    orderBy: { fullLegalName: "asc" },
  });
}

// ---------- essay review ----------

export async function setTestReviewers(testId: string, employeeIds: string[], accountId: string): Promise<EngineResult & { notified?: number }> {
  const test = await prisma.recruitmentCandidateTest.findUnique({
    where: { id: testId },
    select: {
      status: true,
      passed: true,
      testType: { select: { form: true, name: true } },
      candidate: { select: { id: true, fullName: true, status: true } },
      reviewers: { select: { employeeId: true } },
    },
  });
  if (!test) return { ok: false, error: "Tes tidak ditemukan." };
  if (test.testType.form !== "ESSAY") return { ok: false, error: "Hanya tes esai yang ditinjau reviewer." };
  if (test.status !== "SUBMITTED" || test.passed !== null) return { ok: false, error: "Tes ini tidak sedang menunggu review." };
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return { ok: false, error: "Pilih minimal satu reviewer." };
  const staff = await prisma.employee.count({ where: { id: { in: ids }, activeFlag: true, account: { is: { accountStatus: "ACTIVE" } } } });
  if (staff !== ids.length) return { ok: false, error: "Reviewer harus karyawan aktif yang punya akun login." };

  const existing = new Set(test.reviewers.map((r) => r.employeeId));
  const added = ids.filter((id) => !existing.has(id));
  await prisma.$transaction([
    prisma.recruitmentTestReviewer.deleteMany({ where: { candidateTestId: testId, employeeId: { notIn: ids } } }),
    ...added.map((employeeId) =>
      prisma.recruitmentTestReviewer.create({ data: { candidateTestId: testId, employeeId, grantedByAccountId: accountId } })
    ),
  ]);
  let notified = 0;
  for (const employeeId of added) {
    const ok = await mailEmployee(
      employeeId,
      "Tugas review jawaban tes (SAPA)",
      `Anda diminta HR membaca dan menilai jawaban ${test.testType.name} dari pelamar ${test.candidate.fullName}. Buka SAPA, menu Tugas Rekrutmen.`,
      { url: `${appBaseUrl()}/recruitment/review/${testId}`, label: "Buka jawaban" }
    );
    if (ok) notified++;
  }
  return { ok: true, notified };
}

export async function reviewEssayTest(
  testId: string,
  reviewerEmployeeId: string,
  passed: boolean,
  note: string
): Promise<EngineResult> {
  const test = await prisma.recruitmentCandidateTest.findUnique({
    where: { id: testId },
    select: { status: true, passed: true, candidateId: true, reviewers: { select: { employeeId: true } } },
  });
  if (!test || !test.reviewers.some((r) => r.employeeId === reviewerEmployeeId)) {
    return { ok: false, error: "Anda tidak ditunjuk untuk menilai tes ini." };
  }
  if (test.status !== "SUBMITTED" || test.passed !== null) return { ok: false, error: "Tes ini sudah dinilai." };
  const trimmed = note.trim();
  if (!passed && !trimmed) return { ok: false, error: "Catatan wajib diisi jika menetapkan Tidak Lulus." };
  const res = await prisma.recruitmentCandidateTest.updateMany({
    where: { id: testId, passed: null },
    data: { passed, reviewNote: trimmed || null, reviewedAt: new Date(), reviewedByEmployeeId: reviewerEmployeeId },
  });
  if (res.count !== 1) return { ok: false, error: "Tes ini sudah dinilai." };
  await refreshCandidateStatus(test.candidateId);
  return { ok: true };
}

// ---------- interview ----------

// "2026-10-26" + "09:00" typed in WIB.
export function wibDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function interviewMessageVars(args: { fullName: string; positionTitle: string; scheduledAt: Date; location: string }): Record<string, string> {
  return {
    nama: args.fullName,
    posisi: args.positionTitle,
    tanggal: args.scheduledAt.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    jam: `${args.scheduledAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".")} WIB`,
    lokasi: args.location,
  };
}

export async function scheduleInterview(args: {
  candidateId: string;
  scheduledAt: Date;
  mode: RecruitmentInterviewMode;
  location: string;
  employeeIds: string[];
  accountId: string;
}): Promise<EngineResult & { interviewId?: string; emailedCandidate?: boolean; emailedInterviewers?: number }> {
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: args.candidateId },
    include: {
      request: { select: { heldAt: true, job: { select: { jobTitle: true } } } },
      interview: { include: { interviewers: true } },
    },
  });
  if (!candidate) return { ok: false, error: "Pelamar tidak ditemukan." };
  if (candidate.request.heldAt) return { ok: false, error: HELD_MESSAGE };
  if (candidate.status !== "TEST_PASSED" && !(candidate.status === "INTERVIEWING" && !candidate.interviewDecision)) {
    return { ok: false, error: "Pelamar ini belum bisa dijadwalkan interview." };
  }
  const location = args.location.trim();
  if (!location) return { ok: false, error: "Isi lokasi atau tautan meeting." };
  const settings = await getRecruitmentSettings();
  const ids = [...new Set(args.employeeIds)];
  if (ids.length < 1 || ids.length > settings.maxInterviewers) {
    return { ok: false, error: `Pilih 1 sampai ${settings.maxInterviewers} pewawancara.` };
  }
  if (candidate.employeeId && ids.includes(candidate.employeeId)) return { ok: false, error: "Pelamar tidak bisa mewawancarai dirinya sendiri." };
  const staff = await prisma.employee.count({ where: { id: { in: ids }, activeFlag: true, account: { is: { accountStatus: "ACTIVE" } } } });
  if (staff !== ids.length) return { ok: false, error: "Pewawancara harus karyawan aktif yang punya akun login." };

  const current = candidate.interview?.interviewers ?? [];
  const removedSubmitted = current.filter((i) => !ids.includes(i.employeeId) && i.submittedAt);
  if (removedSubmitted.length > 0) return { ok: false, error: "Pewawancara yang sudah mengisi penilaian tidak bisa dihapus." };
  const existingIds = new Set(current.map((i) => i.employeeId));
  const added = ids.filter((id) => !existingIds.has(id));

  const interviewId = await prisma.$transaction(async (tx) => {
    const interview = await tx.recruitmentInterview.upsert({
      where: { candidateId: candidate.id },
      update: { scheduledAt: args.scheduledAt, mode: args.mode, location },
      create: { candidateId: candidate.id, scheduledAt: args.scheduledAt, mode: args.mode, location, createdByAccountId: args.accountId },
    });
    await tx.recruitmentInterviewer.deleteMany({ where: { interviewId: interview.id, employeeId: { notIn: ids } } });
    for (const employeeId of added) await tx.recruitmentInterviewer.create({ data: { interviewId: interview.id, employeeId } });
    if (candidate.status !== "INTERVIEWING") await setCandidateStatus(tx, candidate.id, "INTERVIEWING");
    return interview.id;
  });

  const positionTitle = candidate.request.job?.jobTitle ?? "posisi yang dilamar";
  const vars = interviewMessageVars({ fullName: candidate.fullName, positionTitle, scheduledAt: args.scheduledAt, location });
  let emailedInterviewers = 0;
  for (const employeeId of ids) {
    const first = added.includes(employeeId);
    const ok = await mailEmployee(
      employeeId,
      first ? "Anda ditunjuk sebagai pewawancara (SAPA)" : "Jadwal interview diperbarui (SAPA)",
      `Interview ${candidate.fullName} untuk ${positionTitle}: ${vars.tanggal}, ${vars.jam}, ${location}. Isi penilaian Anda di SAPA setelah interview.`,
      { url: `${appBaseUrl()}/recruitment/interview/${interviewId}`, label: "Buka form penilaian" }
    );
    if (ok) emailedInterviewers++;
  }
  const emailedCandidate = await trySend(candidate.email, "Undangan interview PT CBP", fillTemplate(settings.invitationEmailTemplate, vars));
  if (emailedCandidate) await prisma.recruitmentInterview.update({ where: { id: interviewId }, data: { invitationSentAt: new Date() } });
  return { ok: true, interviewId, emailedCandidate, emailedInterviewers };
}

export async function submitInterviewerForm(args: {
  interviewerId: string;
  employeeId: string;
  scores: Record<string, number>;
  recommendation: RecruitmentInterviewDecision;
  note: string;
}): Promise<EngineResult> {
  const interviewer = await prisma.recruitmentInterviewer.findUnique({
    where: { id: args.interviewerId },
    include: { interview: { include: { candidate: { select: { status: true, interviewDecision: true } } } } },
  });
  if (!interviewer || interviewer.employeeId !== args.employeeId) return { ok: false, error: "Anda tidak ditunjuk untuk interview ini." };
  if (interviewer.submittedAt) return { ok: false, error: "Penilaian Anda sudah terkirim dan tidak bisa diubah." };
  const candidate = interviewer.interview.candidate;
  if (candidate.status !== "INTERVIEWING" || candidate.interviewDecision) return { ok: false, error: "Interview ini sudah selesai." };

  const aspects = await prisma.recruitmentInterviewAspect.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  for (const a of aspects) {
    const s = args.scores[a.id];
    if (!Number.isInteger(s) || s < 1 || s > 5) return { ok: false, error: `Beri nilai 1 sampai 5 untuk "${a.label}".` };
  }
  await prisma.$transaction([
    prisma.recruitmentInterviewScore.createMany({
      data: aspects.map((a) => ({ interviewerId: interviewer.id, aspectId: a.id, aspectLabel: a.label, score: args.scores[a.id] })),
    }),
    prisma.recruitmentInterviewer.update({
      where: { id: interviewer.id },
      data: { recommendation: args.recommendation, note: args.note.trim() || null, submittedAt: new Date() },
    }),
  ]);
  return { ok: true };
}

export async function decideCandidate(args: {
  candidateId: string;
  decision: RecruitmentInterviewDecision;
  note: string;
  accountId: string;
}): Promise<EngineResult> {
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: args.candidateId },
    include: { interview: { include: { interviewers: true } }, request: { select: { heldAt: true } } },
  });
  if (!candidate || candidate.status !== "INTERVIEWING" || !candidate.interview) return { ok: false, error: "Pelamar ini tidak sedang dalam tahap interview." };
  if (candidate.request.heldAt && args.decision !== "REJECTED") return { ok: false, error: HELD_MESSAGE };
  if (!candidate.interview.interviewers.some((i) => i.submittedAt)) {
    return { ok: false, error: "Belum ada pewawancara yang mengisi penilaian." };
  }
  const note = args.note.trim();
  if (args.decision === "REJECTED" && !note) return { ok: false, error: "Catatan wajib diisi untuk Ditolak." };

  await prisma.$transaction(async (tx) => {
    await tx.recruitmentCandidate.update({
      where: { id: candidate.id },
      data: { interviewDecision: args.decision, decisionNote: note || null, decidedAt: new Date(), decidedByAccountId: args.accountId },
    });
    if (args.decision === "REJECTED") {
      await setCandidateStatus(tx, candidate.id, "REJECTED", { closeReason: note });
    } else {
      await setCandidateStatus(tx, candidate.id, candidate.source === "EXTERNAL" ? "OFFERING" : "MOVEMENT");
    }
  });
  return { ok: true };
}

export async function saveHrInterviewNotes(
  candidateId: string,
  notes: { attendance: string; documents: string; process: string }
): Promise<EngineResult> {
  const res = await prisma.recruitmentInterview.updateMany({
    where: { candidateId },
    data: {
      hrAttendanceNote: notes.attendance.trim() || null,
      hrDocumentsNote: notes.documents.trim() || null,
      hrProcessNote: notes.process.trim() || null,
    },
  });
  return res.count === 1 ? { ok: true } : { ok: false, error: "Interview belum dijadwalkan." };
}

// HR Admin ends an applicant's process at any point before the hire.
export async function rejectCandidate(candidateId: string, reason: string): Promise<EngineResult> {
  const candidate = await prisma.recruitmentCandidate.findUnique({ where: { id: candidateId }, select: { status: true } });
  if (!candidate) return { ok: false, error: "Pelamar tidak ditemukan." };
  if (!["TESTING", "AWAITING_REVIEW", "TEST_PASSED", "INTERVIEWING", "OFFERING", "MOVEMENT"].includes(candidate.status)) {
    return { ok: false, error: "Pelamar ini sudah tidak dalam proses." };
  }
  const text = reason.trim();
  if (!text) return { ok: false, error: "Alasan wajib diisi." };
  await prisma.$transaction(async (tx) => {
    await setCandidateStatus(tx, candidateId, "REJECTED", { closeReason: text });
    // A rejected applicant's offer link stops working.
    await tx.recruitmentOffer.updateMany({ where: { candidateId, response: null }, data: { tokenHash: null } });
  });
  return { ok: true };
}

// ---------- offering letter ----------

export async function createOffer(args: {
  candidateId: string;
  file: { name: string; type: string; data: Buffer };
  signature: string;
  accountId: string;
}): Promise<EngineResult> {
  const fileError = validateOfferFile({ name: args.file.name, size: args.file.data.length, type: args.file.type });
  if (fileError) return { ok: false, error: fileError };
  if (!isValidSignatureDataUrl(args.signature)) return { ok: false, error: "Tanda tangan perusahaan belum digambar." };
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: args.candidateId },
    include: { offer: { include: { file: true } }, request: { select: { heldAt: true } } },
  });
  if (!candidate || candidate.status !== "OFFERING" || candidate.source !== "EXTERNAL") return { ok: false, error: "Pelamar ini tidak sedang di tahap offering." };
  if (candidate.request.heldAt) return { ok: false, error: HELD_MESSAGE };
  if (candidate.offer?.response) return { ok: false, error: "Offering ini sudah dijawab kandidat." };

  await prisma.$transaction(async (tx) => {
    if (candidate.offer) {
      await tx.recruitmentOffer.delete({ where: { id: candidate.offer.id } });
      await tx.recruitmentFile.delete({ where: { id: candidate.offer.fileId } });
      await tx.fileBlob.deleteMany({ where: { storageKey: candidate.offer.file.storageKey } });
    }
    const storageKey = randomStorageKey("recruitment-offer", fileExtension(args.file.name) || ".pdf");
    await tx.fileBlob.create({ data: { storageKey, data: new Uint8Array(args.file.data) } });
    const file = await tx.recruitmentFile.create({
      data: { storageKey, fileName: args.file.name.slice(0, 150), mimeType: "application/pdf", sizeBytes: args.file.data.length },
    });
    await tx.recruitmentOffer.create({
      data: {
        candidateId: candidate.id,
        fileId: file.id,
        companySignature: args.signature,
        companySignedAt: new Date(),
        companySignedByAccountId: args.accountId,
      },
    });
  });
  return { ok: true };
}

// Makes a fresh one-time link (the old one stops working) and emails it. The link is
// returned too, so HR Admin can copy it or send it by WhatsApp when email fails.
export async function sendOfferLink(candidateId: string): Promise<
  { ok: true; url: string; emailed: boolean; candidateName: string; mobileNumber: string | null } | { ok: false; error: string }
> {
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    include: { offer: true, request: { select: { heldAt: true, job: { select: { jobTitle: true } } } } },
  });
  if (!candidate || candidate.status !== "OFFERING" || !candidate.offer) return { ok: false, error: "Unggah offering letter dulu." };
  if (candidate.request.heldAt) return { ok: false, error: HELD_MESSAGE };
  if (candidate.offer.response) return { ok: false, error: "Offering ini sudah dijawab kandidat." };
  const raw = randomBytes(24).toString("base64url");
  await prisma.recruitmentOffer.update({
    where: { id: candidate.offer.id },
    data: { tokenHash: hashToken(raw), tokenExpiresAt: new Date(Date.now() + OFFER_VALID_DAYS * DAY_MS), sentAt: new Date() },
  });
  const url = `${appBaseUrl()}/cbp-recruitment/offer/${raw}`;
  const emailed = await trySend(
    candidate.email,
    "Surat penawaran kerja PT CBP",
    `Yth. ${candidate.fullName},\n\nSelamat, Anda kami tawarkan posisi ${candidate.request.job?.jobTitle ?? "yang dilamar"} di PT Cahaya Bukit Perunggu. Silakan buka tautan di bawah untuk membaca surat penawaran, lalu menerima atau menolaknya.\n\nTautan berlaku ${OFFER_VALID_DAYS} hari dan hanya untuk Anda.`,
    { url, label: "Buka surat penawaran" }
  );
  return { ok: true, url, emailed, candidateName: candidate.fullName, mobileNumber: candidate.mobileNumber };
}

export async function findOfferByToken(rawToken: string) {
  if (!rawToken) return null;
  return prisma.recruitmentOffer.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      file: true,
      candidate: { include: { request: { select: { job: { select: { jobTitle: true } }, department: { select: { unitName: true } } } } } },
    },
  });
}

export function offerIsOpen(offer: { response: RecruitmentOfferResponse | null; tokenExpiresAt: Date | null; candidate: { status: string } }, now: Date = new Date()): boolean {
  return !offer.response && offer.candidate.status === "OFFERING" && !!offer.tokenExpiresAt && offer.tokenExpiresAt.getTime() > now.getTime();
}

async function applyOfferResponse(
  offer: { id: string; candidateId: string },
  response: RecruitmentOfferResponse,
  extra: { signature: string | null; recordedByHr: boolean }
) {
  await prisma.$transaction(async (tx) => {
    await tx.recruitmentOffer.update({
      where: { id: offer.id },
      data: { response, respondedAt: new Date(), candidateSignature: extra.signature, recordedByHr: extra.recordedByHr },
    });
    if (response === "DECLINED") await setCandidateStatus(tx, offer.candidateId, "OFFER_DECLINED", { closeReason: "Menolak offering letter" });
  });
}

export async function respondToOffer(rawToken: string, response: RecruitmentOfferResponse, signature: string | null): Promise<EngineResult> {
  const offer = await findOfferByToken(rawToken);
  if (!offer || !offerIsOpen(offer)) return { ok: false, error: "Tautan ini sudah tidak berlaku." };
  if (response === "ACCEPTED" && (!signature || !isValidSignatureDataUrl(signature))) {
    return { ok: false, error: "Gambar tanda tangan Anda dulu sebelum menerima." };
  }
  await applyOfferResponse(offer, response, { signature: response === "ACCEPTED" ? signature : null, recordedByHr: false });
  return { ok: true };
}

export async function recordOfferResponseByHr(candidateId: string, response: RecruitmentOfferResponse): Promise<EngineResult> {
  const offer = await prisma.recruitmentOffer.findUnique({ where: { candidateId }, include: { candidate: { select: { status: true } } } });
  if (!offer || offer.response || offer.candidate.status !== "OFFERING") return { ok: false, error: "Offering ini tidak bisa dicatat." };
  await applyOfferResponse(offer, response, { signature: null, recordedByHr: true });
  return { ok: true };
}

// ---------- hire hooks ----------

// Before an employee is created from a request for this applicant.
export async function validateCandidateForHire(candidateId: string, requestId: string): Promise<string | null> {
  const candidate = await prisma.recruitmentCandidate.findUnique({
    where: { id: candidateId },
    select: { requestId: true, source: true, status: true, offer: { select: { response: true } }, request: { select: { heldAt: true } } },
  });
  if (!candidate || candidate.requestId !== requestId) return "Pelamar tidak ditemukan pada permintaan ini.";
  if (candidate.request.heldAt) return HELD_MESSAGE;
  if (candidate.source !== "EXTERNAL") return "Pelamar internal diproses lewat Perubahan Posisi, bukan Buat Karyawan.";
  if (candidate.status !== "OFFERING" || candidate.offer?.response !== "ACCEPTED") return "Pelamar ini belum menerima offering letter.";
  return null;
}

// When a request has reached its headcount, everyone still in the pipeline is closed.
export async function closeRemainingCandidates(tx: Prisma.TransactionClient, requestId: string, exceptCandidateId: string | null) {
  const open = await tx.recruitmentCandidate.findMany({
    where: {
      requestId,
      id: exceptCandidateId ? { not: exceptCandidateId } : undefined,
      status: { in: ["TESTING", "AWAITING_REVIEW", "TEST_PASSED", "INTERVIEWING", "OFFERING", "MOVEMENT"] },
    },
    select: { id: true },
  });
  if (open.length === 0) return 0;
  const ids = open.map((c) => c.id);
  await tx.recruitmentCandidate.updateMany({
    where: { id: { in: ids } },
    data: { status: "NOT_SELECTED", statusChangedAt: new Date(), closedAt: new Date(), closeReason: "Lowongan sudah terisi penuh" },
  });
  await tx.recruitmentOffer.updateMany({ where: { candidateId: { in: ids }, response: null }, data: { tokenHash: null } });
  return ids.length;
}

export async function markCandidateHired(
  tx: Prisma.TransactionClient,
  args: { candidateId: string; employeeId: string; requestId: string; requestIsFull: boolean }
) {
  await tx.recruitmentCandidate.update({
    where: { id: args.candidateId },
    data: { status: "HIRED", statusChangedAt: new Date(), employeeId: args.employeeId },
  });
  if (args.requestIsFull) await closeRemainingCandidates(tx, args.requestId, args.candidateId);
}

// A Perubahan Posisi that belongs to a recruitment request was carried out, either an internal applicant's move
// or a Mutasi Admin SDM filed to fill the request ("Isi dengan Mutasi"): the employee is done as an applicant (if
// they were one), the seat counts toward the request when possible, and the line managers can be told afterwards.
export async function completeInternalHire(
  tx: Prisma.TransactionClient,
  args: { movementRequestId: string; employeeId: string; assignmentId: string | null; accountId: string }
): Promise<{ candidateId: string | null; requestId: string; source: "RECRUITMENT_INTERNAL" | "MUTASI" } | null> {
  const candidate = await tx.recruitmentCandidate.findUnique({
    where: { movementRequestId: args.movementRequestId },
    include: { request: { include: { _count: { select: { fulfillments: true } } } } },
  });
  if (candidate && candidate.status !== "MOVEMENT") return null;

  let request: NonNullable<typeof candidate>["request"];
  if (candidate) {
    await tx.recruitmentCandidate.update({
      where: { id: candidate.id },
      data: { status: "HIRED", statusChangedAt: new Date() },
    });
    request = candidate.request;
  } else {
    const movement = await tx.movementRequest.findUnique({ where: { id: args.movementRequestId }, select: { recruitmentRequestId: true } });
    if (!movement?.recruitmentRequestId) return null;
    const direct = await tx.recruitmentRequest.findUnique({ where: { id: movement.recruitmentRequestId }, include: { _count: { select: { fulfillments: true } } } });
    if (!direct) return null;
    request = direct;
  }
  let filled = request._count.fulfillments;
  if (args.assignmentId && FULFILLABLE_STATUSES.includes(request.status)) {
    const already = await tx.recruitmentRequestFulfillment.findUnique({ where: { employeeId: args.employeeId } });
    if (!already) {
      await tx.recruitmentRequestFulfillment.create({
        data: {
          recruitmentRequestId: request.id,
          employeeId: args.employeeId,
          assignmentId: args.assignmentId,
          linkedByAccountId: args.accountId,
          // an applicant who went through internal recruitment, or a Mutasi with no applicant
          source: candidate ? "RECRUITMENT_INTERNAL" : "MUTASI",
        },
      });
      filled += 1;
      await tx.recruitmentRequest.update({
        where: { id: request.id },
        data: { status: nextStatusAfterFulfillment(request.requestedHeadcount, filled) },
      });
    }
  }
  if (computeFulfillmentCounts(request.requestedHeadcount, filled).isFull) {
    await closeRemainingCandidates(tx, request.id, candidate?.id ?? null);
  }
  return { candidateId: candidate?.id ?? null, requestId: request.id, source: candidate ? "RECRUITMENT_INTERNAL" : "MUTASI" };
}

// After the internal move is done: tell the managers of the old and the new seat.
export async function notifyManagersOfInternalHire(args: { source: "RECRUITMENT_INTERNAL" | "MUTASI"; employeeId: string; oldPositionId: string; newPositionId: string; effectiveDate: Date }) {
  const [employee, oldPos, newPos] = await Promise.all([
    prisma.employee.findUnique({ where: { id: args.employeeId }, select: { fullLegalName: true } }),
    prisma.position.findUnique({ where: { id: args.oldPositionId }, select: { reportsToPositionId: true, job: { select: { jobTitle: true } } } }),
    prisma.position.findUnique({ where: { id: args.newPositionId }, select: { reportsToPositionId: true, job: { select: { jobTitle: true } } } }),
  ]);
  if (!employee) return;
  const managerSeats = [oldPos?.reportsToPositionId, newPos?.reportsToPositionId].filter((x): x is string => !!x);
  if (managerSeats.length === 0) return;
  const managers = await prisma.employee.findMany({
    where: { currentPositionId: { in: managerSeats }, activeFlag: true, id: { not: args.employeeId } },
    select: { id: true },
  });
  const when = args.effectiveDate.toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  for (const m of managers) {
    await mailEmployee(
      m.id,
      "Perubahan posisi karyawan (SAPA)",
      `${employee.fullLegalName} resmi pindah dari ${oldPos?.job.jobTitle ?? "posisi lama"} ke ${newPos?.job.jobTitle ?? "posisi baru"} mulai ${when}, melalui ${args.source === "MUTASI" ? "mutasi untuk mengisi permintaan tenaga kerja" : "rekrutmen internal"}.`
    );
  }
}
