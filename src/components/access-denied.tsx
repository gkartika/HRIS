import { t } from "@/lib/i18n/id";

// The one "you may not see this page" notice. Pages still decide access
// themselves (a layout gate alone does not stop the page's data shipping).
export function AccessDenied() {
  return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
}
