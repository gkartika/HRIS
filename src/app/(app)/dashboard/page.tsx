import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin, isGaAdmin, canListEmployees } from "@/lib/permissions";
import { computeExpiryUrgency, type ExpiryUrgency } from "@/lib/contract";
import { absenceDayCount } from "@/lib/absence";
import { isManagerOfAnyPosition } from "@/lib/manager-scope";
import { getActiveDeptHeadPositions, getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getPendingApprovals, countPendingApprovals, type PendingApprovals } from "@/lib/pending-approvals";
import { t } from "@/lib/i18n/id";
import { TriggerEvaluationButton } from "./trigger-evaluation-button";
import { AttendanceCheckSection } from "./attendance-check-section";
import { SimpleKaryawanHome } from "./simple-karyawan-home";
import { ApprovalCategory } from "./approval-category";
import { FirstApproverDecisionButtons, SecondApproverDecisionButtons, HrAdminDecisionButtons } from "../absences/[id]/decision-forms";
import {
  MovementDecisionButtons,
  DeptHeadDecisionButtons as MovementDeptHeadDecisionButtons,
} from "../movements/[id]/decision-forms";
import {
  DecisionButtons as RecruitmentDecisionButtons,
  DeptHeadDecisionButtons as RecruitmentDeptHeadDecisionButtons,
} from "../recruitment/[id]/decision-forms";
import {
  HrManagerDecisionButtons as RenewalHrManagerDecisionButtons,
  DeptHeadRecommendationForm as RenewalDeptHeadForm,
} from "../contracts/[id]/renewal-decision-forms";
import {
  DecideOffboardingCaseAsDeptHeadForm,
  DecideOffboardingCaseForm,
} from "../offboarding/[id]/decision-forms";
import { DeptHeadDecisionForm as TrainingDeptHeadDecisionForm } from "../training-requests/[id]/dept-head-decision-form";
import {
  ApproverDecisionButtons as GaNewAssetDecisionButtons,
  LossReviewButtons as GaLossReviewButtons,
} from "../ga-requests/[id]/decision-forms";
import { DisposalDecisionButtons } from "../disposal-cases/[id]/decision-forms";

interface ExpiringContractRow {
  id: string;
  contractNumber: string;
  employeeName: string;
  orgUnitId: string | null;
  orgUnitName: string;
  endDate: Date;
  urgency: ExpiryUrgency;
  hasRenewalCase: boolean;
}

type SortKey = "endDate" | "employeeName" | "urgency";

const URGENCY_RANK: Record<ExpiryUrgency, number> = {
  EXPIRED: 0,
  DUE_7: 1,
  DUE_30: 2,
  DUE_60: 3,
  DUE_90: 4,
  NONE: 5,
};

