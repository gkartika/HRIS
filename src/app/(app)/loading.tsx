// Next.js shows this automatically while a page's server component is still
// fetching data, replacing what used to be a blank white screen with no way
// to tell "loading" from "broken." Generic by design — every page under
// (app) shares it, no per-route loading.tsx needed.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="h-4 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-4 w-1/4 rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
