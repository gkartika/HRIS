"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { canManageRecruitment, isHrAdmin } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { OPEN_MOVEMENT_STATUSES } from "@/lib/movement";
import { closeRemainingCandidates } from "@/lib/recruitment-flow";
import { notifyRequestParties } from "@/lib/recruitment-request-notify";
import {
  canHoldStatus,
  canSetJobStatus,
  fallbackSeatSpec,
  jobChangeNeedsReason,
  jobChangeProblem,
  nextCode,
  reduceHeadcountProblem,
  statusAfterReduce,
} from "@/lib/recruitment-request-changes";
import type { RecruitmentRequestEventKind, RequestedJobLevel } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

const LEVELS: RequestedJobLevel[] = ["DEPARTMENT_HEAD", "SECTION_HEAD", "SUPERVISOR", "STAFF_OPERATOR", "HARIAN_LEPAS"];

type RequestRow = {
  id: string;
  requestNumber: string;
  status: Parameters<typeof canHoldStatus>[0];
  requesterEmployeeId: string;
  requestedHeadcount: number;
  jobId: string | null;
  requestedJobLevel: RequestedJobLevel | null;
  departmentId: string;
  requesterPositionId: string | null;
  heldAt: Date | null;
};

async function loadRequest(requestId: string): Promise<RequestRow | null> {
  return prisma.recruitmentRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      status: true,
      requesterEmployeeId: true,
      requestedHeadcount: true,
      jobId: true,
      requestedJobLevel: true,
      departmentId: true,
      requesterPositionId: true,
      heldAt: true,
    },
  });
}

// Who may hold, resume or reduce a request: its own requester, the active HR Manager, Admin SDM and Admin Rekrutmen.
async function roleLabelFor(session: Session, request: RequestRow): Promise<string | null> {
  if (isHrAdmin(session)) return "Admin SDM";
  if (canManageRecruitment(session)) return "Admin Rekrutmen";
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  if (hrManagerPositions.length > 0) return "HR Manager";
  if (session.user.employeeId && session.user.employeeId === request.requesterEmployeeId) return "pengaju";
  return null;
}

async function record(args: {
  request: RequestRow;
  session: Session;
  roleLabel: string;
  kind: RecruitmentRequestEventKind;
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
}) {
  await prisma.recruitmentRequestEvent.create({
    data: {
      requestId: args.request.id,
      kind: args.kind,
      fromValue: args.fromValue ?? null,
      toValue: args.toValue ?? null,
      note: args.note ?? null,
      actorAccountId: args.session.user.id,
      actorLabel: `${args.session.user.name ?? "—"} (${args.roleLabel})`,
    },
  });
}

function revalidate(requestId: string) {
  revalidatePath(`/recruitment/${requestId}`);
  revalidatePath("/recruitment");
}

async function notify(request: RequestRow, session: Session, roleLabel: string, subject: string, what: string, note?: string | null) {
  await notifyRequestParties({
    requestId: request.id,
    requestNumber: request.requestNumber,
    requesterEmployeeId: request.requesterEmployeeId,
    actorAccountId: session.user.id,
    actorEmployeeId: session.user.employeeId ?? null,
    subject: `${subject} (SAPA)`,
    text: `${session.user.name ?? "Seseorang"} (${roleLabel}) ${what} pada permintaan tenaga kerja ${request.requestNumber}.${note ? `\n\nAlasan: ${note}` : ""}`,
  });
}

async function runningMoves(requestId: string) {
  const [mutations, internalMoves, filled] = await Promise.all([
    prisma.movementRequest.count({ where: { recruitmentRequestId: requestId, status: { in: OPEN_MOVEMENT_STATUSES } } }),
    prisma.recruitmentCandidate.count({ where: { requestId, status: "MOVEMENT" } }),
    prisma.recruitmentRequestFulfillment.count({ where: { recruitmentRequestId: requestId } }),
  ]);
  return { mutations, internalMoves, filled };
}

// ---------- Tahan / Lanjutkan ----------

export async function holdRecruitmentRequestAction(requestId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const request = await loadRequest(requestId);
  if (!request) return "Permintaan tidak ditemukan.";
  const roleLabel = await roleLabelFor(session, request);
  if (!roleLabel) return t("common.forbidden");
  if (!canHoldStatus(request.status)) return "Permintaan hanya bisa ditahan setelah disetujui dan sebelum terisi penuh.";
  if (request.heldAt) return "Permintaan ini sudah ditahan.";
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return "Alasan menahan wajib diisi.";

  await prisma.recruitmentRequest.update({ where: { id: requestId }, data: { heldAt: new Date(), heldReason: reason } });
  await record({ request, session, roleLabel, kind: "HELD", note: reason });
  await logAudit({ actorAccountId: session.user.id, action: "UPDATE", datasetName: "RecruitmentRequest", recordId: requestId, reason: `Held ${request.requestNumber}: ${reason}` });
  revalidate(requestId);
  await notify(request, session, roleLabel, "Permintaan tenaga kerja ditahan", "menahan", reason);
}

