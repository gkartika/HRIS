// What the BPJS reminders read: the rows for the Admin SDM Beranda, the monthly list of harian lepas and magang, the
// people still without a start date, and the latest "Sudah" marks. Reads only; callers gate on HR Admin.
import { prisma } from "@/lib/db";
import { companyToday, DAY_MS } from "@/lib/company-time";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { BPJS_REMINDERS_FROM, buildBpjsRows, monthName, taskKind } from "@/lib/bpjs-reminders";
import type { HcTodoRow } from "@/lib/hc-home";

const STATUS_LABEL: Record<string, string> = { PKWTT: "PKWTT", PKWT: "PKWT", HARIAN_LEPAS: "Harian lepas", MAGANG: "Magang" };
const TEMP_STATUSES = ["HARIAN_LEPAS", "MAGANG"] as const;

async function loadTemps() {
  const employees = await prisma.employee.findMany({
    where: { activeFlag: true, employmentStatus: { in: [...TEMP_STATUSES] } },
    select: {
      id: true,
      fullLegalName: true,
      employmentStatus: true,
      hireDate: true,
      currentPosition: { select: { orgUnitId: true } },
      contracts: { select: { startDate: true } },
    },
    orderBy: { fullLegalName: "asc" },
  });
  return employees.map((e) => {
    const starts = e.contracts.map((c) => c.startDate).filter((d): d is Date => !!d);
    const earliest = starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
    return { ...e, startDate: e.hireDate ?? earliest };
  });
}

export async function getBpjsRows(now: Date = new Date()): Promise<HcTodoRow[]> {
  const today = companyToday(now);
  const [temps, cases, done] = await Promise.all([
    loadTemps(),
    prisma.offboardingCase.findMany({
      where: { cancelledAt: null, lastWorkingDay: { gte: new Date(BPJS_REMINDERS_FROM.getTime() - 120 * DAY_MS) } },
      select: { id: true, lastWorkingDay: true, employee: { select: { fullLegalName: true, employmentStatus: true } } },
    }),
    prisma.bpjsTaskDone.findMany({ select: { taskKey: true } }),
  ]);
  return buildBpjsRows({
    today,
    newcomers: temps.filter((e) => e.startDate).map((e) => ({ id: e.id, name: e.fullLegalName, status: STATUS_LABEL[e.employmentStatus], startDate: e.startDate! })),
    missingStartDate: temps.filter((e) => !e.startDate).length,
    leavers: cases.map((c) => ({ caseId: c.id, name: c.employee.fullLegalName, status: STATUS_LABEL[c.employee.employmentStatus], lastWorkingDay: c.lastWorkingDay })),
    activeListSize: temps.length,
    done: new Set(done.map((d) => d.taskKey)),
  });
}

export interface BpjsListRow {
  id: string;
  name: string;
  status: string;
  section: string;
  nik: string | null;
  birthDate: Date | null;
  bpjsTkNumber: string | null;
}

// All active harian lepas and magang on the first day of the month; whoever leaves before then is not on it.
export async function getMonthlyList(year: number, monthIndex: number): Promise<BpjsListRow[]> {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const [employees, units] = await Promise.all([
    prisma.employee.findMany({
      where: { activeFlag: true, employmentStatus: { in: [...TEMP_STATUSES] } },
      select: {
        id: true,
        fullLegalName: true,
        employmentStatus: true,
        nationalIdNumber: true,
        birthDate: true,
        bpjsEmploymentNumber: true,
        currentPosition: { select: { orgUnitId: true } },
        offboardingCases: { where: { cancelledAt: null }, select: { lastWorkingDay: true } },
      },
      orderBy: { fullLegalName: "asc" },
    }),
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
  ]);
  const tree = buildOrgUnitTree(units);
  return employees
    .filter((e) => !e.offboardingCases.some((c) => c.lastWorkingDay.getTime() < first.getTime()))
    .map((e) => {
      const unitId = e.currentPosition?.orgUnitId;
      return {
        id: e.id,
        name: e.fullLegalName,
        status: STATUS_LABEL[e.employmentStatus],
        section: unitId ? (tree.ancestorChain(unitId).find((u) => u.unitType === "SECTION")?.unitName ?? tree.departmentOf(unitId)?.unitName ?? "—") : "—",
        nik: e.nationalIdNumber,
        birthDate: e.birthDate,
        bpjsTkNumber: e.bpjsEmploymentNumber,
      };
    });
}

