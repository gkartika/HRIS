import { requireSession } from "@/lib/require-session";
import { canManageConsumables } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";
import { ConsumableTabs } from "./tabs";

// One gate for every consumables page: GA Admin only. Employees and HR Admin
// never reach any of these screens (and have no sidebar entry either).
export default async function ConsumablesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!canManageConsumables(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium text-slate-900">{t("consumable.title")}</h1>
      <ConsumableTabs
        tabs={[
          { href: "/consumables", label: t("consumable.tabTake") },
          { href: "/consumables/stock", label: t("consumable.tabStock") },
          { href: "/consumables/history", label: t("consumable.tabHistory") },
          { href: "/consumables/items", label: t("consumable.tabItems") },
          { href: "/consumables/dashboard", label: t("consumable.tabDashboard") },
        ]}
      />
      {children}
    </div>
  );
}
