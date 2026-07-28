import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Upload,
  ShieldCheck,
  UserCircle,
  Building2,
  Settings,
} from "lucide-react";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin, isGaAdmin } from "@/lib/permissions";
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
