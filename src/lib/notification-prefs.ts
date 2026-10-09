// Where one person wants the number of waiting approvals shown. Pure helpers,
// no Prisma/Next imports, so they are unit testable.
export interface NotificationPrefs {
  icon: boolean; // on the installed app's icon
  menu: boolean; // next to Beranda in the side menu
  tab: boolean; // in the browser tab title, e.g. "(3) Aplikasi HC"
}

export const DEFAULT_PREFS: NotificationPrefs = { icon: true, menu: true, tab: true };

export function prefsFromAccount(a: { notifyIconBadge: boolean; notifyMenuBadge: boolean; notifyTabTitle: boolean }): NotificationPrefs {
  return { icon: a.notifyIconBadge, menu: a.notifyMenuBadge, tab: a.notifyTabTitle };
}

// Checkboxes only appear in a submitted form when ticked.
export function prefsFromForm(formData: FormData): NotificationPrefs {
  return { icon: formData.get("icon") === "on", menu: formData.get("menu") === "on", tab: formData.get("tab") === "on" };
}

// 100 or more reads "99+" so the number never outgrows its badge.
export function countLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}

const COUNT_PREFIX = /^\((?:\d+|99\+)\)\s/;

// The tab title with the waiting-approvals number in front, or the plain title
// when the number is off or nothing is waiting. Safe to apply repeatedly.
export function titleWithCount(title: string, count: number, enabled: boolean): string {
  const plain = title.replace(COUNT_PREFIX, "");
  return enabled && count > 0 ? `(${countLabel(count)}) ${plain}` : plain;
}
