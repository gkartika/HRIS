import { requireSession } from "@/lib/require-session";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { t } from "@/lib/i18n/id";

// ACC-15: HR Reports (headcount, recruitment, fulfillment, onboarding,
// contracts, movement, exit). Deliberately left empty — built in a later
// increment. Reserves the route and enforces the same access gate as the
// rest of the HR Manager workspace.
export default async function HrReportsPage() {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);

  if (hrManagerPositions.length === 0) {
    return <p className="text-sm text-rose-600">{t("hrManagerUi.notHrManager")}</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("hrManagerUi.reportsTitle")}</h1>
      <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-400">
        {t("hrManagerUi.reportsPlaceholder")}
      </p>
    </div>
  );
}
