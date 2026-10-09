// The number on the installed app's icon (taskbar, dock or home screen). Only
// installed apps can show it; everywhere else these calls quietly do nothing.
type BadgeNavigator = Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function appBadgeSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

export async function showAppBadge(count: number): Promise<void> {
  if (!appBadgeSupported()) return;
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    // Not installed, or the browser refused: nothing to show.
  }
}

export const clearAppBadge = () => showAppBadge(0);
