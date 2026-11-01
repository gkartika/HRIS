// Prisma-backed rules for the Admin Produksi forms: who the Production employees and approvers are, saving a form,
// the 3A/3B decision, the Admin SDM step, and the lists the screens need. The pure rules (numbers, validation, status
// words) are in production-forms.ts.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { companyToday, companyYear } from "@/lib/company-time";
import { resolveCutoffPeriod } from "@/lib/absence-cutoff";
import { getActiveLevel3Positions, resolveDepartmentId } from "@/lib/level3-scope";
import { nextSequence } from "@/lib/number-sequence";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import {
  canCancel,
  canEdit,
  disciplineValidUntil,
  extraWorkAmountProblem,
  FORM_LABEL,
  formatFormNumber,
  leaveTimesProblem,
  parseClock,
  type Approver,
} from "@/lib/production-forms";
import type { Prisma } from "@/generated/prisma/client";
import type { DisciplineKind, ExtraWorkUnit, LeaveWorkDecision, ProductionFormKind, ProductionFormStatus } from "@/generated/prisma/enums";

export type Outcome = { ok: true; id: string } | { ok: false; error: string };
export interface Actor {
  accountId: string;
  name: string;
}

const PRODUCTION_DEPARTMENT_NAME = "Production";

function parseDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------- the department, its people and its approvers ----------

export async function getProductionDepartment(): Promise<{ id: string; name: string } | null> {
  const unit = await prisma.orgUnit.findFirst({ where: { unitType: "DEPARTMENT", unitName: { equals: PRODUCTION_DEPARTMENT_NAME, mode: "insensitive" } }, select: { id: true, unitName: true } });
  return unit ? { id: unit.id, name: unit.unitName } : null;
}

export interface ProductionEmployee {
  id: string;
  employeeNumber: string;
  name: string;
  section: string | null;
  group: string | null;
  jobTitle: string;
}

export async function listProductionEmployees(departmentId: string): Promise<ProductionEmployee[]> {
  const [units, employees] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.employee.findMany({
      where: { activeFlag: true, currentPositionId: { not: null } },
      select: { id: true, employeeNumber: true, fullLegalName: true, currentPosition: { select: { orgUnitId: true, job: { select: { jobTitle: true } } } } },
    }),
  ]);
  const tree = buildOrgUnitTree(units);
  const out: ProductionEmployee[] = [];
  for (const e of employees) {
    const unitId = e.currentPosition?.orgUnitId;
    if (!unitId || tree.departmentOf(unitId)?.id !== departmentId) continue;
    const chain = tree.ancestorChain(unitId);
    out.push({
      id: e.id,
      employeeNumber: e.employeeNumber,
      name: e.fullLegalName,
      section: chain.find((u) => u.unitType === "SECTION")?.unitName ?? null,
      group: chain.find((u) => u.unitType === "GROUP")?.unitName ?? null,
      jobTitle: e.currentPosition?.job.jobTitle ?? "",
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Employees of the department among the given ids (the form may only name Production employees).
async function onlyDepartmentEmployees(departmentId: string, employeeIds: string[]): Promise<Set<string>> {
  const all = await listProductionEmployees(departmentId);
  const wanted = new Set(employeeIds);
  return new Set(all.filter((e) => wanted.has(e.id)).map((e) => e.id));
}

export interface DepartmentApprover extends Approver {
  employeeId: string;
}

// The 3A and 3B of the department: whoever holds such a position now.
export async function getDepartmentApprovers(departmentId: string): Promise<DepartmentApprover[]> {
  const [units, assignments] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.assignment.findMany({
      where: { status: "ACTIVE", assignmentType: "PRIMARY", position: { archived: false, jobLevel: { in: ["3A", "3B"] } } },
      select: { employeeId: true, employee: { select: { fullLegalName: true, activeFlag: true } }, position: { select: { jobLevel: true, orgUnitId: true } } },
    }),
  ]);
  const tree = buildOrgUnitTree(units);
  return assignments
    .filter((a) => a.employee.activeFlag && tree.departmentOf(a.position.orgUnitId)?.id === departmentId)
    .map((a) => ({ employeeId: a.employeeId, name: a.employee.fullLegalName, level: a.position.jobLevel }))
    .sort((a, b) => a.level.localeCompare(b.level));
}

// Is this employee a 3A or 3B of the given department right now?
export async function approverOf(employeeId: string | null | undefined, departmentId: string): Promise<DepartmentApprover | null> {
  if (!employeeId) return null;
  const positions = await getActiveLevel3Positions(employeeId);
  for (const p of positions) {
    if ((await resolveDepartmentId(p.orgUnitId)) === departmentId) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fullLegalName: true } });
      return { employeeId, name: employee?.fullLegalName ?? "", level: p.jobLevel };
    }
  }
  return null;
}

