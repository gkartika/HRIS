// Small shared store for "install this website as an app". Browsers hand the page
// an install prompt once (Chrome/Edge/Android); we keep it so any button can use it.
// iPhone/iPad Safari has no prompt, so there we only show the manual steps.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = "hidden" | "prompt" | "ios";

let deferred: InstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startInstallListener() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export function subscribeInstall(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getInstallState(): InstallState {
  if (typeof window === "undefined") return "hidden";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos ? "ios" : "hidden";
}

export async function promptInstall() {
  if (!deferred) return;
  const event = deferred;
  deferred = null;
  emit();
  await event.prompt();
  await event.userChoice;
}
