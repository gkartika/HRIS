import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Runs the real public/sw.js against fake browser parts, to check the part that decides when the "no connection"
// page is shown: a page is asked for up to three times first, because a phone's network is often still waking up
// at the very moment someone taps the app icon or a link.
type Handler = (event: unknown) => void;

function loadWorker(options: { fetchImpl: (req: unknown) => Promise<unknown>; cached?: Record<string, unknown> }) {
  const handlers: Record<string, Handler> = {};
  const fetchSpy = vi.fn(options.fetchImpl);
  const sandbox = {
    self: { addEventListener: (type: string, fn: Handler) => (handlers[type] = fn) },
    caches: { match: async (req: unknown) => options.cached?.[typeof req === "string" ? req : (req as { url: string }).url.replace(/^https?:\/\/[^/]+/, "")] },
    fetch: fetchSpy,
    Response: class FakeResponse {
      static error() {
        return { error: true };
      }
    },
    URL,
    Promise,
    // the real worker waits 0.7 s and 1.8 s between tries; waiting is not what is tested here
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
  };
  runInContext(readFileSync("public/sw.js", "utf8"), createContext(sandbox));
  return { fetchHandler: handlers.fetch, fetchSpy };
}

function navigate(handler: Handler, preload?: Promise<unknown>) {
  let result: Promise<unknown> | undefined;
  handler({ request: { mode: "navigate", url: "https://app.test/recruitment/x" }, preloadResponse: preload ?? Promise.resolve(undefined), respondWith: (p: Promise<unknown>) => (result = p) });
  return result;
}

const OFFLINE = { offline: true };
const OK = { ok: true };

describe("service worker: opening a page", () => {
  it("tries again when the first request fails, and does not show the offline page", async () => {
    let calls = 0;
    const { fetchHandler, fetchSpy } = loadWorker({
      fetchImpl: async () => {
        calls++;
        if (calls < 3) throw new TypeError("network down");
        return OK;
      },
      cached: { "/offline.html": OFFLINE },
    });
    expect(await navigate(fetchHandler)).toBe(OK);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("shows the offline page only after every try failed", async () => {
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => Promise.reject(new TypeError("offline")), cached: { "/offline.html": OFFLINE } });
    expect(await navigate(fetchHandler)).toBe(OFFLINE);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("uses the page the browser already started loading", async () => {
    const early = { early: true };
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => OK });
    expect(await navigate(fetchHandler, Promise.resolve(early))).toBe(early);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks again itself when the browser's early request failed", async () => {
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => OK });
    expect(await navigate(fetchHandler, Promise.reject(new TypeError("early request failed")))).toBe(OK);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves everything that is not a page alone, except the offline page's icon", async () => {
    const icon = { icon: true };
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => OK, cached: { "/pwa/icon-192.png": icon } });
    let responded: Promise<unknown> | undefined;
    fetchHandler({ request: { mode: "cors", url: "https://app.test/api/pending-count" }, respondWith: (p: Promise<unknown>) => (responded = p) });
    expect(responded).toBeUndefined();
    fetchHandler({ request: { mode: "no-cors", url: "https://app.test/pwa/icon-192.png" }, respondWith: (p: Promise<unknown>) => (responded = p) });
    expect(await responded).toBe(icon);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
