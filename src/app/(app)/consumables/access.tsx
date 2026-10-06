import { requireSession } from "@/lib/require-session";
import { canManageConsumables } from "@/lib/permissions";
import { t } from "@/lib/i18n/id";

// Next renders a page in parallel with its layout and ships the page's data in
// the response even when the layout shows "access denied" instead of the
// children — so the layout gate alone would still hand the stock and history
// to a signed-in non-GA user. Every consumables page therefore checks access
// itself, before any query runs:
//
//   const denied = await consumablesAccessDenied();
//   if (denied) return denied;
export async function consumablesAccessDenied(): Promise<React.ReactElement | null> {
  const session = await requireSession();
  if (canManageConsumables(session)) return null;
  return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
}
