// Everything the Admin HC Beranda needs: one combined list of what is waiting
// for Admin SDM (the "Perlu ditindak" list, grouped by time in the UI), the
// payroll-period card, the headcount card and the setup warnings. Reads only;
// the caller gates on HR Admin.
import { prisma } from "@/lib/db";
import { companyDateParts, companyToday, companyYear, DAY_MS } from "@/lib/company-time";
import { daysSince, daysUntil, deadlineLabel, deadlineSeverity, waitingLabel, waitingSeverity, type Severity } from "@/lib/ga-home";
import { horizonForDeadline, horizonForWaiting, payrollProgress, type HcTodoRow, type PayrollProgress } from "@/lib/hc-home";
import { computeOnboardingStatus, isOnboardingAssetsComplete, isOnboardingTrainingComplete } from "@/lib/onboarding";
import { formatCutoffParam, previousCutoffPeriod, resolveCutoffPeriod, type CutoffPeriod } from "@/lib/absence-cutoff";
import { getUnresolvedDays } from "@/lib/attendance-reconciliation-queue";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { findVacantPositionsInDepartment } from "@/lib/recruitment-seats";
import { listCandidates, waitingApplicantGroups } from "@/lib/recruitment-queries";
import { ACTIVE_CANDIDATE_STATUSES } from "@/lib/recruitment-candidates";
import { t } from "@/lib/i18n/id";

export interface SetupWarning {
  text: string;
  actionLabel: string;
  href: string;
}

export interface HeadcountSegment {
  code: string;
  label: string;
  count: number;
}

export interface HcHomeData {
  todo: HcTodoRow[];
  payroll: {
    label: string;
    progress: PayrollProgress;
    unresolvedDays: number;
    unresolvedEmployees: number;
    reconciliationHref: string;
    exportHref: string;
  };
  headcount: { active: number; vacantPositions: number; withoutAccount: number; segments: HeadcountSegment[] };
  warnings: SetupWarning[];
}

const EMPLOYMENT_LABEL: Record<string, string> = { PKWTT: "PKWTT", PKWT: "PKWT", HARIAN_LEPAS: "Harian lepas", MAGANG: "Magang" };
const worse = (a: Severity, b: Severity): Severity => (a === "rose" || b === "rose" ? "rose" : a === "amber" || b === "amber" ? "amber" : "slate");

async function unresolvedFor(period: CutoffPeriod) {
  const days = await getUnresolvedDays(period);
  return { days: days.length, employees: new Set(days.map((d) => d.employeeId)).size };
}

