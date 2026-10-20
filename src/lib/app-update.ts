// What an open page does when it finds out a newer build of the app is live. Pure, so it can be tested.
export type UpdateAction = "none" | "reload" | "banner";

export const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function updateAction(input: {
  /** The build this page was loaded from. */
  mine: string;
  /** The build the server says is live now ("" when it could not be read). */
  live: string;
  /** Whether the person is looking at this page right now. */
  visible: boolean;
  /** The live build this page already reloaded for once (guards against reloading forever if an old page keeps being served). */
  alreadyReloadedFor: string | null;
}): UpdateAction {
  const { mine, live, visible, alreadyReloadedFor } = input;
  if (!mine || !live || mine === live) return "none";
  // Away from the page: refresh quietly. Looking at it: never pull it away mid-typing, ask first.
  if (!visible && alreadyReloadedFor !== live) return "reload";
  return "banner";
}