// ---------- history and numbering ----------

async function addEvent(tx: Prisma.TransactionClient | typeof prisma, kind: ProductionFormKind, formId: string, event: string, actorName: string, note?: string | null) {
  await tx.productionFormEvent.create({ data: { formKind: kind, formId, event, actorName, note: note?.trim() || null } });
}

async function newNumber(tx: Prisma.TransactionClient, kind: ProductionFormKind, now: Date): Promise<string> {
  const year = companyYear(now);
  const seq = await nextSequence(`PF-${kind}-${year}`, tx);
  return formatFormNumber(kind, year, seq);
}

// ---------- Tambahan jam kerja ----------

export interface ExtraWorkInput {
  workDate: string;
  unit: ExtraWorkUnit;
  reason: string;
  lines: { employeeId: string; startTime?: string | null; endTime?: string | null; amount: number | null }[];
}

function extraWorkProblem(input: ExtraWorkInput, forSubmit: boolean): string | null {
  if (!parseDateOnly(input.workDate)) return "Pilih tanggalnya.";
  if (forSubmit && input.lines.length === 0) return "Pilih sedikitnya satu karyawan.";
  const seen = new Set<string>();
  for (const l of input.lines) {
    if (seen.has(l.employeeId)) return "Ada karyawan yang dipilih dua kali.";
    seen.add(l.employeeId);
    const problem = forSubmit || l.amount !== null ? extraWorkAmountProblem(input.unit, l.amount) : null;
    if (problem) return problem;
    for (const t of [l.startTime, l.endTime]) if (t && parseClock(t) === null) return "Jam mulai atau selesai tidak valid.";
  }
  if (forSubmit && input.reason.trim().length < 3) return "Alasan wajib diisi.";
  return null;
}

