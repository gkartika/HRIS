import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin, isGaAdmin, isRecruitmentAdmin, canListEmployees } from "@/lib/permissions";
import { scheduledDayCountsForRequests } from "@/lib/leave-days";
import { isManagerOfAnyPosition } from "@/lib/manager-scope";
import { getActiveDeptHeadPositions, getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getPendingApprovals, countPendingApprovals, type PendingApprovals } from "@/lib/pending-approvals";
import { t } from "@/lib/i18n/id";
import { AttendanceCheckSection } from "./attendance-check-section";
import { SimpleKaryawanHome } from "./simple-karyawan-home";
import { ApprovalCategory } from "./approval-category";
import { InternalJobsCard } from "./internal-jobs-card";
import { RecruitmentAdminHome } from "./recruitment-admin-home";
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
import { DeptHeadDecisionForm as TrainingDeptHeadDecisionForm } from "../training-requests/[id]/dept-head-decision-form";
import {
  ApproverDecisionButtons as GaNewAssetDecisionButtons,
  LossReviewButtons as GaLossReviewButtons,
} from "../ga-requests/[id]/decision-forms";
import { Suspense } from "react";
import { GaHome } from "./ga-home";
import { HcHome } from "./hc-home";
import type { TodoKind } from "@/lib/ga-home";

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
  const absenceRequests = [
    ...pending.pendingAbsenceHrAdmin,
    ...pending.pendingAbsenceSecondApprover,
    ...pending.pendingAbsenceFirstApprover,
  ];
  const absenceWorkingDays = await scheduledDayCountsForRequests(absenceRequests);
  const [renewalPositions, jobs] = await Promise.all([
    needsRenewalPositions
      ? prisma.position.findMany({
          where: { archived: false },
          include: { job: true, orgUnit: true },
          orderBy: { positionCode: "asc" },
        })
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
              subtitle={`${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)} (${absenceWorkingDays.get(r.id) ?? 0} hari kerja)`}
              href={`/absences/${r.id}`}
            >
              <HrAdminDecisionButtons requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingAbsenceSecondApprover.map((r) => (
            <ApprovalRow
              key={r.id}
              title={`${r.absenceType.label} — ${r.employee.fullLegalName}`}
              subtitle={`${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)} (${absenceWorkingDays.get(r.id) ?? 0} hari kerja)`}
              href={`/absences/${r.id}`}
            >
              <SecondApproverDecisionButtons requestId={r.id} />
            </ApprovalRow>
          ))}
          {pending.pendingAbsenceFirstApprover.map((r) => (
            <ApprovalRow
              key={r.id}
              title={`${r.absenceType.label} — ${r.employee.fullLegalName}`}
              subtitle={`${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)} (${absenceWorkingDays.get(r.id) ?? 0} hari kerja)`}
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
            pending.pendingDeptHeadRequests.length +
            pending.pendingRecruitmentReviews.length +
            pending.pendingRecruitmentInterviews.length
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
          {pending.pendingRecruitmentReviews.map((r) => (
            <ApprovalRow
              key={r.id}
              title={`Nilai ${r.testType.name} — ${r.candidate.fullName}`}
              subtitle="Jawaban tes menunggu penilaian Anda"
              href={`/recruitment/review/${r.id}`}
            >
              <Link href={`/recruitment/review/${r.id}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Baca dan nilai
              </Link>
            </ApprovalRow>
          ))}
          {pending.pendingRecruitmentInterviews.map((i) => (
            <ApprovalRow
              key={i.id}
              title={`Interview — ${i.candidate.fullName}`}
              subtitle={`${i.scheduledAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB, penilaian Anda belum diisi`}
              href={`/recruitment/interview/${i.id}`}
            >
              <Link href={`/recruitment/interview/${i.id}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Isi penilaian
              </Link>
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
              <Link href={`/disposal-cases/${c.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                Setujui
              </Link>
            </ApprovalRow>
          ))}
        </ApprovalCategory>
      </div>
    </div>
  );
}

// Each part of the Beranda loads on its own, so the page shows up at once and
// the slow parts fill in as their data arrives (they also query in parallel,
// instead of one after the other as before).
function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6" aria-busy="true">
      <div className="h-4 w-1/4 rounded bg-slate-200" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

async function PositionCards({ employeeId }: { employeeId: string }) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPosition: { select: { job: { select: { jobTitle: true } }, orgUnit: { select: { unitName: true } } } } },
  });
  if (!employee?.currentPosition) return null;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <StatCard label="Jabatan Saat Ini" value={employee.currentPosition.job.jobTitle} />
      <StatCard label="Unit Organisasi" value={employee.currentPosition.orgUnit.unitName} />
    </div>
  );
}

async function ApprovalsLoader({ session }: { session: Awaited<ReturnType<typeof requireSession>> }) {
  const pending = await getPendingApprovals(session);
  return <ApprovalsSection session={session} pending={pending} />;
}

async function StatCards({ session }: { session: Awaited<ReturnType<typeof requireSession>> }) {
  const isTrainingAdminUser = isTrainingAdmin(session);
  const isGaAdminUser = isGaAdmin(session);
  // Admin SDM has the HcHome board and Admin GA has GaHome; the generic number
  // cards remain only for a Training-Admin account without either.
  if (isHrAdmin(session) || (isGaAdminUser && !isTrainingAdminUser)) return null;
  // Admin Rekrutmen has its own Pelamar block instead of the generic number cards.
  if (isRecruitmentAdmin(session) && !isTrainingAdminUser && !isGaAdminUser) return null;

  const [employeeCount, filledPositions] = await Promise.all([
    canListEmployees(session) ? prisma.employee.count({ where: { activeFlag: true } }) : Promise.resolve(null),
    isTrainingAdminUser ? prisma.position.count({ where: { positionStatus: "FILLED" } }) : Promise.resolve(null),
  ]);

  const cards: { label: string; value: string | number }[] = [];
  if (employeeCount !== null) cards.push({ label: "Total Karyawan Aktif", value: employeeCount });
  if (filledPositions !== null) cards.push({ label: "Posisi Terisi", value: filledPositions });

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} />
      ))}
      {cards.length === 0 && <p className="col-span-full text-sm text-slate-400">Tidak ada data ringkasan untuk peran ini.</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ga?: string }>;
}) {
  const session = await requireSession();
  const roleLabels = session.user.roles.map((r) => t(`roles.${r}`)).join(", ");
  const { ga: gaParam } = await searchParams;
  const gaFilter: TodoKind | "all" = (["ga", "wo", "dp", "of", "st"] as const).find((k) => k === gaParam) ?? "all";

  // Simple Karyawan home: decided from cheap, already-necessary checks only
  // (everything else loads inside its own Suspense section below).
  const isManagerNow = await isManagerOfAnyPosition(session.user.employeeId);
  const isHrAdminUser = isHrAdmin(session);
  const isTrainingAdminUser = isTrainingAdmin(session);
  const isGaAdminUser = isGaAdmin(session);
  const isRecruitmentAdminUser = isRecruitmentAdmin(session);

  if (!isHrAdminUser && !isTrainingAdminUser && !isGaAdminUser && !isRecruitmentAdminUser && !isManagerNow) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">
          {t("nav.dashboard")} — {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Peran: {roleLabels}</p>
      </div>

      {session.user.employeeId && (
        <Suspense fallback={null}>
          <PositionCards employeeId={session.user.employeeId} />
        </Suspense>
      )}

      {session.user.employeeId && (
        <Suspense fallback={<SectionSkeleton rows={1} />}>
          <AttendanceCheckSection employeeId={session.user.employeeId} />
        </Suspense>
      )}

      {session.user.employeeId && (
        <Suspense fallback={null}>
          <InternalJobsCard employeeId={session.user.employeeId} />
        </Suspense>
      )}

      <Suspense fallback={<SectionSkeleton />}>
        <ApprovalsLoader session={session} />
      </Suspense>

      {isGaAdminUser && (
        <Suspense fallback={<SectionSkeleton rows={4} />}>
          <GaHome filter={gaFilter} />
        </Suspense>
      )}

      {isHrAdminUser && (
        <Suspense fallback={<SectionSkeleton rows={4} />}>
          <HcHome />
        </Suspense>
      )}

      {isRecruitmentAdminUser && !isHrAdminUser && (
        <Suspense fallback={<SectionSkeleton rows={3} />}>
          <RecruitmentAdminHome />
        </Suspense>
      )}

      <Suspense fallback={<SectionSkeleton rows={1} />}>
        <StatCards session={session} />
      </Suspense>

    </div>
  );
}