export async function resumeRecruitmentRequestAction(requestId: string, _prev: string | undefined, _formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const request = await loadRequest(requestId);
  if (!request) return "Permintaan tidak ditemukan.";
  const roleLabel = await roleLabelFor(session, request);
  if (!roleLabel) return t("common.forbidden");
  if (!request.heldAt) return "Permintaan ini tidak sedang ditahan.";

  await prisma.recruitmentRequest.update({ where: { id: requestId }, data: { heldAt: null, heldReason: null } });
  await record({ request, session, roleLabel, kind: "RESUMED" });
  await logAudit({ actorAccountId: session.user.id, action: "UPDATE", datasetName: "RecruitmentRequest", recordId: requestId, reason: `Resumed ${request.requestNumber}` });
  revalidate(requestId);
  await notify(request, session, roleLabel, "Permintaan tenaga kerja dilanjutkan", "melanjutkan");
}

// ---------- Kurangi jumlah ----------

export async function reduceRecruitmentHeadcountAction(requestId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  const request = await loadRequest(requestId);
  if (!request) return "Permintaan tidak ditemukan.";
  const roleLabel = await roleLabelFor(session, request);
  if (!roleLabel) return t("common.forbidden");

  const next = Number((formData.get("newCount") as string) ?? "");
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!Number.isFinite(next)) return "Isi jumlah baru.";
  if (!reason) return "Alasan wajib diisi.";

  const moves = await runningMoves(requestId);
  const problem = reduceHeadcountProblem({
    status: request.status,
    current: request.requestedHeadcount,
    next,
    filled: moves.filled,
    mutationsUnderway: moves.mutations + moves.internalMoves,
  });
  if (problem) return problem;

  const newStatus = statusAfterReduce(request.status, next, moves.filled);
  const becameFilled = newStatus === "FILLED";
  await prisma.$transaction(async (tx) => {
    await tx.recruitmentRequest.update({
      where: { id: requestId },
      data: { requestedHeadcount: next, status: newStatus, ...(becameFilled ? { heldAt: null, heldReason: null } : {}) },
    });
    if (becameFilled) await closeRemainingCandidates(tx, requestId, null);
  });
  await record({ request, session, roleLabel, kind: "HEADCOUNT_REDUCED", fromValue: String(request.requestedHeadcount), toValue: String(next), note: reason });
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: `Reduced headcount of ${request.requestNumber} from ${request.requestedHeadcount} to ${next}: ${reason}`,
  });
  revalidate(requestId);
  await notify(request, session, roleLabel, "Jumlah permintaan tenaga kerja dikurangi", `mengurangi jumlah dari ${request.requestedHeadcount} menjadi ${next}`, reason);
}

// ---------- Jabatan ----------

// Admin SDM / Admin Rekrutmen pick the standard Jabatan (or create it) and the level. Before approval that is
// the normal step; after approval it is a change and needs a reason.
export async function setRecruitmentRequestJobAction(requestId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageRecruitment(session)) return t("common.forbidden");
  const request = await loadRequest(requestId);
  if (!request) return "Permintaan tidak ditemukan.";
  if (!canSetJobStatus(request.status)) return "Jabatan tidak bisa diubah pada status ini.";
  const roleLabel = isHrAdmin(session) ? "Admin SDM" : "Admin Rekrutmen";

  const choice = ((formData.get("jobId") as string) ?? "").trim();
  const level = (formData.get("level") as string) as RequestedJobLevel;
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!choice) return "Pilih jabatan.";
  if (!LEVELS.includes(level)) return "Pilih level.";

  let job: { id: string; jobTitle: string; jobCode: string };
  if (choice === "__new__") {
    const title = ((formData.get("newJobTitle") as string) ?? "").trim().replace(/\s+/g, " ");
    if (title.length < 3 || title.length > 120) return "Isi nama jabatan baru (3 sampai 120 huruf).";
    const same = await prisma.job.findFirst({ where: { jobTitle: { equals: title, mode: "insensitive" } }, select: { jobTitle: true } });
    if (same) return `Jabatan "${same.jobTitle}" sudah ada. Pilih dari daftar.`;
    const codes = (await prisma.job.findMany({ where: { jobCode: { startsWith: "JOB-" } }, select: { jobCode: true } })).map((j) => j.jobCode);
    job = await prisma.job.create({ data: { jobCode: nextCode("JOB-", codes), jobTitle: title }, select: { id: true, jobTitle: true, jobCode: true } });
    await logAudit({ actorAccountId: session.user.id, action: "CREATE", datasetName: "Job", recordId: job.id, reason: `Created job ${job.jobTitle} (${job.jobCode}) from ${request.requestNumber}` });
  } else {
    const found = await prisma.job.findUnique({ where: { id: choice }, select: { id: true, jobTitle: true, jobCode: true } });
    if (!found) return "Jabatan tidak ditemukan.";
    job = found;
  }

  const previous = request.jobId ? await prisma.job.findUnique({ where: { id: request.jobId }, select: { jobTitle: true } }) : null;
  const changing = !!request.jobId && request.jobId !== job.id;
  if (!changing && request.jobId === job.id && request.requestedJobLevel === level) return "Tidak ada perubahan.";

  if (changing) {
    if (jobChangeNeedsReason(request.status) && !reason) return "Alasan perubahan wajib diisi.";
    const moves = await runningMoves(requestId);
    const problem = jobChangeProblem({ filled: moves.filled, mutationsUnderway: moves.mutations, internalMovesUnderway: moves.internalMoves });
    if (problem) return problem;
  }

  await prisma.recruitmentRequest.update({ where: { id: requestId }, data: { jobId: job.id, requestedJobLevel: level } });
  if (!request.jobId || changing) {
    await record({
      request,
      session,
      roleLabel,
      kind: changing ? "JOB_CHANGED" : "JOB_SET",
      fromValue: previous?.jobTitle ?? null,
      toValue: job.jobTitle,
      note: changing ? reason || null : null,
    });
  }
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "RecruitmentRequest",
    recordId: requestId,
    reason: `${changing ? "Changed" : "Set"} job of ${request.requestNumber} to ${job.jobTitle}${changing && reason ? `: ${reason}` : ""}`,
  });
  revalidate(requestId);
  if (changing && jobChangeNeedsReason(request.status)) {
    await notify(request, session, roleLabel, "Jabatan permintaan tenaga kerja diubah", `mengubah jabatan dari ${previous?.jobTitle ?? "-"} menjadi ${job.jobTitle}`, reason);
  }
}