export async function saveExtraWork(args: { id?: string; input: ExtraWorkInput; departmentId: string; actor: Actor; submit: boolean }): Promise<Outcome> {
  const { input, departmentId, actor, submit } = args;
  const problem = extraWorkProblem(input, submit);
  if (problem) return { ok: false, error: problem };
  const allowed = await onlyDepartmentEmployees(departmentId, input.lines.map((l) => l.employeeId));
  if (allowed.size !== input.lines.length) return { ok: false, error: "Hanya karyawan Production yang bisa dipilih." };
  const workDate = parseDateOnly(input.workDate)!;
  const now = new Date();
  const lineData = input.lines.map((l) => ({ employeeId: l.employeeId, startTime: l.startTime?.trim() || null, endTime: l.endTime?.trim() || null, requestedAmount: l.amount ?? 0 }));

  if (args.id) {
    const existing = await prisma.extraWorkRequest.findUnique({ where: { id: args.id }, select: { status: true, departmentId: true, requestNumber: true } });
    if (!existing || existing.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
    if (!canEdit(existing.status)) return { ok: false, error: "Formulir ini sudah diajukan dan tidak bisa diubah. Batalkan dulu bila perlu." };
    await prisma.$transaction(async (tx) => {
      await tx.extraWorkLine.deleteMany({ where: { requestId: args.id } });
      await tx.extraWorkRequest.update({
        where: { id: args.id },
        data: { workDate, unit: input.unit, reason: input.reason.trim(), status: submit ? "SUBMITTED" : "DRAFT", submittedAt: submit ? now : null, lines: { create: lineData } },
      });
      await addEvent(tx, "EXTRA_WORK", args.id!, submit ? (existing.status === "RETURNED" ? "Diajukan lagi setelah diperbaiki" : "Diajukan") : "Draf disimpan", actor.name);
    });
    await logAudit({ actorAccountId: actor.accountId, action: "UPDATE", datasetName: "ExtraWorkRequest", recordId: args.id, reason: `${submit ? "Submitted" : "Saved draft of"} ${existing.requestNumber}` });
    return { ok: true, id: args.id };
  }

  const created = await prisma.$transaction(async (tx) => {
    const requestNumber = await newNumber(tx, "EXTRA_WORK", now);
    const row = await tx.extraWorkRequest.create({
      data: { requestNumber, workDate, unit: input.unit, reason: input.reason.trim(), status: submit ? "SUBMITTED" : "DRAFT", departmentId, createdByAccountId: actor.accountId, submittedAt: submit ? now : null, lines: { create: lineData } },
    });
    await addEvent(tx, "EXTRA_WORK", row.id, submit ? "Diajukan" : "Draf disimpan", actor.name);
    return row;
  });
  await logAudit({ actorAccountId: actor.accountId, action: "CREATE", datasetName: "ExtraWorkRequest", recordId: created.id, reason: `${submit ? "Submitted" : "Saved draft of"} ${created.requestNumber} (${input.lines.length} employee(s))` });
  return { ok: true, id: created.id };
}

// ---------- Izin meninggalkan pekerjaan ----------

export interface LeaveWorkInput {
  employeeId: string;
  workDate: string;
  leaveTime: string;
  returnTime: string | null;
  reason: string;
}

function leaveWorkProblem(input: LeaveWorkInput, forSubmit: boolean): string | null {
  if (!input.employeeId) return "Pilih karyawannya.";
  if (!parseDateOnly(input.workDate)) return "Pilih tanggalnya.";
  if (forSubmit || input.leaveTime.trim() !== "") {
    const t = leaveTimesProblem(input.leaveTime, input.returnTime);
    if (t) return t;
  }
  if (forSubmit && input.reason.trim().length < 3) return "Alasan wajib diisi.";
  return null;
}

export async function saveLeaveWork(args: { id?: string; input: LeaveWorkInput; departmentId: string; actor: Actor; submit: boolean }): Promise<Outcome> {
  const { input, departmentId, actor, submit } = args;
  const problem = leaveWorkProblem(input, submit);
  if (problem) return { ok: false, error: problem };
  if ((await onlyDepartmentEmployees(departmentId, [input.employeeId])).size !== 1) return { ok: false, error: "Hanya karyawan Production yang bisa dipilih." };
  const workDate = parseDateOnly(input.workDate)!;
  const now = new Date();
  const data = { employeeId: input.employeeId, workDate, leaveTime: input.leaveTime.trim(), returnTime: input.returnTime?.trim() || null, reason: input.reason.trim() };

  if (args.id) {
    const existing = await prisma.leaveWorkRequest.findUnique({ where: { id: args.id }, select: { status: true, departmentId: true, requestNumber: true } });
    if (!existing || existing.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
    if (!canEdit(existing.status)) return { ok: false, error: "Formulir ini sudah diajukan dan tidak bisa diubah. Batalkan dulu bila perlu." };
    await prisma.$transaction(async (tx) => {
      await tx.leaveWorkRequest.update({ where: { id: args.id }, data: { ...data, status: submit ? "SUBMITTED" : "DRAFT", submittedAt: submit ? now : null } });
      await addEvent(tx, "LEAVE_WORK", args.id!, submit ? (existing.status === "RETURNED" ? "Diajukan lagi setelah diperbaiki" : "Diajukan") : "Draf disimpan", actor.name);
    });
    await logAudit({ actorAccountId: actor.accountId, action: "UPDATE", datasetName: "LeaveWorkRequest", recordId: args.id, reason: `${submit ? "Submitted" : "Saved draft of"} ${existing.requestNumber}` });
    return { ok: true, id: args.id };
  }

  const created = await prisma.$transaction(async (tx) => {
    const requestNumber = await newNumber(tx, "LEAVE_WORK", now);
    const row = await tx.leaveWorkRequest.create({ data: { ...data, requestNumber, status: submit ? "SUBMITTED" : "DRAFT", departmentId, createdByAccountId: actor.accountId, submittedAt: submit ? now : null } });
    await addEvent(tx, "LEAVE_WORK", row.id, submit ? "Diajukan" : "Draf disimpan", actor.name);
    return row;
  });
  await logAudit({ actorAccountId: actor.accountId, action: "CREATE", datasetName: "LeaveWorkRequest", recordId: created.id, reason: `${submit ? "Submitted" : "Saved draft of"} ${created.requestNumber}` });
  return { ok: true, id: created.id };
}

// ---------- Surat Peringatan ----------

export interface DisciplineInput {
  employeeId: string;
  kind: DisciplineKind;
  incidentDate: string;
  description: string;
}

function disciplineProblem(input: DisciplineInput, forSubmit: boolean): string | null {
  if (!input.employeeId) return "Pilih karyawannya.";
  if (!parseDateOnly(input.incidentDate)) return "Pilih tanggal kejadian.";
  if (forSubmit && input.description.trim().length < 10) return "Tuliskan apa yang terjadi (minimal 10 huruf).";
  return null;
}

export async function saveDiscipline(args: { id?: string; input: DisciplineInput; departmentId: string; actor: Actor; submit: boolean }): Promise<Outcome> {
  const { input, departmentId, actor, submit } = args;
  const problem = disciplineProblem(input, submit);
  if (problem) return { ok: false, error: problem };
  if ((await onlyDepartmentEmployees(departmentId, [input.employeeId])).size !== 1) return { ok: false, error: "Hanya karyawan Production yang bisa dipilih." };
  const incidentDate = parseDateOnly(input.incidentDate)!;
  const now = new Date();
  const data = { employeeId: input.employeeId, kind: input.kind, incidentDate, description: input.description.trim() };

  if (args.id) {
    const existing = await prisma.disciplinaryAction.findUnique({ where: { id: args.id }, select: { status: true, departmentId: true, requestNumber: true } });
    if (!existing || existing.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
    if (!canEdit(existing.status)) return { ok: false, error: "Formulir ini sudah diajukan dan tidak bisa diubah. Batalkan dulu bila perlu." };
    await prisma.$transaction(async (tx) => {
      await tx.disciplinaryAction.update({ where: { id: args.id }, data: { ...data, status: submit ? "SUBMITTED" : "DRAFT", submittedAt: submit ? now : null } });
      await addEvent(tx, "DISCIPLINE", args.id!, submit ? (existing.status === "RETURNED" ? "Diajukan lagi setelah diperbaiki" : "Diajukan") : "Draf disimpan", actor.name);
    });
    await logAudit({ actorAccountId: actor.accountId, action: "UPDATE", datasetName: "DisciplinaryAction", recordId: args.id, reason: `${submit ? "Submitted" : "Saved draft of"} ${existing.requestNumber}` });
    return { ok: true, id: args.id };
  }

  const created = await prisma.$transaction(async (tx) => {
    const requestNumber = await newNumber(tx, "DISCIPLINE", now);
    const row = await tx.disciplinaryAction.create({ data: { ...data, requestNumber, status: submit ? "SUBMITTED" : "DRAFT", departmentId, createdByAccountId: actor.accountId, submittedAt: submit ? now : null } });
    await addEvent(tx, "DISCIPLINE", row.id, submit ? "Diajukan" : "Draf disimpan", actor.name);
    return row;
  });
  await logAudit({ actorAccountId: actor.accountId, action: "CREATE", datasetName: "DisciplinaryAction", recordId: created.id, reason: `${submit ? "Submitted" : "Saved draft of"} ${created.requestNumber}` });
  return { ok: true, id: created.id };
}

// The Surat Peringatan an employee still has in force on a day, for the warning and the suggested step.
export async function getActiveDisciplines(employeeId: string, onDate: Date = companyToday()) {
  return prisma.disciplinaryAction.findMany({
    where: { employeeId, status: "COMPLETED", validUntil: { gte: onDate } },
    orderBy: { handedOverAt: "desc" },
    select: { id: true, requestNumber: true, kind: true, handedOverAt: true, validUntil: true },
  });
}

// ---------- shared: loading, submitting a saved draft, withdrawing, 3A/3B decision ----------

interface Header {
  status: ProductionFormStatus;
  departmentId: string;
  requestNumber: string;
}

async function loadHeader(kind: ProductionFormKind, id: string): Promise<Header | null> {
  const select = { status: true, departmentId: true, requestNumber: true } as const;
  if (kind === "EXTRA_WORK") return prisma.extraWorkRequest.findUnique({ where: { id }, select });
  if (kind === "LEAVE_WORK") return prisma.leaveWorkRequest.findUnique({ where: { id }, select });
  return prisma.disciplinaryAction.findUnique({ where: { id }, select });
}

// The fields every form shares (status and the 3A/3B decision) plus the ones of one form, set in one place.
async function setStatus(tx: Prisma.TransactionClient, kind: ProductionFormKind, id: string, data: Record<string, unknown>) {
  if (kind === "EXTRA_WORK") await tx.extraWorkRequest.update({ where: { id }, data: data as Prisma.ExtraWorkRequestUpdateInput });
  else if (kind === "LEAVE_WORK") await tx.leaveWorkRequest.update({ where: { id }, data: data as Prisma.LeaveWorkRequestUpdateInput });
  else await tx.disciplinaryAction.update({ where: { id }, data: data as Prisma.DisciplinaryActionUpdateInput });
}

// A draft (or returned form) that is already complete can be sent from the detail page.
export async function submitExisting(kind: ProductionFormKind, id: string, departmentId: string, actor: Actor): Promise<Outcome> {
  if (kind === "EXTRA_WORK") {
    const f = await prisma.extraWorkRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!f || f.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
    return saveExtraWork({
      id,
      departmentId,
      actor,
      submit: true,
      input: { workDate: f.workDate.toISOString().slice(0, 10), unit: f.unit, reason: f.reason, lines: f.lines.map((l) => ({ employeeId: l.employeeId, startTime: l.startTime, endTime: l.endTime, amount: Number(l.requestedAmount) })) },
    });
  }
  if (kind === "LEAVE_WORK") {
    const f = await prisma.leaveWorkRequest.findUnique({ where: { id } });
    if (!f || f.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
    return saveLeaveWork({ id, departmentId, actor, submit: true, input: { employeeId: f.employeeId, workDate: f.workDate.toISOString().slice(0, 10), leaveTime: f.leaveTime, returnTime: f.returnTime, reason: f.reason } });
  }
  const f = await prisma.disciplinaryAction.findUnique({ where: { id } });
  if (!f || f.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
  return saveDiscipline({ id, departmentId, actor, submit: true, input: { employeeId: f.employeeId, kind: f.kind, incidentDate: f.incidentDate.toISOString().slice(0, 10), description: f.description } });
}

export async function cancelForm(kind: ProductionFormKind, id: string, departmentId: string, actor: Actor, reason: string | null): Promise<Outcome> {
  const h = await loadHeader(kind, id);
  if (!h || h.departmentId !== departmentId) return { ok: false, error: "Formulir tidak ditemukan." };
  if (!canCancel(h.status)) return { ok: false, error: "Formulir ini sudah selesai atau sudah ditutup, jadi tidak bisa dibatalkan." };
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, kind, id, { status: "CANCELLED" });
    await addEvent(tx, kind, id, "Dibatalkan", actor.name, reason);
  });
  await logAudit({ actorAccountId: actor.accountId, action: "UPDATE", datasetName: modelOf(kind), recordId: id, reason: `Cancelled ${h.requestNumber}${reason ? `: ${reason}` : ""}` });
  return { ok: true, id };
}

const modelOf = (kind: ProductionFormKind) => (kind === "EXTRA_WORK" ? "ExtraWorkRequest" : kind === "LEAVE_WORK" ? "LeaveWorkRequest" : "DisciplinaryAction");

// 3A or 3B: approve, reject (note required) or return for correction (note required). The first one to decide decides.
export async function leaderDecide(
  kind: ProductionFormKind,
  id: string,
  decision: "APPROVE" | "REJECT" | "RETURN",
  note: string,
  employeeId: string | null | undefined,
  accountId: string
): Promise<Outcome> {
  const h = await loadHeader(kind, id);
  if (!h) return { ok: false, error: "Formulir tidak ditemukan." };
  if (h.status !== "SUBMITTED") return { ok: false, error: "Formulir ini sudah diputuskan atau belum diajukan." };
  const approver = await approverOf(employeeId, h.departmentId);
  if (!approver) return { ok: false, error: "Anda bukan penyetuju formulir ini." };
  const text = note.trim();
  if ((decision === "REJECT" || decision === "RETURN") && !text) return { ok: false, error: "Catatan wajib diisi untuk Tolak atau Kembalikan." };
  const status: ProductionFormStatus = decision === "APPROVE" ? "LEADER_APPROVED" : decision === "REJECT" ? "REJECTED" : "RETURNED";
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, kind, id, { status, leaderDecidedAt: new Date(), leaderDecidedByName: `${approver.name} (${approver.level})`, leaderDecidedByEmployeeId: approver.employeeId, leaderNote: text || null });
    await addEvent(tx, kind, id, decision === "APPROVE" ? `Disetujui ${approver.name} (${approver.level})` : decision === "REJECT" ? `Ditolak ${approver.name} (${approver.level})` : `Dikembalikan ${approver.name} (${approver.level})`, approver.name, text);
  });
  await logAudit({ actorAccountId: accountId, action: decision === "APPROVE" ? "APPROVE" : "REJECT", datasetName: modelOf(kind), recordId: id, reason: `${decision} ${h.requestNumber} as ${approver.level}${text ? `: ${text}` : ""}` });
  return { ok: true, id };
}

