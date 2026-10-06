import { requireSession } from "@/lib/require-session";
import {
  isHrAdmin,
  isTrainingAdmin,
  isGaAdmin,
  canSubmitRecruitmentRequest,
  canViewOnboarding,
  canManageCompetencyFramework,
  canViewAssetMaster,
  canManageAssets,
  canManageGaOperations,
  canManageConsumables,
  canSubmitGaRequest,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { getActiveAssignmentsOf } from "@/lib/active-assignments";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { LogoutButton } from "./logout-button";
import { AppShell } from "./app-shell";
import { SidebarNav, type SidebarNavGroup, type SidebarNavItem } from "./sidebar-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const canSeeEmployees = isHrAdmin(session) || isTrainingAdmin(session) || isGaAdmin(session);
  // Performance: this layout runs on every single page in the app, so these
  // 3 independent authority lookups (none depends on another's result) are
  // fired together instead of one-after-another — same reasoning as the
  // dashboard/employees query parallelization from the earlier perf pass.
  // - ACC-14/DEC-015: HR Manager, derived live from an active Position
  //   Assignment — never cached in the session/JWT — so access ends
  //   automatically the moment the Assignment's effectiveTo passes.
  // - New Shift Assignment module: Level-3 (3A/3B) submit eligibility,
  //   same as Perubahan Posisi.
  // - COM-10/COM-15: Director gap-report/P1 authority, resolved live from
  //   the org root Position's active Assignment.
  const [hrManagerPositions, level3DepartmentIds, myAssignments, ownOffboardingCase] = await Promise.all([
    getActiveHrManagerPositions(session.user.employeeId),
    getLevel3DepartmentIds(session.user.employeeId),
    getActiveAssignmentsOf(session.user.employeeId),
    // A leaving employee only gets the Offboarding entry once HR opened a case
    // for them — read in parallel with the rest instead of after them.
    session.user.employeeId && !isHrAdmin(session)
      ? prisma.offboardingCase.findFirst({
          where: { employeeId: session.user.employeeId, status: { not: "CANCELLED" } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  const isHrManagerNow = hrManagerPositions.length > 0;
  const isLevel3Anywhere = level3DepartmentIds.length > 0;
  // Director = holder of the single root DIRECTOR position (ORG-15/DEC-011),
  // read from this employee's own assignments — no company-wide lookup.
  const isDirectorAnywhere = myAssignments.some(
    (a) => a.position.positionType === "DIRECTOR" && !a.position.reportsToPositionId
  );

  // Categorized sidebar: every visibility condition below is unchanged from
  // before — each item is just tagged into one of 8 buckets instead of one
  // flat list. A bucket that ends up empty for this session is dropped
  // entirely below, so a plain employee's sidebar stays short with no extra
  // logic beyond "this array happened to stay empty."
  const topItems: SidebarNavItem[] = [{ href: "/dashboard", label: t("nav.dashboard"), icon: "LayoutDashboard" }];
  const bottomItems: SidebarNavItem[] = [];
  const buckets: Record<
    "saya" | "karyawanOrg" | "rekrutmenMutasi" | "absensiCuti" | "pelatihanKompetensi" | "asetGa" | "laporanAudit",
    SidebarNavItem[]
  > = {
    saya: [],
    karyawanOrg: [],
    rekrutmenMutasi: [],
    absensiCuti: [],
    pelatihanKompetensi: [],
    asetGa: [],
    laporanAudit: [],
  };

  if (session.user.employeeId) {
    buckets.saya.push({ href: "/profile", label: t("nav.myProfile"), icon: "UserCircle" });
  }
  if (canSeeEmployees) {
    buckets.karyawanOrg.push({ href: "/employees", label: t("nav.employees"), icon: "Users" });
  }
  // Per direct request: Struktur Organisasi is now HR-Admin-only sidebar
  // real estate — was previously unconditional for every employee-linked
  // account.
  if (isHrAdmin(session)) {
    buckets.karyawanOrg.push({ href: "/organization", label: t("nav.organization"), icon: "Building2" });
  }
  if (canSubmitRecruitmentRequest(session)) {
    buckets.rekrutmenMutasi.push({ href: "/recruitment", label: t("recruitment.navLabel"), icon: "FileText" });
  }
  // LIF-04: same broad visibility as Recruitment — any employee-linked
  // account can see the list (scoped to their own cases) or HR Admin (sees
  // all); actually submitting a request is separately gated per-employee by
  // canSubmitMovementRequest on the /movements/new page itself.
  if (isHrAdmin(session) || session.user.employeeId) {
    buckets.rekrutmenMutasi.push({ href: "/movements", label: t("movement.navLabel"), icon: "ArrowLeftRight" });
  }
  // LIF-03: "Admin shared" visibility — HR/Training/GA Admin plus the active
  // HR Manager, never a plain self-view (unlike Employee Master).
  if (canViewOnboarding(session, hrManagerPositions.map((p) => p.positionId))) {
    buckets.rekrutmenMutasi.push({ href: "/onboarding", label: t("onboarding.navLabel"), icon: "ClipboardCheck" });
  }
  // Contracts and Evaluations dropped from the sidebar entirely, per direct
  // request: a Contract is reachable from its Employee's own page (list +
  // "Buat Kontrak Baru" there), and an Evaluation task shows up as a
  // Dashboard approval item (linking straight to its form) instead of a
  // standing nav entry nobody needs most days — see pending-approvals.ts's
  // pendingOwnEvaluations and dashboard/page.tsx's "Kontrak & Evaluasi"
  // approval category.
  if (session.user.employeeId) {
    buckets.saya.push({ href: "/my-evaluations", label: t("evaluation.myEvaluationsTitle"), icon: "FileSignature" });
  }
  // Offboarding is opened by HR Admin alone; a leaving employee only gets the
  // entry once HR has opened a case for them.
  if (isHrAdmin(session)) {
    buckets.rekrutmenMutasi.push({ href: "/offboarding", label: t("offboarding.navLabel"), icon: "UserMinus" });
  } else if (ownOffboardingCase) {
    buckets.rekrutmenMutasi.push({ href: "/offboarding", label: t("offboarding.navLabel"), icon: "UserMinus" });
  }
  // New Shift Assignment module, per direct user request — HR Admin or any
  // active Level-3 (3A/3B) holder (same eligibility as Perubahan Posisi
  // submission); a plain employee with no Level-3 position has nothing to
  // do on this page.
  if (isHrAdmin(session) || isLevel3Anywhere) {
    buckets.absensiCuti.push({ href: "/shift-assignments", label: t("shiftAssignment.navLabel"), icon: "CalendarClock" });
  }
  // Version after UAT: self-service Mobile check-in/out moved onto Beranda
  // (dashboard) directly — no separate nav item/page anymore.
  // Rekap Absensi dropped entirely, per direct request — Rekonsiliasi
  // Absensi (below) already covers everything it did.
  // Rekonsiliasi Absensi (Opsi A exception queue + Opsi B full grid), per
  // direct request — HR-Admin-only, same as the rest of Absensi & Cuti now.
  if (isHrAdmin(session)) {
    buckets.absensiCuti.push({ href: "/attendance/reconciliation", label: "Rekonsiliasi Absensi", icon: "ListChecks" });
  }
  // Absence (Cuti/Izin/Sakit/Lainnya) list/detail — per direct request,
  // narrowed to HR Admin only (was HR Admin or any employee-linked account,
  // who could browse and decide their own configured approvals here). A
  // plain Karyawan now only gets the "Ajukan Cuti" submit link below, under
  // Saya — approving/deciding someone else's request is no longer nav-
  // reachable for non-HR-Admin, only via the Dashboard's approval card.
  if (isHrAdmin(session)) {
    buckets.absensiCuti.push({ href: "/absences", label: t("absence.navLabel"), icon: "CalendarOff" });
  }
  if (session.user.employeeId) {
    buckets.saya.push({ href: "/absences/new", label: t("absence.newRequest"), icon: "CalendarOff" });
  }
  // ACC-15/DSH-13: the personal HR Manager workspace — separate from the HR
  // Admin operational nav below, and only visible while the login currently
  // holds an active HR Manager Position.
  if (isHrManagerNow) {
    buckets.saya.push({ href: "/my-positions", label: t("nav.myPositions"), icon: "Briefcase" });
    buckets.saya.push({ href: "/hr-dashboard", label: t("nav.hrManagerDashboard"), icon: "LayoutDashboard" });
    buckets.saya.push({ href: "/hr-reports", label: t("nav.hrReports"), icon: "BarChart3" });
  }
  if (isHrAdmin(session)) {
    bottomItems.push({ href: "/admin", label: "Pengaturan", icon: "Settings" });
    buckets.laporanAudit.push({ href: "/audit-log", label: t("nav.auditLog"), icon: "ShieldCheck" });
  }
  // "Report 2026" replacement — weekly mandays-lost report per direct
  // request, HR-Admin-only same as the rest of Absensi & Cuti/Laporan.
  if (isHrAdmin(session)) {
    buckets.laporanAudit.push({ href: "/attendance/mandays-lost", label: "Mandays Lost", icon: "TrendingDown" });
  }
  // Phase 3B: Training Admin also reaches the shared import hub now, solely
  // for the mandatory-training-participants/training-attendance datasets
  // (import/page.tsx filters which upload forms each role actually sees).
  if (isHrAdmin(session) || isTrainingAdmin(session)) {
    buckets.laporanAudit.push({ href: "/import", label: t("nav.importData"), icon: "Upload" });
  }
  // ACC-03: Training & Competency Admin needs this master-data browse even
  // without HR Admin's broader org-structure access — a separate nav entry
  // rather than nested under the HR-Admin-only /admin section above.
  if (canManageCompetencyFramework(session)) {
    buckets.pelatihanKompetensi.push({ href: "/admin/competency", label: t("competencyAdmin.navLabel"), icon: "GraduationCap" });
  }
  // COM-06/ACC-21: cycle operations, Training Admin only — a pending P1/P2
  // scoring task for anyone else now shows up as a Dashboard approval item
  // (linking straight to the assessment's own form) instead of granting a
  // standing sidebar link to the whole cycle list.
  if (isTrainingAdmin(session)) {
    buckets.pelatihanKompetensi.push({ href: "/competency", label: t("competencyAdmin.cycleNavLabel"), icon: "GraduationCap" });
  }
  // COM-10: Department Level 3 gets its Department's gap report, the
  // Director gets the Level-3 gap report — same broad-visibility-then-
  // page-scoped pattern as every other report in this app. HR Admin
  // withdrawn from the whole Training & Competency domain, 2026-08-18.
  if (isTrainingAdmin(session) || isLevel3Anywhere || isDirectorAnywhere) {
    buckets.pelatihanKompetensi.push({ href: "/competency/gaps", label: t("competencyAdmin.gapsNavLabel"), icon: "GraduationCap" });
  }
  if (session.user.employeeId) {
    buckets.saya.push({ href: "/competency/my", label: t("competencyAdmin.myNavLabel"), icon: "GraduationCap" });
  }
  // Phase 3B: self-service materials/quiz/certificate view, scoped to the
  // signed-in Employee's own LearningAssignment rows only (see
  // canViewLearningAssignment/canTakeQuiz) — every employee-linked account
  // gets this link, same as My Competency above.
  if (session.user.employeeId) {
    buckets.saya.push({ href: "/training/my-learning", label: t("training.myLearningNavLabel"), icon: "GraduationCap" });
  }
  // TRN-09/ACC-22: same broad list-nav visibility as Contract/Movement/
  // Absence — Training Admin, or any employee-linked account (who may
  // submit for self, or for their Department if Level 3), scoped further
  // on the list page itself. HR Admin withdrawn, 2026-08-18.
  if (isTrainingAdmin(session) || session.user.employeeId) {
    buckets.pelatihanKompetensi.push({ href: "/training-requests", label: t("trainingRequest.navLabel"), icon: "GraduationCap" });
  }
  if (isTrainingAdmin(session)) {
    buckets.pelatihanKompetensi.push({ href: "/training/courses", label: t("training.coursesNavLabel"), icon: "GraduationCap" });
    buckets.pelatihanKompetensi.push({ href: "/training/mandatory-rules", label: t("training.mandatoryRulesNavLabel"), icon: "GraduationCap" });
  }
  // Per direct request: only Training Admin actually manages this page —
  // every action button was already hidden for Manager/HR Manager (TRN-13/
  // ACC-23, they only ever got a read-only reporting view), so it's dropped
  // from their sidebar entirely rather than kept as a link with nothing to
  // do on it.
  if (isTrainingAdmin(session)) {
    buckets.pelatihanKompetensi.push({ href: "/training/learning-assignments", label: t("training.learningAssignmentsNavLabel"), icon: "GraduationCap" });
  }
  // TRN-04/TRN-07: Training Admin keeps the company-wide queue (ACC-22); a
  // supervisor's own D+30 task now shows up as a Dashboard approval item
  // (linking straight to this page, where their form renders) instead of a
  // standing sidebar link most days nobody has anything to do on.
  if (isTrainingAdmin(session)) {
    buckets.pelatihanKompetensi.push({ href: "/training/effectiveness-tasks", label: t("training.effectivenessTasksNavLabel"), icon: "GraduationCap" });
  }
  // Phase 4A access boundary: GA Admin operates the Asset Master/custody
  // records — HR Admin deliberately gets no nav entry here, only the
  // read-only completion/blocker status folded into Onboarding/Offboarding
  // pages it already reaches.
  if (canViewAssetMaster(session)) {
    buckets.asetGa.push({ href: "/assets", label: t("asset.navLabel"), icon: "Package" });
  }
  // Per direct user request: GA Admin needs to know who's currently
  // offboarding so they can proactively confirm asset returns — scoped to
  // just that (employee/case number/open custody/open GA requests), never
  // the full Offboarding case (reason, decisions, notes stay HR-only).
  if (canManageAssets(session)) {
    buckets.asetGa.push({ href: "/offboarding/asset-clearance", label: "Klirens Aset Offboarding", icon: "UserMinus" });
  }
  // Employee self-service — see only one's own assets, same broad
  // employee-linked-account visibility as My Competency/My Learning above.
  if (session.user.employeeId) {
    buckets.saya.push({ href: "/my-assets", label: t("asset.myAssetsNavLabel"), icon: "Package" });
  }
  // Phase 4B: GA Operations. /ga-requests is reachable by any
  // employee-linked account (self-service submit/view-own, same as
  // /my-assets) or GA Admin (full queue) — "Requester sees only own
  // requests" is enforced on the page itself. Maintenance and Disposal
  // Cases are GA-Admin-only mutation surfaces (HR Admin deliberately gets
  // no nav entry here, same access boundary as Asset Master above).
  if (canManageGaOperations(session) || canSubmitGaRequest(session)) {
    buckets.asetGa.push({ href: "/ga-requests", label: t("gaRequest.navLabel"), icon: "Package" });
  }
  if (canManageGaOperations(session)) {
    buckets.asetGa.push({ href: "/maintenance/plans", label: t("maintenance.plansNavLabel"), icon: "Wrench" });
    buckets.asetGa.push({ href: "/maintenance/work-orders", label: t("maintenance.workOrdersNavLabel"), icon: "Wrench" });
    buckets.asetGa.push({ href: "/disposal-cases", label: t("disposalCase.navLabel"), icon: "Trash2" });
  }
  // Consumables (APD/ATK): GA-Admin-only back-office ledger — no employee-
  // facing entry anywhere, and HR Admin deliberately gets none either.
  if (canManageConsumables(session)) {
    buckets.asetGa.push({ href: "/consumables", label: t("consumable.navLabel"), icon: "Boxes" });
  }

  const groups: SidebarNavGroup[] = [
    { key: "saya", label: "Saya", items: buckets.saya },
    { key: "karyawanOrg", label: "Karyawan & Organisasi", items: buckets.karyawanOrg },
    { key: "rekrutmenMutasi", label: "Rekrutmen & Mutasi", items: buckets.rekrutmenMutasi },
    { key: "absensiCuti", label: "Absensi & Cuti", items: buckets.absensiCuti },
    { key: "pelatihanKompetensi", label: "Pelatihan & Kompetensi", items: buckets.pelatihanKompetensi },
    { key: "asetGa", label: "Aset & GA", items: buckets.asetGa },
    { key: "laporanAudit", label: "Laporan & Audit", items: buckets.laporanAudit },
  ].filter((g) => g.items.length > 0);

  // Every account can change its own password.
  bottomItems.push({ href: "/change-password", label: "Ganti Kata Sandi", icon: "ShieldCheck" });
  const roleLabels = session.user.roles.map((r) => t(`roles.${r}`)).join(", ");

  return (
    <AppShell
      appName={t("app.name")}
      sidebar={
        <>
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand-accent">{t("app.company")}</p>
          <p className="mt-0.5 text-sm font-bold text-white">{t("app.name")}</p>
        </div>
        <SidebarNav topItems={topItems} groups={groups} bottomItems={bottomItems} />
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[11px] text-white/50">{t("auth.signedInAs")}</p>
          <p className="text-sm font-bold text-white">{session.user.name}</p>
          <p className="text-xs text-white/65">{roleLabels}</p>
          <LogoutButton />
        </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
