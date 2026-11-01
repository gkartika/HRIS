// What the Admin Produksi screens read: the list of forms, one form with its history, the Beranda numbers, and the forms
// waiting for a 3A/3B or for Admin SDM. Reads only.
import { prisma } from "@/lib/db";
import { MONTH_LABELS_ID } from "@/lib/company-time";
import { resolveCutoffPeriod } from "@/lib/absence-cutoff";
import { getActiveLevel3Positions, resolveDepartmentId } from "@/lib/level3-scope";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { DISCIPLINE_LABEL, formatAmount, FORM_LABEL } from "@/lib/production-forms";
import type { ProductionFormKind, ProductionFormStatus } from "@/generated/prisma/enums";

export const dayLabel = (d: Date) => `${d.getUTCDate()} ${MONTH_LABELS_ID[d.getUTCMonth()]}`;

export interface FormRow {
  kind: ProductionFormKind;
  id: string;
  number: string;
  title: string;
  subtitle: string;
  status: ProductionFormStatus;
  departmentId: string;
  submittedAt: Date | null;
  leaderDecidedAt: Date | null;
  leaderDecidedByName: string | null;
  updatedAt: Date;
  /** Names the form is about, for searching. */
  people: string[];
}

async function allRows(where: { departmentId?: string; status?: { in: ProductionFormStatus[] } }): Promise<FormRow[]> {
  const [work, leave, discipline] = await Promise.all([
    prisma.extraWorkRequest.findMany({ where, orderBy: { updatedAt: "desc" }, take: 300, include: { lines: { include: { employee: { select: { fullLegalName: true } } } } } }),
    prisma.leaveWorkRequest.findMany({ where, orderBy: { updatedAt: "desc" }, take: 300, include: { employee: { select: { fullLegalName: true } } } }),
    prisma.disciplinaryAction.findMany({ where, orderBy: { updatedAt: "desc" }, take: 300, include: { employee: { select: { fullLegalName: true } } } }),
  ]);
  const rows: FormRow[] = [];
  for (const f of work) {
    const total = f.lines.reduce((sum, l) => sum + Number(f.status === "COMPLETED" && l.finalAmount !== null ? l.finalAmount : l.requestedAmount), 0);
    rows.push({
      kind: "EXTRA_WORK",
      id: f.id,
      number: f.requestNumber,
      title: `${FORM_LABEL.EXTRA_WORK} · ${dayLabel(f.workDate)}`,
      subtitle: `${f.requestNumber} · ${f.lines.length} karyawan · ${formatAmount(total, f.unit)}`,
      status: f.status,
      departmentId: f.departmentId,
      submittedAt: f.submittedAt,
      leaderDecidedAt: f.leaderDecidedAt,
      leaderDecidedByName: f.leaderDecidedByName,
      updatedAt: f.updatedAt,
      people: f.lines.map((l) => l.employee.fullLegalName),
    });
  }
  for (const f of leave) {
    rows.push({
      kind: "LEAVE_WORK",
      id: f.id,
      number: f.requestNumber,
      title: `Izin · ${f.employee.fullLegalName} · ${dayLabel(f.workDate)}, ${f.leaveTime} ${f.returnTime ? `sampai ${f.returnTime}` : "tidak kembali"}`,
      subtitle: f.requestNumber,
      status: f.status,
      departmentId: f.departmentId,
      submittedAt: f.submittedAt,
      leaderDecidedAt: f.leaderDecidedAt,
      leaderDecidedByName: f.leaderDecidedByName,
      updatedAt: f.updatedAt,
      people: [f.employee.fullLegalName],
    });
  }
  for (const f of discipline) {
    rows.push({
      kind: "DISCIPLINE",
      id: f.id,
      number: f.requestNumber,
      title: `${DISCIPLINE_LABEL[f.kind]} · ${f.employee.fullLegalName}`,
      subtitle: `${f.requestNumber} · kejadian ${dayLabel(f.incidentDate)}`,
      status: f.status,
      departmentId: f.departmentId,
      submittedAt: f.submittedAt,
      leaderDecidedAt: f.leaderDecidedAt,
      leaderDecidedByName: f.leaderDecidedByName,
      updatedAt: f.updatedAt,
      people: [f.employee.fullLegalName],
    });
  }
  return rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function listForms(opts: { departmentId?: string; statuses?: ProductionFormStatus[]; search?: string } = {}): Promise<FormRow[]> {
  const rows = await allRows({ ...(opts.departmentId ? { departmentId: opts.departmentId } : {}), ...(opts.statuses ? { status: { in: opts.statuses } } : {}) });
  const q = opts.search?.trim().toLowerCase();
  return q ? rows.filter((r) => r.number.toLowerCase().includes(q) || r.people.some((p) => p.toLowerCase().includes(q))) : rows;
}

// ---------- one form ----------

export async function getEvents(kind: ProductionFormKind, formId: string) {
  return prisma.productionFormEvent.findMany({ where: { formKind: kind, formId }, orderBy: { createdAt: "asc" } });
}

export async function getExtraWork(id: string) {
  return prisma.extraWorkRequest.findUnique({ where: { id }, include: { lines: { include: { employee: { select: { fullLegalName: true, employeeNumber: true } } }, orderBy: { employee: { fullLegalName: "asc" } } } } });
}
export async function getLeaveWork(id: string) {
  return prisma.leaveWorkRequest.findUnique({ where: { id }, include: { employee: { select: { fullLegalName: true, employeeNumber: true } } } });
}
export async function getDiscipline(id: string) {
  return prisma.disciplinaryAction.findUnique({ where: { id }, include: { employee: { select: { fullLegalName: true, employeeNumber: true } } } });
}

// ---------- Beranda ----------

export interface ProductionHomeData {
  needsFix: FormRow[];
  forms: FormRow[];
  counts: Record<ProductionFormKind, number>;
  month: { label: string; extraWork: number; leaveWork: number; discipline: number };
  sections: { name: string; count: number }[];
  employees: number;
}

export async function getProductionHomeData(departmentId: string, now: Date = new Date()): Promise<ProductionHomeData> {
  const period = resolveCutoffPeriod(now);
  const [rows, units, employees, ew, lw, da] = await Promise.all([
    allRows({ departmentId }),
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.employee.findMany({ where: { activeFlag: true, currentPositionId: { not: null } }, select: { currentPosition: { select: { orgUnitId: true } } } }),
    prisma.extraWorkRequest.count({ where: { departmentId, status: { not: "DRAFT" }, workDate: { gte: period.start, lte: period.end } } }),
    prisma.leaveWorkRequest.count({ where: { departmentId, status: { not: "DRAFT" }, workDate: { gte: period.start, lte: period.end } } }),
    prisma.disciplinaryAction.count({ where: { departmentId, status: { not: "DRAFT" }, incidentDate: { gte: period.start, lte: period.end } } }),
  ]);
  const tree = buildOrgUnitTree(units);
  const bySection = new Map<string, number>();
  let total = 0;
  for (const e of employees) {
    const unitId = e.currentPosition?.orgUnitId;
    if (!unitId || tree.departmentOf(unitId)?.id !== departmentId) continue;
    total += 1;
    const name = tree.ancestorChain(unitId).find((u) => u.unitType === "SECTION")?.unitName ?? "Lainnya";
    bySection.set(name, (bySection.get(name) ?? 0) + 1);
  }
  const waiting = (r: FormRow) => r.status === "SUBMITTED" || r.status === "LEADER_APPROVED";
  return {
    needsFix: rows.filter((r) => r.status === "RETURNED"),
    forms: rows,
    counts: {
      EXTRA_WORK: rows.filter((r) => r.kind === "EXTRA_WORK" && waiting(r)).length,
      LEAVE_WORK: rows.filter((r) => r.kind === "LEAVE_WORK" && waiting(r)).length,
      DISCIPLINE: rows.filter((r) => r.kind === "DISCIPLINE" && waiting(r)).length,
    },
    month: { label: period.label, extraWork: ew, leaveWork: lw, discipline: da },
    sections: [...bySection.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    employees: total,
  };
}

// ---------- who has something waiting ----------

// Forms waiting for this person as 3A or 3B of their department.
export async function getFormsForApprover(employeeId: string | null | undefined): Promise<FormRow[]> {
  if (!employeeId) return [];
  const positions = await getActiveLevel3Positions(employeeId);
  const departmentIds = [...new Set((await Promise.all(positions.map((p) => resolveDepartmentId(p.orgUnitId)))).filter((x): x is string => !!x))];
  if (departmentIds.length === 0) return [];
  const rows = await allRows({ status: { in: ["SUBMITTED"] } });
  return rows.filter((r) => departmentIds.includes(r.departmentId));
}

// Forms approved by 3A/3B that wait for Admin SDM.
export async function getFormsForAdminSdm(): Promise<FormRow[]> {
  return allRows({ status: { in: ["LEADER_APPROVED"] } });
}

// ---------- payroll Excel ----------

// The completed forms of one payroll period, as the rows of the two extra sheets (see production-forms-export.ts).
export async function loadProductionExportRows(period: { start: Date; end: Date }) {
  const range = { gte: period.start, lte: period.end };
  const [work, leave] = await Promise.all([
    prisma.extraWorkRequest.findMany({
      where: { status: "COMPLETED", workDate: range },
      orderBy: [{ workDate: "asc" }, { requestNumber: "asc" }],
      include: { lines: { include: { employee: { select: { fullLegalName: true, employeeNumber: true } } }, orderBy: { employee: { fullLegalName: "asc" } } } },
    }),
    prisma.leaveWorkRequest.findMany({
      where: { status: "COMPLETED", workDate: range, decision: { not: null } },
      orderBy: [{ workDate: "asc" }, { requestNumber: "asc" }],
      include: { employee: { select: { fullLegalName: true, employeeNumber: true } } },
    }),
  ]);
  return {
    extraWork: work.flatMap((f) =>
      f.lines.map((l) => ({
        requestNumber: f.requestNumber,
        workDate: f.workDate,
        employeeNumber: l.employee.employeeNumber,
        employeeName: l.employee.fullLegalName,
        unit: f.unit,
        requested: Number(l.requestedAmount),
        final: l.finalAmount === null ? null : Number(l.finalAmount),
        startTime: l.startTime,
        endTime: l.endTime,
        reason: f.reason,
        approvedBy: f.leaderDecidedByName,
        note: f.payrollNote,
      }))
    ),
    leaveWork: leave.map((f) => ({
      requestNumber: f.requestNumber,
      workDate: f.workDate,
      employeeNumber: f.employee.employeeNumber,
      employeeName: f.employee.fullLegalName,
      leaveTime: f.leaveTime,
      returnTime: f.returnTime,
      decision: f.decision!,
      reason: f.reason,
      approvedBy: f.leaderDecidedByName,
      note: f.decisionNote,
    })),
  };
}