// ---------- Admin SDM ----------

// Tambahan jam kerja: payroll approval. Admin SDM has the final say on each amount (zero is allowed = not counted).
export async function payrollDecide(
  id: string,
  decision: "APPROVE" | "REJECT" | "RETURN",
  finals: Record<string, number | null>,
  note: string,
  actor: Actor
): Promise<Outcome> {
  const f = await prisma.extraWorkRequest.findUnique({ where: { id }, include: { lines: true } });
  if (!f) return { ok: false, error: "Formulir tidak ditemukan." };
  if (f.status !== "LEADER_APPROVED") return { ok: false, error: "Formulir ini belum disetujui atasan atau sudah diputuskan." };
  const text = note.trim();
  if ((decision === "REJECT" || decision === "RETURN") && !text) return { ok: false, error: "Catatan wajib diisi untuk Tolak atau Kembalikan." };

  const updates: { id: string; finalAmount: number | null }[] = [];
  if (decision === "APPROVE") {
    let changed = false;
    for (const line of f.lines) {
      const asked = Number(line.requestedAmount);
      const typed = finals[line.id];
      if (typed === undefined || typed === null || typed === asked) {
        updates.push({ id: line.id, finalAmount: null });
        continue;
      }
      if (!Number.isFinite(typed) || typed < 0) return { ok: false, error: "Jumlah final harus angka 0 atau lebih." };
      if (typed > 0) {
        const problem = f.unit === "HOURS" ? (typed > 24 ? "Paling banyak 24 jam per orang." : null) : typed > 31 ? "Paling banyak 31 hari kerja." : null;
        if (problem) return { ok: false, error: problem };
      }
      changed = true;
      updates.push({ id: line.id, finalAmount: typed });
    }
    if (changed && !text) return { ok: false, error: "Ada jumlah yang diubah. Isi catatan alasannya." };
  }
  const status: ProductionFormStatus = decision === "APPROVE" ? "COMPLETED" : decision === "REJECT" ? "REJECTED" : "RETURNED";
  await prisma.$transaction(async (tx) => {
    for (const u of updates) await tx.extraWorkLine.update({ where: { id: u.id }, data: { finalAmount: u.finalAmount } });
    await tx.extraWorkRequest.update({ where: { id }, data: { status, payrollDecidedAt: new Date(), payrollDecidedByAccountId: actor.accountId, payrollNote: text || null } });
    await addEvent(tx, "EXTRA_WORK", id, decision === "APPROVE" ? "Disetujui untuk payroll" : decision === "REJECT" ? "Ditolak Admin SDM" : "Dikembalikan Admin SDM", actor.name, text);
  });
  await logAudit({ actorAccountId: actor.accountId, action: decision === "APPROVE" ? "APPROVE" : "REJECT", datasetName: "ExtraWorkRequest", recordId: id, reason: `Payroll ${decision} ${f.requestNumber}${text ? `: ${text}` : ""}` });
  return { ok: true, id };
}