export interface MissingStartRow {
  id: string;
  name: string;
  status: string;
  section: string;
}

export async function getMissingStartDates(): Promise<MissingStartRow[]> {
  const [temps, units] = await Promise.all([loadTemps(), prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } })]);
  const tree = buildOrgUnitTree(units);
  return temps
    .filter((e) => !e.startDate)
    .map((e) => {
      const unitId = e.currentPosition?.orgUnitId;
      return { id: e.id, name: e.fullLegalName, status: STATUS_LABEL[e.employmentStatus], section: unitId ? (tree.ancestorChain(unitId).find((u) => u.unitType === "SECTION")?.unitName ?? "—") : "—" };
    });
}

export interface BpjsMark {
  key: string;
  text: string;
  markedAt: Date;
  by: string;
}

const KIND_TEXT: Record<string, string> = {
  REGISTER_NEW: "Didaftarkan BPJS TK",
  MONTHLY_LIST: "Daftar bulanan didaftarkan",
  DEACTIVATE_KES: "BPJS Kesehatan dinonaktifkan",
  DEACTIVATE_TK: "BPJS Ketenagakerjaan dinonaktifkan",
  PAY_KES: "BPJS Kesehatan dibayar",
  PAY_TK: "BPJS Ketenagakerjaan dibayar",
};

// The latest marks, so a mistaken "Sudah" can be taken back.
export async function getRecentMarks(limit = 15): Promise<BpjsMark[]> {
  const marks = await prisma.bpjsTaskDone.findMany({ orderBy: { markedAt: "desc" }, take: limit });
  if (marks.length === 0) return [];
  const employeeIds = marks.filter((m) => m.kind === "REGISTER_NEW").map((m) => m.taskKey.split(":")[1]);
  const caseIds = marks.filter((m) => m.kind === "DEACTIVATE_KES" || m.kind === "DEACTIVATE_TK").map((m) => m.taskKey.split(":")[1]);
  const [employees, cases, accounts] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, fullLegalName: true } }),
    prisma.offboardingCase.findMany({ where: { id: { in: caseIds } }, select: { id: true, employee: { select: { fullLegalName: true } } } }),
    prisma.account.findMany({ where: { id: { in: [...new Set(marks.map((m) => m.markedByAccountId))] } }, select: { id: true, usernameOrEmail: true } }),
  ]);
  const employeeName = new Map(employees.map((e) => [e.id, e.fullLegalName]));
  const caseName = new Map(cases.map((c) => [c.id, c.employee.fullLegalName]));
  const accountName = new Map(accounts.map((a) => [a.id, a.usernameOrEmail]));
  return marks.map((m) => {
    const ref = m.taskKey.split(":")[1];
    const kind = taskKind(m.taskKey);
    let subject = "";
    if (kind === "REGISTER_NEW") subject = employeeName.get(ref) ?? "";
    else if (kind === "DEACTIVATE_KES" || kind === "DEACTIVATE_TK") subject = caseName.get(ref) ?? "";
    else {
      const [y, mo] = ref.split("-").map(Number);
      subject = `${monthName(mo - 1)} ${y}`;
    }
    return { key: m.taskKey, text: `${KIND_TEXT[kind]}${subject ? ` · ${subject}` : ""}`, markedAt: m.markedAt, by: accountName.get(m.markedByAccountId) ?? "—" };
  });
}
