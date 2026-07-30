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
} from "lucide-react";
import { requireSession } from "@/lib/require-session";
import {
  isHrAdmin,
  isTrainingAdmin,
  isGaAdmin,
  canSubmitRecruitmentRequest,
  canViewOnboarding,
} from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
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
  // ACC-15/DSH-13: the personal HR Manager workspace — separate from the HR
  // Admin operational nav below, and only visible while the login currently
  // holds an active HR Manager Position.
  if (isHrManagerNow) {
    navItems.push({ href: "/my-positions", label: t("nav.myPositions"), icon: Briefcase });
    navItems.push({ href: "/hr-dashboard", label: t("nav.hrManagerDashboard"), icon: LayoutDashboard });
    navItems.push({ href: "/hr-reports", label: t("nav.hrReports"), icon: BarChart3 });
  }
  if (isHrManagerNow || isDeptHeadAnywhere) {
    navItems.push({ href: "/approvals", label: t("nav.approvalInbox"), icon: Inbox });
  }
  if (isHrAdmin(session)) {
    navItems.push({ href: "/admin", label: "Pengaturan Organisasi", icon: Settings });
    navItems.push({ href: "/import", label: t("nav.importData"), icon: Upload });
    navItems.push({ href: "/audit-log", label: t("nav.auditLog"), icon: ShieldCheck });
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
