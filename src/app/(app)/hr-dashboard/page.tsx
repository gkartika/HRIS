import { requireSession } from "@/lib/require-session";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { t } from "@/lib/i18n/id";

// DSH-13/ACC-15: personal HR Manager dashboard. Deliberately left empty —
// built in a later increment. Existing here only to reserve the route and
// enforce the same live Position-derived access gate as the rest of the
// HR Manager workspace.
export default async function HrManagerDashboardPage() {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);

  if (hrManagerPositions.length === 0) {
    return <p className="text-sm text-rose-600">{t("hrManagerUi.notHrManager")}</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("hrManagerUi.dashboardTitle")}</h1>
      <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-400">
        {t("hrManagerUi.dashboardPlaceholder")}
      </p>
    </div>
  );
}