// The text applicants read on the vacancy (public page and Lowongan Internal), written by Admin Rekrutmen or
// Admin SDM. The request's own job description and criteria stay internal.
export async function saveVacancyDetailAction(requestId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageRecruitment(session)) return t("common.forbidden");
  const request = await loadRequest(requestId);
  if (!request) return "Permintaan tidak ditemukan.";

  const clean = (name: string) => ((formData.get(name) as string) ?? "").replace(/\r\n/g, "\n").trim();
  const title = clean("publicTitle").replace(/\s+/g, " ");
  const description = clean("publicDescription");
  const requirements = clean("publicRequirements");
  if (title.length > 120) return "Judul lowongan maksimal 120 huruf.";
  if (description.length < 20) return "Tulis tentang pekerjaannya (minimal 20 huruf).";
  if (description.length > 4000 || requirements.length > 4000) return "Teks terlalu panjang (maksimal 4000 huruf per bagian).";

  await prisma.recruitmentRequest.update({
    where: { id: requestId },
    data: { publicTitle: title || null, publicDescription: description, publicRequirements: requirements || null },
  });
  await logAudit({ actorAccountId: session.user.id, action: "UPDATE", datasetName: "RecruitmentRequest", recordId: requestId, reason: `Vacancy detail written for ${request.requestNumber}` });
  revalidate(requestId);
  revalidatePath("/cbp-recruitment");
  revalidatePath("/internal-jobs");
}

// "+ Tambah kursi": empty seats for the request's Jabatan in its Department, reporting to the requester's seat.
export async function addRequestSeatsAction(requestId: string, _prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageRecruitment(session)) return t("common.forbidden");
  const request = await loadRequest(requestId);
  if (!request) return "Permintaan tidak ditemukan.";
  if (!request.jobId) return "Tetapkan jabatan dulu sebelum menambah kursi.";
  if (!canSetJobStatus(request.status)) return "Kursi tidak bisa ditambah pada status ini.";

  const count = Number((formData.get("count") as string) ?? "");
  if (!Number.isInteger(count) || count < 1 || count > 20) return "Jumlah kursi harus antara 1 dan 20.";

  const [job, sibling, requester] = await Promise.all([
    prisma.job.findUnique({ where: { id: request.jobId }, select: { jobCode: true, jobTitle: true, defaultPositionType: true } }),
    prisma.position.findFirst({ where: { jobId: request.jobId, archived: false }, select: { jobLevel: true, positionType: true }, orderBy: { positionCode: "asc" } }),
    prisma.employee.findUnique({ where: { id: request.requesterEmployeeId }, select: { currentPositionId: true } }),
  ]);
  if (!job) return "Jabatan tidak ditemukan.";
  const spec = sibling ?? fallbackSeatSpec(request.requestedJobLevel);
  const positionType = sibling ? sibling.positionType : (job.defaultPositionType ?? spec.positionType);
  const reportsToPositionId = request.requesterPositionId ?? requester?.currentPositionId ?? null;

  const prefix = `${job.jobCode}-`;
  const existing = (await prisma.position.findMany({ where: { positionCode: { startsWith: prefix } }, select: { positionCode: true } })).map((p) => p.positionCode);
  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const positionCode = nextCode(prefix, [...existing, ...created]);
    const position = await prisma.position.create({
      data: { positionCode, jobId: request.jobId, jobLevel: spec.jobLevel, orgUnitId: request.departmentId, positionType, reportsToPositionId, positionStatus: "VACANT" },
      select: { id: true },
    });
    created.push(positionCode);
    await logAudit({ actorAccountId: session.user.id, action: "CREATE", datasetName: "Position", recordId: position.id, reason: `Created position ${positionCode} for ${request.requestNumber}` });
  }
  revalidate(requestId);
  revalidatePath("/admin/positions");
  revalidatePath("/organization");
}