// Izin: half day (absence code SH) or a full day (code I), written straight to that day's attendance record.
const LEAVE_ABSENCE_CODE: Record<LeaveWorkDecision, string> = { HALF_DAY: "SH", FULL_DAY: "I" };

export async function decideLeaveWork(id: string, decision: LeaveWorkDecision, note: string, actor: Actor, now: Date = new Date()): Promise<Outcome & { warning?: string }> {
  const f = await prisma.leaveWorkRequest.findUnique({ where: { id }, include: { employee: { select: { fullLegalName: true } } } });
  if (!f) return { ok: false, error: "Formulir tidak ditemukan." };
  const reopening = f.status === "COMPLETED";
  if (f.status !== "LEADER_APPROVED" && !reopening) return { ok: false, error: "Formulir ini belum disetujui atasan." };
  // A decision can be changed while the payroll period of that day is still open.
  if (reopening && f.workDate < resolveCutoffPeriod(now).start) return { ok: false, error: "Periode payroll hari itu sudah ditutup, keputusan tidak bisa diubah." };

  const code = LEAVE_ABSENCE_CODE[decision];
  const weekStart = normalizeWeekStart(f.workDate);
  const [assigned, type] = await Promise.all([
    prisma.shiftAssignment.findFirst({ where: { employeeId: f.employeeId, weekStartDate: weekStart }, select: { shiftType: true } }),
    prisma.absenceTypeConfig.findUnique({ where: { code }, select: { code: true, activeFlag: true } }),
  ]);
  if (!type) return { ok: false, error: `Kode absensi ${code} tidak ditemukan di pengaturan absensi.` };
  const text = note.trim();
  const classificationNote = `Izin meninggalkan pekerjaan ${f.requestNumber} (${f.leaveTime}${f.returnTime ? ` sampai ${f.returnTime}` : ", tidak kembali"})${text ? `: ${text}` : ""}`;

  await prisma.$transaction(async (tx) => {
    await tx.dailyAttendanceRecord.upsert({
      where: { employeeId_attendanceDate: { employeeId: f.employeeId, attendanceDate: f.workDate } },
      update: { absenceTypeCode: code, shiftType: assigned?.shiftType ?? null, presentOverride: false, classificationNote, classifiedAt: now, classifiedByAccountId: actor.accountId },
      create: { employeeId: f.employeeId, attendanceDate: f.workDate, absenceTypeCode: code, shiftType: assigned?.shiftType ?? null, presentOverride: false, classificationNote, classifiedAt: now, classifiedByAccountId: actor.accountId },
    });
    await tx.leaveWorkRequest.update({ where: { id }, data: { status: "COMPLETED", decision, decidedAt: now, decidedByAccountId: actor.accountId, decisionNote: text || null } });
    await addEvent(tx, "LEAVE_WORK", id, decision === "HALF_DAY" ? "Diputuskan dihitung setengah hari" : "Diputuskan tetap satu hari penuh", actor.name, text);
  });
  await logAudit({ actorAccountId: actor.accountId, action: "UPDATE", datasetName: "DailyAttendanceRecord", recordId: `${f.employeeId}:${f.workDate.toISOString().slice(0, 10)}`, reason: `${FORM_LABEL.LEAVE_WORK} ${f.requestNumber}: ${code} for ${f.employee.fullLegalName}` });
  return { ok: true, id, warning: assigned ? undefined : "Jadwal shift minggu itu belum diisi, jadi jam kerja untuk Setengah Hari belum terhitung. Isi jadwal shift-nya." };
}

