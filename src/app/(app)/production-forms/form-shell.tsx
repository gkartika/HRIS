import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatDateTimeMedium } from "@/lib/format";
import { currentStep, FORM_LABEL, STEP_LABELS, statusLine } from "@/lib/production-forms";
import { getEvents } from "@/lib/production-forms-queries";
import { getDepartmentApprovers } from "@/lib/production-forms-service";
import type { ProductionFormKind, ProductionFormStatus } from "@/generated/prisma/enums";

export function Stepper({ status }: { status: ProductionFormStatus }) {
  const now = currentStep(status);
  if (now < 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${i < now ? "bg-emerald-500 text-white" : i === now ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-400"}`}>{i < now ? "✓" : i + 1}</span>
          <span className={`text-[11px] ${i === now ? "font-semibold text-slate-800" : "text-slate-400"}`}>{label}</span>
          {i < STEP_LABELS.length - 1 && <span className="h-px w-4 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

const CLOSED: Partial<Record<ProductionFormStatus, string>> = { REJECTED: "bg-rose-50 text-rose-700", CANCELLED: "bg-slate-100 text-slate-600", RETURNED: "bg-rose-50 text-rose-700" };

// The page around one form: title, where it is now in plain words, the form's own content, the buttons for this reader
// and the story so far.
export async function FormShell(props: {
  kind: ProductionFormKind;
  id: string;
  number: string;
  title: string;
  departmentId: string;
  form: { status: ProductionFormStatus; submittedAt: Date | null; leaderDecidedAt: Date | null; leaderDecidedByName: string | null };
  body: React.ReactNode;
  panels: React.ReactNode;
}) {
  const [events, approvers] = await Promise.all([getEvents(props.kind, props.id), getDepartmentApprovers(props.departmentId)]);
  const line = statusLine(props.kind, props.form, approvers, new Date());
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Formulir Produksi", href: "/production-forms" }, { label: props.number }]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{FORM_LABEL[props.kind]} · {props.number}</p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900">{props.title}</h1>
            <div className="mt-3">
              <Stepper status={props.form.status} />
              <p className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs ${CLOSED[props.form.status] ?? "bg-slate-100 text-slate-700"}`}>{line}</p>
            </div>
            <div className="mt-4">{props.body}</div>
          </div>
          {props.panels}
        </div>
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">Perjalanan formulir</p>
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada riwayat.</p>
            ) : (
              <ol>
                {events.map((e, i) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                      {i < events.length - 1 && <span className="my-1 w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-slate-900">{e.event}</p>
                      <p className="text-xs text-slate-500">{e.actorName} · {formatDateTimeMedium(e.createdAt)} WIB</p>
                      {e.note && <p className="mt-0.5 text-xs text-slate-600">{e.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400 print:hidden">
            <Link href="/production-forms" className="hover:underline">Semua formulir produksi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
