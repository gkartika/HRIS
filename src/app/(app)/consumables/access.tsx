import { requireSession } from "@/lib/require-session";
import { canManageConsumables } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";

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
  return <AccessDenied />;
}