function sortLink(
  baseParams: { orgUnitId?: string; urgency?: string },
  sortBy: SortKey,
  currentSortBy: SortKey,
  currentSortDir: "asc" | "desc"
): string {
  const nextDir = currentSortBy === sortBy && currentSortDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (baseParams.orgUnitId) params.set("orgUnitId", baseParams.orgUnitId);
  if (baseParams.urgency) params.set("urgency", baseParams.urgency);
  params.set("sortBy", sortBy);
  params.set("sortDir", nextDir);
  return `/dashboard?${params.toString()}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-medium text-slate-900">{value}</p>
    </div>
  );
}

function ApprovalRow({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 py-4 first:border-t-0">
      <div>
        <Link href={href} className="text-sm font-semibold text-slate-900 hover:underline">
          {title}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// Renders the "Perlu Persetujuan Anda" section — one ApprovalRow per pending
// item across every source in src/lib/pending-approvals.ts, each mounting
// that module's OWN existing decision-button component (never reimplemented
// here), so a decision made from the Dashboard runs through the exact same
// server action — required rejection reasons and all — as deciding it from
// the item's own detail page.
async function ApprovalsSection({ session, pending }: { session: Awaited<ReturnType<typeof requireSession>>; pending: PendingApprovals }) {
  const total = countPendingApprovals(pending);
  if (total === 0) return null;

  // Dept-Head-tier decision components need "which of my own Positions is
  // deciding this" — resolved per department the acting employee holds
  // Dept Head authority in (almost always exactly one) and reused across
  // every dept-head-tier item below, rather than re-resolved per row.
  const deptHeadPositions = session.user.employeeId
    ? (
        await Promise.all(pending.deptHeadDepartmentIds.map((id) => getActiveDeptHeadPositions(session.user.employeeId, id)))
      ).flat()
    : [];

  const needsRenewalPositions = pending.pendingDeptHeadRenewals.length > 0 || pending.pendingHrManagerRenewals.length > 0;
  const needsJobs = pending.pendingRequests.length > 0;
  const [renewalPositions, jobs] = await Promise.all([
    needsRenewalPositions
      ? prisma.position.findMany({ include: { job: true, orgUnit: true }, orderBy: { positionCode: "asc" } })
      : Promise.resolve([]),
    needsJobs ? prisma.job.findMany({ orderBy: { jobTitle: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="rounded-xl border border-brand-accent bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent-soft text-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-900">Perlu Persetujuan Anda</h2>
        </div>
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-accent">{total} menunggu</span>
      </div>

      <div className="mt-1">
        <ApprovalCategory
          label="Absensi & Cuti"
          count={pending.pendingAbsenceHrAdmin.length + pending.pendingAbsenceFirstApprover.length + pending.pendingAbsenceSecondApprover.length}
        >
          {pending.pendingAbsenceHrAdmin.map((r) => (
            <ApprovalRow
              key={r.id}
              title={`${r.absenceType.label} — ${r.employee.fullLegalName}`}
              subtitle={`${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)} (${absenceDayCount(r.startDate, r.endDate)} hari)`}
              href={`/absences/${r.id}`}
            >
              <HrAdminDecisionButtons requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingAbsenceSecondApprover.map((r) => (
            <ApprovalRow
              key={r.id}
              title={`${r.absenceType.label} — ${r.employee.fullLegalName}`}
              subtitle={`${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)} (${absenceDayCount(r.startDate, r.endDate)} hari)`}
              href={`/absences/${r.id}`}
            >
              <SecondApproverDecisionButtons requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingAbsenceFirstApprover.map((r) => (
            <ApprovalRow
              key={r.id}
              title={`${r.absenceType.label} — ${r.employee.fullLegalName}`}
              subtitle={`${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)} (${absenceDayCount(r.startDate, r.endDate)} hari)`}
              href={`/absences/${r.id}`}
            >
              <FirstApproverDecisionButtons requestId={r.id} />
            </ApprovalRow>
          ))}
        </ApprovalCategory>

        <ApprovalCategory
          label="Rekrutmen & Mutasi"
          count={
            pending.pendingMovements.length +
            pending.pendingDeptHeadMovements.length +
            pending.pendingRequests.length +
            pending.pendingDeptHeadRequests.length
          }
        >
          {pending.pendingMovements.map((m) => (
            <ApprovalRow key={m.id} title={`Perubahan Posisi — ${m.employee.fullLegalName}`} subtitle={m.requestNumber} href={`/movements/${m.id}`}>
              <MovementDecisionButtons requestId={m.id} positions={pending.hrManagerPositions} />
            </ApprovalRow>
          ))}
          {pending.pendingDeptHeadMovements.map((m) => (
            <ApprovalRow key={m.id} title={`Perubahan Posisi — ${m.employee.fullLegalName}`} subtitle={`${m.requestNumber} (Kepala Departemen)`} href={`/movements/${m.id}`}>
              <MovementDeptHeadDecisionButtons requestId={m.id} positions={deptHeadPositions} />
            </ApprovalRow>
          ))}
          {pending.pendingRequests.map((r) => (
            <ApprovalRow key={r.id} title={`Rekrutmen — ${r.job?.jobTitle ?? r.department.unitName}`} subtitle={r.requestNumber} href={`/recruitment/${r.id}`}>
              <RecruitmentDecisionButtons requestId={r.id} positions={pending.hrManagerPositions} jobs={jobs} defaultJobId={r.jobId} />
            </ApprovalRow>
          ))}
          {pending.pendingDeptHeadRequests.map((r) => (
            <ApprovalRow key={r.id} title={`Rekrutmen — ${r.job?.jobTitle ?? r.department.unitName}`} subtitle={`${r.requestNumber} (Kepala Departemen)`} href={`/recruitment/${r.id}`}>
              <RecruitmentDeptHeadDecisionButtons requestId={r.id} positions={deptHeadPositions} />
            </ApprovalRow>
          ))}
        </ApprovalCategory>

        <ApprovalCategory
          label="Kontrak & Evaluasi"
          count={pending.pendingDeptHeadRenewals.length + pending.pendingHrManagerRenewals.length + pending.pendingOwnEvaluations.length}
        >
          {pending.pendingDeptHeadRenewals.map((c) => (
            <ApprovalRow key={c.id} title={`Evaluasi Perpanjangan — ${c.employee.fullLegalName}`} subtitle={`${c.caseNumber} (Rekomendasi Kepala Departemen)`} href={`/contracts/${c.currentContractId}`}>
              <RenewalDeptHeadForm
                caseId={c.id}
                positions={renewalPositions}
                decisionPositions={deptHeadPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
              />
            </ApprovalRow>
          ))}
          {pending.pendingHrManagerRenewals.map((c) => (
            <ApprovalRow key={c.id} title={`Evaluasi Perpanjangan — ${c.employee.fullLegalName}`} subtitle={c.caseNumber} href={`/contracts/${c.currentContractId}`}>
              <RenewalHrManagerDecisionButtons
                caseId={c.id}
                positions={renewalPositions}
                decisionPositions={pending.hrManagerPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
                deptHeadRecommendation={c.deptHeadRecommendation}
              />
            </ApprovalRow>
          ))}
          {pending.pendingOwnEvaluations.map((e) => (
            <ApprovalRow key={e.id} title={`Evaluasi — ${e.employee.fullLegalName}`} subtitle={e.evaluationNumber} href={`/evaluations/${e.id}`}>
              <Link href={`/evaluations/${e.id}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Isi Sekarang
              </Link>
            </ApprovalRow>
          ))}
        </ApprovalCategory>

        <ApprovalCategory label="Offboarding" count={pending.pendingDeptHeadOffboarding.length + pending.pendingHrManagerOffboarding.length}>
          {pending.pendingDeptHeadOffboarding.map((c) => (
            <ApprovalRow key={c.id} title={`Offboarding — ${c.employee.fullLegalName}`} subtitle={`${c.caseNumber} (Kepala Departemen)`} href={`/offboarding/${c.id}`}>
              <DecideOffboardingCaseAsDeptHeadForm
                caseId={c.id}
                decisionPositions={deptHeadPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
              />
            </ApprovalRow>
          ))}
          {pending.pendingHrManagerOffboarding.map((c) => (
            <ApprovalRow key={c.id} title={`Offboarding — ${c.employee.fullLegalName}`} subtitle={c.caseNumber} href={`/offboarding/${c.id}`}>
              <DecideOffboardingCaseForm
                caseId={c.id}
                decisionPositions={pending.hrManagerPositions.map((p) => ({ positionId: p.positionId, positionCode: p.positionCode, jobTitle: p.jobTitle }))}
              />
            </ApprovalRow>
          ))}
        </ApprovalCategory>

        <ApprovalCategory
          label="Pelatihan & Kompetensi"
          count={pending.pendingDeptHeadTrainingRequests.length + pending.pendingCompetencyAssessments.length + pending.pendingEffectivenessTasks.length}
        >
          {pending.pendingDeptHeadTrainingRequests.map((r) => (
            <ApprovalRow key={r.id} title={`Permintaan Pelatihan — ${r.employee.fullLegalName}`} subtitle={r.requestedTopic} href={`/training-requests/${r.id}`}>
              <TrainingDeptHeadDecisionForm requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingCompetencyAssessments.map((a) => (
            <ApprovalRow key={a.id} title={`Penilaian Kompetensi — ${a.employee.fullLegalName}`} subtitle={a.cycle.periodLabel} href={`/competency/assessments/${a.id}`}>
              <Link href={`/competency/assessments/${a.id}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Isi Sekarang
              </Link>
            </ApprovalRow>
          ))}
          {pending.pendingEffectivenessTasks.map((task) => (
            <ApprovalRow key={task.id} title={`Evaluasi Efektivitas — ${task.employee.fullLegalName}`} subtitle={task.course.title} href="/training/effectiveness-tasks">
              <Link href="/training/effectiveness-tasks" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Isi Sekarang
              </Link>
            </ApprovalRow>
          ))}
        </ApprovalCategory>

        <ApprovalCategory
          label="Aset & GA"
          count={pending.pendingGaNewAssetNeeds.length + pending.pendingGaLossReviews.length + pending.pendingGaDisposals.length}
        >
          {pending.pendingGaNewAssetNeeds.map((r) => (
            <ApprovalRow key={r.id} title={`Kebutuhan Aset Baru — ${r.requester.fullLegalName}`} subtitle={r.requestNumber} href={`/ga-requests/${r.id}`}>
              <GaNewAssetDecisionButtons requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingGaLossReviews.map((r) => (
            <ApprovalRow key={r.id} title={`Peninjauan Kehilangan — ${r.requester.fullLegalName}`} subtitle={r.requestNumber} href={`/ga-requests/${r.id}`}>
              <GaLossReviewButtons requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingGaDisposals.map((c) => (
            <ApprovalRow key={c.id} title={`Disposal — ${c.asset.assetName}`} subtitle={c.asset.assetCode} href={`/disposal-cases/${c.id}`}>
              <DisposalDecisionButtons caseId={c.id} />
            </ApprovalRow>
          ))}
        </ApprovalCategory>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ orgUnitId?: string; urgency?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await requireSession();
  const roleLabels = session.user.roles.map((r) => t(`roles.${r}`)).join(", ");
  const { orgUnitId, urgency, sortBy: sortByParam, sortDir: sortDirParam } = await searchParams;
  const sortBy: SortKey = sortByParam === "employeeName" || sortByParam === "urgency" ? sortByParam : "endDate";
  const sortDir: "asc" | "desc" = sortDirParam === "desc" ? "desc" : "asc";

  // Simple Karyawan home: decided from cheap, already-necessary checks only.
  // Performance: this used to call the FULL getPendingApprovals (~20 DB
  // queries) just to read 2 booleans off it, then throw the rest away — and
  // then call it AGAIN below for the real data. Now it only runs the 2
  // cheap lookups those booleans actually depend on, and getPendingApprovals
  // itself is called at most once per request.
  const isManagerNow = await isManagerOfAnyPosition(session.user.employeeId);
  const isHrAdminUser = isHrAdmin(session);
  const isTrainingAdminUser = isTrainingAdmin(session);
  const isGaAdminUser = isGaAdmin(session);

  if (!isHrAdminUser && !isTrainingAdminUser && !isGaAdminUser && !isManagerNow) {
    const [hrManagerPositions, deptHeadDepartmentIds] = await Promise.all([
      getActiveHrManagerPositions(session.user.employeeId),
      getDeptHeadDepartmentIds(session.user.employeeId),
    ]);
    // A plain employee who also happens to hold HR Manager/Dept Head
    // authority still needs the full approvals section — fall through
    // instead of the simple home.
    if (hrManagerPositions.length === 0 && deptHeadDepartmentIds.length === 0 && session.user.employeeId) {
      return <SimpleKaryawanHome employeeId={session.user.employeeId} userName={session.user.name ?? ""} />;
    }
  }

  const pending = await getPendingApprovals(session);

  const cards: { label: string; value: string | number }[] = [];

  // Performance note: every section below used to be a separate `await`,
  // run one after another even though none of them depend on each other's
  // results — on a serverless+pooled-Postgres deploy each round trip adds
  // real latency, so a page with 6+ independent query groups paid for all
  // of them back-to-back. Fired together in one Promise.all instead; total
  // wait is now bounded by the single slowest query, not the sum of all of
  // them. Card-push order below still matches the original section order.
  const [employeeCount, hrAdminData, filledPositions, gaAssetCounts, gaOpenCounts, employee] = await Promise.all([
    canListEmployees(session) ? prisma.employee.count({ where: { activeFlag: true } }) : Promise.resolve(null),
    isHrAdminUser
      ? Promise.all([
          prisma.position.count({ where: { positionStatus: "VACANT" } }),
          prisma.importBatch.count(),
          prisma.auditLog.count(),
          // DEPARTMENT-only — feeds the "Departemen" filter on the
          // expiring-contracts table below, which must not list Section/
          // Group/Team-tier units (ORG-01 depth work).
          prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
          prisma.contract.findMany({
            where: {
              status: "ACTIVE",
              endDate: { not: null },
              ...(orgUnitId ? { employee: { currentPosition: { orgUnitId } } } : {}),
            },
            include: {
              employee: { include: { currentPosition: { include: { orgUnit: true } } } },
              renewalCaseAsCurrentContract: { select: { id: true } },
            },
          }),
        ])
      : Promise.resolve(null),
    isTrainingAdminUser || isGaAdminUser ? prisma.position.count({ where: { positionStatus: "FILLED" } }) : Promise.resolve(null),
    isGaAdminUser
      ? Promise.all([
          prisma.fixedAsset.count({ where: { activeFlag: true } }),
          prisma.fixedAsset.count({ where: { activeFlag: true, status: "IN_USE" } }),
          prisma.assetCustody.count({ where: { status: "ACTIVE" } }),
          prisma.fixedAsset.count({ where: { activeFlag: true, status: "UNDER_REPAIR" } }),
        ])
      : Promise.resolve(null),
    isGaAdminUser
      ? Promise.all([
          prisma.gaRequest.count({ where: { status: { in: ["SUBMITTED", "PENDING_APPROVAL", "PENDING_LOSS_REVIEW"] } } }),
          prisma.maintenanceWorkOrder.count({ where: { status: "OPEN" } }),
          prisma.disposalCase.count({ where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } } }),
        ])
      : Promise.resolve(null),
    session.user.employeeId
      ? prisma.employee.findUnique({
          where: { id: session.user.employeeId },
          include: { currentPosition: { include: { job: true, orgUnit: true } } },
        })
      : Promise.resolve(null),
  ]);

  if (employeeCount !== null) {
    cards.push({ label: "Total Karyawan Aktif", value: employeeCount });
  }
  let expiringContracts: ExpiringContractRow[] = [];
  let orgUnits: { id: string; unitName: string }[] = [];
  if (hrAdminData) {
    const [vacantPositions, importBatches, auditEvents, orgUnitsResult, contracts] = hrAdminData;
    cards.push({ label: "Posisi Kosong", value: vacantPositions });
    cards.push({ label: "Riwayat Impor", value: importBatches });
    cards.push({ label: "Total Peristiwa Audit", value: auditEvents });

    orgUnits = orgUnitsResult;

    expiringContracts = contracts
      .map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        employeeName: c.employee.fullLegalName,
        orgUnitId: c.employee.currentPosition?.orgUnitId ?? null,
        orgUnitName: c.employee.currentPosition?.orgUnit.unitName ?? "—",
        endDate: c.endDate!,
        urgency: computeExpiryUrgency(c.status, c.endDate),
        hasRenewalCase: !!c.renewalCaseAsCurrentContract,
      }))
      .filter((row) => row.urgency !== "NONE")
      .filter((row) => {
        if (!urgency) return true;
        if (urgency === "DUE_30") return row.urgency === "DUE_30" || row.urgency === "DUE_7" || row.urgency === "EXPIRED";
        if (urgency === "DUE_60") return URGENCY_RANK[row.urgency] <= URGENCY_RANK.DUE_60;
        if (urgency === "DUE_90") return URGENCY_RANK[row.urgency] <= URGENCY_RANK.DUE_90;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "employeeName") cmp = a.employeeName.localeCompare(b.employeeName);
        else if (sortBy === "urgency") cmp = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        else cmp = a.endDate.getTime() - b.endDate.getTime();
        return sortDir === "desc" ? -cmp : cmp;
      });
  }
  if (filledPositions !== null) {
    cards.push({ label: "Posisi Terisi", value: filledPositions });
  }
  if (gaAssetCounts) {
    const [totalAssets, inUseAssets, activeCustodies, underRepair] = gaAssetCounts;
    cards.push({ label: "Total Aset Aktif", value: totalAssets });
    cards.push({ label: "Sedang Digunakan", value: inUseAssets });
    cards.push({ label: "Total Penguasaan Aktif", value: activeCustodies });
    cards.push({ label: "Dalam Perbaikan", value: underRepair });
  }
  if (gaOpenCounts) {
    const [openGaRequests, openWorkOrders, openDisposalCases] = gaOpenCounts;
    cards.push({ label: "Permintaan GA Terbuka", value: openGaRequests });
    cards.push({ label: "Work Order Terbuka", value: openWorkOrders });
    cards.push({ label: "Kasus Disposal Aktif", value: openDisposalCases });
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">
          {t("nav.dashboard")} — {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Peran: {roleLabels}</p>
      </div>

      {employee?.currentPosition && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Jabatan Saat Ini" value={employee.currentPosition.job.jobTitle} />
          <StatCard label="Unit Organisasi" value={employee.currentPosition.orgUnit.unitName} />
        </div>
      )}

      {session.user.employeeId && <AttendanceCheckSection employeeId={session.user.employeeId} />}

      <ApprovalsSection session={session} pending={pending} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
        {cards.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">Tidak ada data ringkasan untuk peran ini.</p>
        )}
      </div>

      {isHrAdminUser && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-900">{t("dashboard.expiringContractsTitle")}</p>

          <form className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("employee.department")}</label>
              <select
                name="orgUnitId"
                defaultValue={orgUnitId ?? ""}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">{t("common.allOption")}</option>
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t("dashboard.urgencyFilterLabel")}</label>
              <select
                name="urgency"
                defaultValue={urgency ?? ""}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">{t("dashboard.urgencyFilterAny")}</option>
                <option value="DUE_30">{t("dashboard.urgencyFilterThisMonth")}</option>
                <option value="DUE_60">{t("dashboard.urgencyFilterDue60")}</option>
                <option value="DUE_90">{t("dashboard.urgencyFilterDue90")}</option>
              </select>
            </div>
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              {t("common.applyFilter")}
            </button>
            {(orgUnitId || urgency) && (
              <Link href="/dashboard" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-700">
                {t("common.resetFilter")}
              </Link>
            )}
          </form>

          {expiringContracts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{t("dashboard.expiringContractsEmpty")}</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <Link href={sortLink({ orgUnitId, urgency }, "employeeName", sortBy, sortDir)} className="hover:underline">
                        {t("dashboard.sortEmployeeName")} {sortBy === "employeeName" && (sortDir === "asc" ? "↑" : "↓")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 font-medium">{t("employee.department")}</th>
                    <th className="px-4 py-3 font-medium">{t("contract.contractNumber")}</th>
                    <th className="px-4 py-3 font-medium">
                      <Link href={sortLink({ orgUnitId, urgency }, "endDate", sortBy, sortDir)} className="hover:underline">
                        {t("dashboard.sortEndDate")} {sortBy === "endDate" && (sortDir === "asc" ? "↑" : "↓")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <Link href={sortLink({ orgUnitId, urgency }, "urgency", sortBy, sortDir)} className="hover:underline">
                        {t("dashboard.sortUrgency")} {sortBy === "urgency" && (sortDir === "asc" ? "↑" : "↓")}
                      </Link>
                    </th>
                    <th className="px-4 py-3 font-medium">{t("dashboard.evaluationColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringContracts.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-600">{row.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.orgUnitName}</td>
                      <td className="px-4 py-3">
                        <Link href={`/contracts/${row.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {row.contractNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(row.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            row.urgency === "EXPIRED" || row.urgency === "DUE_7"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {t(`expiryUrgency.${row.urgency}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.hasRenewalCase ? (
                          <Link href={`/contracts/${row.id}`} className="text-xs text-indigo-600 hover:underline">
                            {t("dashboard.viewRenewalCase")}
                          </Link>
                        ) : (
                          <TriggerEvaluationButton contractId={row.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