export async function getHcHomeData(now: Date = new Date()): Promise<HcHomeData> {
  const today = companyToday(now);
  const period = resolveCutoffPeriod(now);
  const previous = previousCutoffPeriod(period);

  const [
    recruitment,
    onboarding,
    expiringContracts,
    triggeredCases,
    signedContracts,
    decidedCases,
    movements,
    offboarding,
    stuckLeave,
    unresolvedNow,
    unresolvedBefore,
    withoutAccount,
    activeByStatus,
    vacantPositions,
    approverConfigs,
    activeEmployeeUnits,
    orgUnits,
    holidayCounts,
    hrManagerSeats,
    activeCandidates,
  ] = await Promise.all([
    prisma.recruitmentRequest.findMany({
      where: { status: { in: ["APPROVED", "RECRUITMENT_IN_PROGRESS", "PARTIALLY_FILLED"] } },
      select: {
        id: true,
        requestNumber: true,
        requestDate: true,
        approvedAt: true,
        requestedHeadcount: true,
        departmentId: true,
        jobId: true,
        job: { select: { jobTitle: true } },
        department: { select: { unitName: true } },
        _count: { select: { fulfillments: true } },
      },
    }),
    prisma.onboardingCase.findMany({
      where: { cancelledAt: null, completedAt: null },
      select: {
        id: true,
        caseNumber: true,
        createdAt: true,
        plannedStartDate: true,
        contractComplete: true,
        mandatoryMaterialDueDate: true,
        employeeId: true,
        employee: { select: { fullLegalName: true, currentPositionId: true } },
      },
    }),
    prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        endDate: { not: null, lte: new Date(now.getTime() + 91 * DAY_MS) },
        renewalCaseAsCurrentContract: { is: null },
      },
      select: {
        id: true,
        contractNumber: true,
        endDate: true,
        employee: { select: { fullLegalName: true, currentPosition: { select: { orgUnit: { select: { unitName: true } } } } } },
      },
    }),
    prisma.contractRenewalCase.findMany({
      where: { status: "TRIGGERED" },
      select: {
        caseNumber: true,
        triggerDate: true,
        currentContractId: true,
        currentContract: { select: { endDate: true } },
        employee: { select: { fullLegalName: true } },
      },
    }),
    prisma.contract.findMany({
      where: { status: "SIGNED" },
      select: { id: true, contractNumber: true, startDate: true, updatedAt: true, employee: { select: { fullLegalName: true } } },
    }),
    // The HR Manager has decided; what is left for Admin SDM depends on the decision.
    prisma.contractRenewalCase.findMany({
      where: { status: "APPROVED" },
      select: {
        caseNumber: true,
        decisionAt: true,
        currentContractId: true,
        finalRecommendation: true,
        generatedContractId: true,
        offboardingCase: { select: { id: true } },
        linkedMovementRequest: { select: { status: true } },
        employee: { select: { fullLegalName: true } },
      },
    }),
    prisma.movementRequest.findMany({
      where: { status: "APPROVED", implementedAt: null },
      select: {
        id: true,
        requestNumber: true,
        movementType: true,
        decisionAt: true,
        submittedAt: true,
        employee: { select: { fullLegalName: true } },
      },
    }),
    prisma.offboardingCase.findMany({
      where: { status: "PENDING_CLEARANCE" },
      select: {
        id: true,
        caseNumber: true,
        lastWorkingDay: true,
        clearanceDueDate: true,
        gaAssetClearanceConfirmedAt: true,
        employee: { select: { fullLegalName: true } },
      },
    }),
    // Needs a first approver but the unit has none configured, so nobody can ever decide it.
    prisma.absenceRequest.findMany({
      where: { status: "SUBMITTED", firstApproverPositionId: null },
      select: {
        submittedAt: true,
        employee: { select: { currentPosition: { select: { orgUnit: { select: { unitName: true } } } } } },
      },
    }),
    unresolvedFor(period),
    unresolvedFor(previous),
    prisma.employee.count({ where: { activeFlag: true, account: { is: null } } }),
    prisma.employee.groupBy({ by: ["employmentStatus"], where: { activeFlag: true }, _count: { _all: true } }),
    prisma.position.count({ where: { archived: false, positionStatus: "VACANT" } }),
    prisma.absenceApproverConfig.findMany({ select: { orgUnitId: true } }),
    prisma.employee.findMany({
      where: { activeFlag: true, currentPositionId: { not: null } },
      select: { currentPosition: { select: { orgUnitId: true } } },
    }),
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    Promise.all([companyYear(now), companyYear(now) + 1].map((year) =>
      prisma.companyHoliday.count({ where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } })
    )),
    prisma.position.count({ where: { archived: false, grantsHrManagerAccess: true } }),
    listCandidates({ status: { in: ACTIVE_CANDIDATE_STATUSES } }, 400),
  ]);

  const todo: HcTodoRow[] = [];

  // ---- Rekrutmen: approved requests still waiting for people to be hired into them ----
  const readyRequests: { id: string; requestNumber: string; departmentId: string; jobId: string | null; label: string }[] = [];
  for (const r of recruitment) {
    const filled = r._count.fulfillments;
    if (filled >= r.requestedHeadcount) continue;
    const age = daysSince(r.approvedAt ?? r.requestDate, now);
    const label = r.job?.jobTitle ?? r.department.unitName;
    readyRequests.push({ id: r.id, requestNumber: r.requestNumber, departmentId: r.departmentId, jobId: r.jobId, label });
    todo.push({
      kind: "rc",
      type: "Permintaan Tenaga Kerja",
      title: `${label}: ${r.requestedHeadcount - filled} orang lagi`,
      who: `${r.requestNumber} · ${r.department.unitName}`,
      statusLabel: filled > 0 ? `Terisi ${filled} dari ${r.requestedHeadcount}` : "Siap diisi",
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: filled > 0 ? "Buka" : "Buat Karyawan",
      href: `/recruitment/${r.id}`,
      horizon: horizonForWaiting(age),
    });
  }

  // ---- Pelamar: people waiting for Admin SDM (a reviewer to pick, an interview to set, an offer to send ...) ----
  for (const w of waitingApplicantGroups(activeCandidates)) {
    const requestId = w.requestId;
    const age = daysSince(w.oldest, now);
    todo.push({
      kind: "rc",
      type: "Pelamar",
      title: `${w.count} pelamar menunggu tindakan: ${w.label}`,
      who: w.requestNumber,
      statusLabel: w.firstStep,
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: "Buka",
      href: `/recruitment/${requestId}`,
      horizon: horizonForWaiting(age),
    });
  }

  // ---- Onboarding: the contract item is the only one Admin SDM ticks; overdue cases need a nudge ----
  if (onboarding.length > 0) {
    const employeeIds = onboarding.map((c) => c.employeeId);
    const [trainings, custodies] = await Promise.all([
      prisma.learningAssignment.findMany({
        where: { employeeId: { in: employeeIds }, course: { isOnboardingRequired: true } },
        select: { employeeId: true, status: true },
      }),
      prisma.assetCustody.findMany({ where: { employeeId: { in: employeeIds } }, select: { employeeId: true, status: true } }),
    ]);
    const group = (rows: { employeeId: string | null; status: string }[]) => {
      const map = new Map<string, string[]>();
      for (const r of rows) {
        if (!r.employeeId) continue;
        map.set(r.employeeId, [...(map.get(r.employeeId) ?? []), r.status]);
      }
      return map;
    };
    const trainingBy = group(trainings);
    const assetBy = group(custodies);
    for (const c of onboarding) {
      const status = computeOnboardingStatus(
        {
          contractComplete: c.contractComplete,
          mandatoryMaterialComplete: isOnboardingTrainingComplete(trainingBy.get(c.employeeId) ?? [], !!c.employee.currentPositionId),
          assetsComplete: isOnboardingAssetsComplete(assetBy.get(c.employeeId) ?? []),
          plannedStartDate: c.plannedStartDate,
          mandatoryMaterialDueDate: c.mandatoryMaterialDueDate,
        },
        now
      );
      if (status === "COMPLETE") continue;
      if (status === "OVERDUE" && c.mandatoryMaterialDueDate) {
        const left = daysUntil(c.mandatoryMaterialDueDate, now);
        todo.push({
          kind: "ob",
          type: "Onboarding",
          title: `${c.employee.fullLegalName}: onboarding terlambat`,
          who: `${c.caseNumber} · pelatihan wajib belum selesai`,
          statusLabel: "Terlambat",
          severity: "amber",
          urgency: Math.abs(left),
          timeLabel: deadlineLabel(left),
          actionLabel: "Buka kasus",
          href: `/onboarding/${c.id}`,
          horizon: "late",
        });
      } else if (!c.contractComplete) {
        const age = daysSince(c.createdAt, now);
        todo.push({
          kind: "ob",
          type: "Onboarding",
          title: `${c.employee.fullLegalName}: kontrak belum dicentang`,
          who: `${c.caseNumber} · rencana masuk ${c.plannedStartDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" })}`,
          statusLabel: "Kontrak belum dicentang",
          severity: waitingSeverity(age),
          urgency: age,
          timeLabel: waitingLabel(age),
          actionLabel: "Centang kontrak",
          href: `/onboarding/${c.id}`,
          horizon: horizonForWaiting(age),
        });
      }
    }
  }
  if (withoutAccount > 0) {
    todo.push({
      kind: "ob",
      type: "Akun login",
      title: `${withoutAccount} karyawan belum punya akun login`,
      who: "Undangan belum dikirim",
      statusLabel: "Tanpa akun",
      severity: "slate",
      urgency: 0,
      timeLabel: "",
      actionLabel: "Undang semua",
      href: "/employees",
      horizon: "upcoming",
    });
  }

  // ---- Kontrak & perpanjangan ----
  for (const c of expiringContracts) {
    if (!c.endDate) continue;
    const left = daysUntil(c.endDate, now);
    const unit = c.employee.currentPosition?.orgUnit.unitName ?? "—";
    if (left < 0) {
      todo.push({
        kind: "ct",
        type: "Kontrak",
        title: `Kontrak ${c.employee.fullLegalName} sudah berakhir, masih aktif`,
        who: `${c.contractNumber} · ${unit}`,
        statusLabel: "Sudah berakhir",
        severity: "rose",
        urgency: 20 + Math.abs(left),
        timeLabel: deadlineLabel(left),
        actionLabel: "Buka kontrak",
        href: `/contracts/${c.id}`,
        horizon: "late",
      });
    } else if (left <= 30) {
      // The nightly job normally opens the case; until it has, Admin SDM can start it here.
      todo.push({
        kind: "ct",
        type: "Kontrak",
        title: `Kontrak ${c.employee.fullLegalName} berakhir ${left === 0 ? "hari ini" : `${left} hari lagi`}, belum ada evaluasi`,
        who: `${c.contractNumber} · ${unit}`,
        statusLabel: "Evaluasi belum dimulai",
        severity: deadlineSeverity(left),
        urgency: 20 - left,
        timeLabel: deadlineLabel(left),
        actionLabel: "Mulai Evaluasi",
        href: `/contracts/${c.id}`,
        horizon: horizonForDeadline(left),
        startEvaluationContractId: c.id,
      });
    } else {
      todo.push({
        kind: "ct",
        type: "Kontrak",
        title: `Kontrak ${c.employee.fullLegalName} berakhir ${left} hari lagi`,
        who: `${c.contractNumber} · ${unit}`,
        statusLabel: "Akan berakhir",
        severity: "slate",
        urgency: 0,
        timeLabel: deadlineLabel(left),
        actionLabel: "Buka kontrak",
        href: `/contracts/${c.id}`,
        horizon: "upcoming",
      });
    }
  }
  for (const c of triggeredCases) {
    const age = daysSince(c.triggerDate, now);
    const left = c.currentContract.endDate ? daysUntil(c.currentContract.endDate, now) : null;
    todo.push({
      kind: "ct",
      type: "Perpanjangan kontrak",
      title: `Rilis evaluasi perpanjangan ${c.employee.fullLegalName}`,
      who: c.caseNumber,
      statusLabel: "Evaluasi belum dirilis",
      severity: left === null ? waitingSeverity(age) : worse(waitingSeverity(age), deadlineSeverity(left)),
      urgency: age,
      timeLabel: left === null ? waitingLabel(age) : `kontrak ${deadlineLabel(left)}`,
      actionLabel: "Buka kasus",
      href: `/contracts/${c.currentContractId}`,
      horizon: horizonForWaiting(age) === "late" || (left !== null && horizonForDeadline(left) === "late") ? "late" : "today",
    });
  }
  for (const c of signedContracts) {
    const age = daysSince(c.updatedAt, now);
    todo.push({
      kind: "ct",
      type: "Kontrak",
      title: `Kontrak ${c.employee.fullLegalName} sudah ditandatangani: aktifkan`,
      who: c.contractNumber,
      statusLabel: "Siap diaktifkan",
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: "Aktifkan Kontrak",
      href: `/contracts/${c.id}`,
      horizon: horizonForWaiting(age),
    });
  }
  for (const c of decidedCases) {
    const age = c.decisionAt ? daysSince(c.decisionAt, now) : 0;
    const name = c.employee.fullLegalName;
    if (c.finalRecommendation === "TIDAK_DIPERPANJANG") {
      if (c.offboardingCase) continue;
      todo.push({
        kind: "ct",
        type: "Perpanjangan kontrak",
        title: `${name}: kontrak tidak diperpanjang, mulai offboarding`,
        who: c.caseNumber,
        statusLabel: "Belum ada offboarding",
        severity: waitingSeverity(age),
        urgency: age,
        timeLabel: waitingLabel(age),
        actionLabel: "Buat Proses Offboarding",
        href: `/contracts/${c.currentContractId}`,
        horizon: horizonForWaiting(age),
      });
    } else if ((c.finalRecommendation === "MUTASI" || c.finalRecommendation === "DEMOSI") && !c.generatedContractId) {
      // Only once the linked movement has actually been carried out.
      if (c.linkedMovementRequest?.status !== "IMPLEMENTED") continue;
      todo.push({
        kind: "ct",
        type: "Perpanjangan kontrak",
        title: `${name}: buat draf kontrak setelah perubahan posisi`,
        who: c.caseNumber,
        statusLabel: "Draf belum dibuat",
        severity: waitingSeverity(age),
        urgency: age,
        timeLabel: waitingLabel(age),
        actionLabel: "Buka kasus",
        href: `/contracts/${c.currentContractId}`,
        horizon: horizonForWaiting(age),
      });
    }
  }

  // ---- Perubahan posisi: approved, waiting for Admin SDM to carry out ----
  for (const m of movements) {
    const age = daysSince(m.decisionAt ?? m.submittedAt, now);
    todo.push({
      kind: "mv",
      type: `Perubahan Posisi · ${t(`movementType.${m.movementType}`)}`,
      title: `${m.employee.fullLegalName}: disetujui, jalankan`,
      who: m.requestNumber,
      statusLabel: "Disetujui",
      severity: waitingSeverity(age),
      urgency: age,
      timeLabel: waitingLabel(age),
      actionLabel: "Jalankan",
      href: `/movements/${m.id}`,
      horizon: horizonForWaiting(age),
    });
  }

  // ---- Absensi & cuti ----
  if (stuckLeave.length > 0) {
    const oldest = Math.max(...stuckLeave.map((r) => daysSince(r.submittedAt, now)));
    const units = [...new Set(stuckLeave.map((r) => r.employee.currentPosition?.orgUnit.unitName ?? "—"))];
    todo.push({
      kind: "ab",
      type: "Absensi & cuti",
      title: `${stuckLeave.length} pengajuan cuti tertahan: unit belum punya penyetuju`,
      who: units.slice(0, 3).join(", ") + (units.length > 3 ? `, +${units.length - 3} lainnya` : ""),
      statusLabel: "Tanpa penyetuju",
      severity: "rose",
      urgency: 10 + oldest,
      timeLabel: waitingLabel(oldest),
      actionLabel: "Atur penyetuju",
      href: "/admin/absence-settings?tab=penyetuju",
      horizon: "late",
    });
  }
  if (unresolvedBefore.days > 0) {
    todo.push({
      kind: "ab",
      type: "Absensi & cuti",
      title: `${unresolvedBefore.days} hari absensi periode lalu belum diselesaikan`,
      who: `Periode ${previous.label} · ${unresolvedBefore.employees} karyawan`,
      statusLabel: "Periode sudah lewat",
      severity: "rose",
      urgency: 10,
      timeLabel: "lewat batas payroll",
      actionLabel: "Buka Rekonsiliasi",
      href: `/attendance/reconciliation?cutoff=${formatCutoffParam(previous.start)}`,
      horizon: "late",
    });
  }
  const payrollLeft = daysUntil(period.end, now);
  if (unresolvedNow.days > 0) {
    todo.push({
      kind: "ab",
      type: "Absensi & cuti",
      title: `${unresolvedNow.days} hari absensi belum diselesaikan`,
      who: `Periode ${period.label} · ${unresolvedNow.employees} karyawan`,
      statusLabel: "Belum diklasifikasi",
      severity: deadlineSeverity(payrollLeft),
      urgency: 5,
      timeLabel: payrollLeft === 0 ? "batas payroll hari ini" : `${payrollLeft} hari ke batas payroll`,
      actionLabel: "Buka Rekonsiliasi",
      href: `/attendance/reconciliation?cutoff=${formatCutoffParam(period.start)}`,
      horizon: horizonForDeadline(payrollLeft),
    });
  }

  // ---- Offboarding ----
  for (const o of offboarding) {
    const left = daysUntil(o.clearanceDueDate, now);
    const assetsDone = !!o.gaAssetClearanceConfirmedAt;
    todo.push({
      kind: "of",
      type: "Offboarding",
      title: assetsDone ? `${o.employee.fullLegalName}: siap exit clearance` : `${o.employee.fullLegalName}: klirens aset belum selesai`,
      who: `${o.caseNumber} · hari terakhir ${o.lastWorkingDay.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" })}`,
      statusLabel: assetsDone ? "Siap diselesaikan" : "Menunggu klirens aset",
      severity: deadlineSeverity(left),
      urgency: 20 - left,
      timeLabel: deadlineLabel(left),
      actionLabel: assetsDone ? "Selesaikan" : "Buka kasus",
      href: `/offboarding/${o.id}`,
      horizon: horizonForDeadline(left),
    });
  }

  // ---- Setup warnings ----
  const warnings: SetupWarning[] = [];
  const tree = buildOrgUnitTree(orgUnits);
  const configured = new Set(approverConfigs.map((c) => c.orgUnitId));
  const uncoveredDepartments = new Set<string>();
  for (const unitId of new Set(activeEmployeeUnits.map((e) => e.currentPosition?.orgUnitId).filter((id): id is string => !!id))) {
    if (tree.ancestorChain(unitId).some((u) => configured.has(u.id))) continue;
    uncoveredDepartments.add(tree.departmentOf(unitId)?.unitName ?? tree.ancestorChain(unitId)[0]?.unitName ?? "—");
  }
  if (uncoveredDepartments.size > 0) {
    const names = [...uncoveredDepartments];
    warnings.push({
      text: `${names.length} departemen belum punya penyetuju cuti: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ", dan lainnya" : ""}`,
      actionLabel: "Atur",
      href: "/admin/absence-settings?tab=penyetuju",
    });
  }
  if (hrManagerSeats === 0) {
    warnings.push({
      text: "Belum ada posisi dengan akses HR Manager. Tidak ada yang bisa menyetujui rekrutmen, perubahan posisi, atau perpanjangan kontrak.",
      actionLabel: "Atur",
      href: "/admin/positions",
    });
  }
  const year = companyYear(now);
  if (holidayCounts[0] === 0) {
    warnings.push({ text: `Libur & Cuti Bersama ${year} belum diisi`, actionLabel: "Isi", href: "/admin/absence-settings?tab=libur" });
  }
  // From November, next year's calendar is due too.
  if (companyDateParts(now).month >= 11 && holidayCounts[1] === 0) {
    warnings.push({ text: `Libur & Cuti Bersama ${year + 1} belum diisi`, actionLabel: "Isi", href: "/admin/absence-settings?tab=libur" });
  }
  const noSeat = (
    await Promise.all(
      readyRequests.map(async (r) => ((await findVacantPositionsInDepartment(r.departmentId, r.jobId ?? undefined)).length === 0 ? r : null))
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  for (const r of noSeat.slice(0, 3)) {
    warnings.push({
      text: `Tidak ada posisi Kosong untuk ${r.label}, padahal permintaan ${r.requestNumber} siap diisi`,
      actionLabel: "Tambah posisi",
      href: "/admin/positions",
    });
  }
  if (noSeat.length > 3) {
    warnings.push({ text: `Dan ${noSeat.length - 3} permintaan lain tanpa posisi Kosong`, actionLabel: "Buka", href: "/recruitment" });
  }

  const active = activeByStatus.reduce((sum, g) => sum + g._count._all, 0);
  const segments: HeadcountSegment[] = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"].map((code) => ({
    code,
    label: EMPLOYMENT_LABEL[code],
    count: activeByStatus.find((g) => g.employmentStatus === code)?._count._all ?? 0,
  }));

  return {
    todo,
    payroll: {
      label: period.label,
      progress: payrollProgress(period.start, period.end, today),
      unresolvedDays: unresolvedNow.days,
      unresolvedEmployees: unresolvedNow.employees,
      reconciliationHref: `/attendance/reconciliation?cutoff=${formatCutoffParam(period.start)}`,
      exportHref: `/api/attendance/reconciliation-export?cutoff=${formatCutoffParam(period.start)}`,
    },
    headcount: { active, vacantPositions, withoutAccount, segments },
    warnings,
  };
}
