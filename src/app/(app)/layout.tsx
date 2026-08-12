import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Upload,
  ShieldCheck,
  UserCircle,
  Building2,
  Settings,
  FileText,
  Briefcase,
  Inbox,
  BarChart3,
  ArrowLeftRight,
  ClipboardCheck,
  FileSignature,
  UserMinus,
  CalendarClock,
  Clock,
  CalendarOff,
  GraduationCap,
} from "lucide-react";
import { requireSession } from "@/lib/require-session";
import {
  isHrAdmin,
  isTrainingAdmin,
  isGaAdmin,
  canSubmitRecruitmentRequest,
  canViewOnboarding,
  canManageCompetencyFramework,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { getActiveDirectorCandidates } from "@/lib/org-chart";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { LogoutButton } from "./logout-button";

async function getIsManager(employeeId: string | null): Promise<boolean> {
  if (!employeeId) return false;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { currentPositionId: true },
  });
  if (!employee?.currentPositionId) return false;
  const directReport = await prisma.position.findFirst({
    where: { reportsToPositionId: employee.currentPositionId },
  });
  return !!directReport;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const canSeeEmployees = isHrAdmin(session) || isTrainingAdmin(session) || isGaAdmin(session);
  const isManager = await getIsManager(session.user.employeeId);
  // ACC-14/DEC-015: derived live from an active Position Assignment on every
  // page load — never cached in the session/JWT — so access to the HR
  // Manager workspace ends automatically the moment the Assignment's
  // effectiveTo passes, with no separate revoke step.
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isHrManagerNow = hrManagerPositions.length > 0;
  // Department Manager/Head (Job level 3B) approval gate, added per direct
  // user request — this persona also needs the Approval Inbox link even
  // when they're not the HR Manager, or their own queue is unreachable via
  // nav (see src/app/(app)/approvals/page.tsx, which now serves both).
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);
  const isDeptHeadAnywhere = deptHeadDepartmentIds.length > 0;
  // New Shift Assignment module, per direct user request — same Level-3
  // (3A/3B) submit eligibility already used for Perubahan Posisi.
  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);
  const isLevel3Anywhere = level3DepartmentIds.length > 0;
  // COM-10/COM-15: Director gap-report/P1 authority, resolved live from the
  // org root Position's active Assignment — same pattern as every other
  // Position-derived authority in this app.
  const directorCandidates = await getActiveDirectorCandidates();
  const isDirectorAnywhere = directorCandidates.some((c) => c.employeeId === session.user.employeeId);
  // DM-27/WF-19: a plain employee with no HR Manager/Dept Head position can
  // still be assigned P1/P2 on any shared Evaluation (Contract Renewal,
  // Perubahan Posisi or Manual HR) — they need the Approval Inbox link too,
  // since that's their only in-app notification surface (no email channel —
  // DSH-10).
  const hasPendingEvaluation = session.user.employeeId
    ? (await prisma.evaluation.count({
        where: {
          status: "RELEASED",
          OR: [
            { p1EmployeeId: session.user.employeeId, p1SubmittedAt: null },
            { p2EmployeeId: session.user.employeeId, p2SubmittedAt: null },
          ],
        },
      })) > 0
    : false;

  const navItems: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
  ];
  if (session.user.employeeId) {
    navItems.push({ href: "/profile", label: t("nav.myProfile"), icon: UserCircle });
  }
  if (isManager) {
    navItems.push({ href: "/team", label: t("nav.myTeam"), icon: Users });
  }
  if (canSeeEmployees) {
    navItems.push({ href: "/employees", label: t("nav.employees"), icon: Users });
  }
  navItems.push({ href: "/organization", label: t("nav.organization"), icon: Building2 });
  if (canSubmitRecruitmentRequest(session)) {
    navItems.push({ href: "/recruitment", label: t("recruitment.navLabel"), icon: FileText });
  }
  // LIF-04: same broad visibility as Recruitment — any employee-linked
  // account can see the list (scoped to their own cases) or HR Admin (sees
  // all); actually submitting a request is separately gated per-employee by
  // canSubmitMovementRequest on the /movements/new page itself.
  if (isHrAdmin(session) || session.user.employeeId) {
    navItems.push({ href: "/movements", label: t("movement.navLabel"), icon: ArrowLeftRight });
  }
  // LIF-03: "Admin shared" visibility — HR/Training/GA Admin plus the active
  // HR Manager, never a plain self-view (unlike Employee Master).
  if (canViewOnboarding(session, hrManagerPositions.map((p) => p.positionId))) {
    navItems.push({ href: "/onboarding", label: t("onboarding.navLabel"), icon: ClipboardCheck });
  }
  // Data Fields Blueprint "08 Contracts": Visibility "Self + People Admin" —
  // same broad list-nav visibility as Recruitment/Movement, scoped to own
  // contracts for non-HR-Admin on the list page itself.
  if (isHrAdmin(session) || session.user.employeeId) {
    navItems.push({ href: "/contracts", label: t("contract.navLabel"), icon: FileSignature });
  }
  // DM-27/WF-19/ACC-17: Contract Renewal's D-30 case now renders inline on
  // its Contract (one module, never a separate nav item — see
  // docs/DECISIONS.md). The shared Evaluation entity gets its own two
  // entries instead: the HR-Admin-only operational list, and "Evaluasi
  // Saya" for any employee-linked account that might be assigned P1/P2.
  if (isHrAdmin(session)) {
    navItems.push({ href: "/evaluations", label: t("evaluation.navLabel"), icon: FileSignature });
  }
  if (session.user.employeeId) {
    navItems.push({ href: "/my-evaluations", label: t("evaluation.myEvaluationsTitle"), icon: FileSignature });
  }
  // LIF-06/DSH-14: same broad list-nav visibility as Contract/Movement —
  // HR Admin (full operational access) or any employee-linked account (who
  // may need to report a direct report's resignation, or view their own
  // case), scoped further on the list page itself.
  if (isHrAdmin(session) || session.user.employeeId) {
    navItems.push({ href: "/offboarding", label: t("offboarding.navLabel"), icon: UserMinus });
  }
  // New Shift Assignment module, per direct user request — HR Admin or any
  // active Level-3 (3A/3B) holder (same eligibility as Perubahan Posisi
  // submission); a plain employee with no Level-3 position has nothing to
  // do on this page.
  if (isHrAdmin(session) || isLevel3Anywhere) {
    navItems.push({ href: "/shift-assignments", label: t("shiftAssignment.navLabel"), icon: CalendarClock });
  }
  // Phase 2 Extension: self-service Mobile check-in/out. Any employee-linked
  // account can reach the page — it self-adapts to "no manual action" for a
  // Fingerprint-assigned employee and "contact HR Admin" for one with no
  // AttendanceAssignment yet, same pattern as Contract/Offboarding's broad
  // nav visibility with page-level scoping.
  if (session.user.employeeId) {
    navItems.push({ href: "/attendance", label: t("attendance.navLabel"), icon: Clock });
  }
  // Rekap Absensi (records + exceptions): same HR-Admin-or-Level-3 visibility
  // scope as Shift Assignment, since it's the same "who can see this team's
  // operational data" authority.
  if (isHrAdmin(session) || isLevel3Anywhere) {
    navItems.push({ href: "/attendance/records", label: t("attendanceRecords.navLabel"), icon: Clock });
  }
  // Absence (Cuti/Izin/Sakit/Lainnya) — same broad list-nav visibility as
  // Contract/Movement/Offboarding: HR Admin or any employee-linked account
  // (who may need to submit their own or decide one they're the configured
  // first approver for), scoped further on the list page itself.
  if (isHrAdmin(session) || session.user.employeeId) {
    navItems.push({ href: "/absences", label: t("absence.navLabel"), icon: CalendarOff });
  }
  // ACC-15/DSH-13: the personal HR Manager workspace — separate from the HR
  // Admin operational nav below, and only visible while the login currently
  // holds an active HR Manager Position.
  if (isHrManagerNow) {
    navItems.push({ href: "/my-positions", label: t("nav.myPositions"), icon: Briefcase });
    navItems.push({ href: "/hr-dashboard", label: t("nav.hrManagerDashboard"), icon: LayoutDashboard });
    navItems.push({ href: "/hr-reports", label: t("nav.hrReports"), icon: BarChart3 });
  }
  if (isHrManagerNow || isDeptHeadAnywhere || hasPendingEvaluation) {
    navItems.push({ href: "/approvals", label: t("nav.approvalInbox"), icon: Inbox });
  }
  if (isHrAdmin(session)) {
    navItems.push({ href: "/admin", label: "Pengaturan Organisasi", icon: Settings });
    navItems.push({ href: "/import", label: t("nav.importData"), icon: Upload });
    navItems.push({ href: "/audit-log", label: t("nav.auditLog"), icon: ShieldCheck });
  }
  // ACC-03: Training & Competency Admin needs this master-data browse even
  // without HR Admin's broader org-structure access — a separate nav entry
  // rather than nested under the HR-Admin-only /admin section above.
  if (canManageCompetencyFramework(session)) {
    navItems.push({ href: "/admin/competency", label: t("competencyAdmin.navLabel"), icon: GraduationCap });
  }
  // COM-06/ACC-21: cycle operations (Training/HR Admin) plus anyone
  // currently assigned P1/P2 on any assessment (their only in-app
  // notification surface for a scoring task, same reasoning as the shared
  // Evaluation entity's Approval Inbox entry above).
  const hasPendingCompetencyEvaluation = session.user.employeeId
    ? (await prisma.competencyAssessment.count({
        where: {
          OR: [
            { p1EmployeeId: session.user.employeeId, p1SubmittedAt: null },
            { p2EmployeeId: session.user.employeeId, p2SubmittedAt: null },
          ],
        },
      })) > 0
    : false;
  if (isHrAdmin(session) || isTrainingAdmin(session) || hasPendingCompetencyEvaluation) {
    navItems.push({ href: "/competency", label: t("competencyAdmin.cycleNavLabel"), icon: GraduationCap });
  }
  // COM-10: Department Level 3 gets its Department's gap report, the
  // Director gets the Level-3 gap report — same broad-visibility-then-
  // page-scoped pattern as every other report in this app.
  if (isHrAdmin(session) || isTrainingAdmin(session) || isLevel3Anywhere || isDirectorAnywhere) {
    navItems.push({ href: "/competency/gaps", label: t("competencyAdmin.gapsNavLabel"), icon: GraduationCap });
  }
  if (session.user.employeeId) {
    navItems.push({ href: "/competency/my", label: t("competencyAdmin.myNavLabel"), icon: GraduationCap });
  }
  // TRN-09/ACC-22: same broad list-nav visibility as Contract/Movement/
  // Absence — HR Admin, Training Admin, or any employee-linked account (who
  // may submit for self, or for their Department if Level 3), scoped
  // further on the list page itself.
  if (isHrAdmin(session) || isTrainingAdmin(session) || session.user.employeeId) {
    navItems.push({ href: "/training-requests", label: t("trainingRequest.navLabel"), icon: GraduationCap });
  }
  if (isHrAdmin(session) || isTrainingAdmin(session)) {
    navItems.push({ href: "/training/courses", label: t("training.coursesNavLabel"), icon: GraduationCap });
    navItems.push({ href: "/training/mandatory-rules", label: t("training.mandatoryRulesNavLabel"), icon: GraduationCap });
    navItems.push({ href: "/training/learning-assignments", label: t("training.learningAssignmentsNavLabel"), icon: GraduationCap });
  }
  // TRN-04/TRN-07: any employee-linked account may hold a direct report's
  // D+30 effectiveness task regardless of Dept Head/Level 3 status, plus
  // Training/HR Admin get the company-wide queue (ACC-22) — same broad-
  // then-page-scoped visibility pattern as Approval Inbox.
  if (isHrAdmin(session) || isTrainingAdmin(session) || session.user.employeeId) {
    navItems.push({ href: "/training/effectiveness-tasks", label: t("training.effectivenessTasksNavLabel"), icon: GraduationCap });
  }

  const roleLabels = session.user.roles.map((r) => t(`roles.${r}`)).join(", ");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            {t("app.company")}
          </p>
          <p className="text-sm font-semibold text-slate-900">{t("app.name")}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400">{t("auth.signedInAs")}</p>
          <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
          <p className="text-xs text-slate-500">{roleLabels}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
