"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { prefsFromForm, type NotificationPrefs } from "@/lib/notification-prefs";

export type NotificationPrefsState = { saved: true; prefs: NotificationPrefs } | undefined;

// Each person changes only their own account's switches.
export async function saveNotificationPrefs(_prev: NotificationPrefsState, formData: FormData): Promise<NotificationPrefsState> {
  const session = await requireSession();
  const prefs = prefsFromForm(formData);
  await prisma.account.update({
    where: { id: session.user.id },
    data: { notifyIconBadge: prefs.icon, notifyMenuBadge: prefs.menu, notifyTabTitle: prefs.tab },
  });
  revalidatePath("/notifications");
  return { saved: true, prefs };
}
