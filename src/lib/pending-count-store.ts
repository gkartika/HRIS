// The number of approvals waiting for the signed-in person, plus where they
// want it shown, kept in one place so the app icon, the side menu and the tab
// title all read the same value. Filled by components/app-badge-sync.tsx.
import { DEFAULT_PREFS, type NotificationPrefs } from "@/lib/notification-prefs";

export interface PendingState extends NotificationPrefs {
  count: number;
}

const INITIAL: PendingState = { count: 0, ...DEFAULT_PREFS };
let state: PendingState = INITIAL;
const listeners = new Set<() => void>();

export const getPendingState = () => state;
export const getServerPendingState = () => INITIAL;

export function subscribePending(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function setPendingState(next: Partial<PendingState>) {
  const merged = { ...state, ...next };
  if (merged.count === state.count && merged.icon === state.icon && merged.menu === state.menu && merged.tab === state.tab) return;
  state = merged;
  listeners.forEach((l) => l());
}