// Surat Peringatan: handed to the employee. Validity (6 months) runs from this date.
export async function handOverDiscipline(id: string, handedOverIso: string, actor: Actor, now: Date = new Date()): Promise<Outcome> {
  const f = await prisma.disciplinaryAction.findUnique({ where: { id }, select: { status: true, requestNumber: true } });
  if (!f) return { ok: false, error: "Formulir tidak ditemukan." };
  if (f.status !== "LEADER_APPROVED") return { ok: false, error: "SP ini belum disetujui atasan atau sudah diserahkan." };
  const at = parseDateOnly(handedOverIso);
  if (!at) return { ok: false, error: "Isi tanggal diserahkan." };
  if (at.getTime() > companyToday(now).getTime()) return { ok: false, error: "Tanggal diserahkan tidak boleh di masa depan." };
  const validUntil = disciplineValidUntil(at);
  await prisma.$transaction(async (tx) => {
    await tx.disciplinaryAction.update({ where: { id }, data: { status: "COMPLETED", handedOverAt: at, handedOverByAccountId: actor.accountId, validUntil } });
    await addEvent(tx, "DISCIPLINE", id, "Sudah diserahkan ke karyawan", actor.name, `Berlaku sampai ${validUntil.toISOString().slice(0, 10)}`);
  });
  await logAudit({ actorAccountId: actor.accountId, action: "UPDATE", datasetName: "DisciplinaryAction", recordId: id, reason: `Handed over ${f.requestNumber} on ${handedOverIso}, valid until ${validUntil.toISOString().slice(0, 10)}` });
  return { ok: true, id };
}
