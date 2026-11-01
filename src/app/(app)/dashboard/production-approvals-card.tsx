import Link from "next/link";
import { FORM_LABEL, formHref, waitText } from "@/lib/production-forms";
import { getFormsForApprover } from "@/lib/production-forms-queries";

// For a 3A or 3B: the Production forms (Tambahan jam kerja, Izin, Surat Peringatan) waiting for their decision.
// Nothing is shown to anyone else, or when nothing is waiting.
export async function ProductionApprovalsCard({ employeeId }: { employeeId: string | null | undefined }) {
  const rows = await getFormsForApprover(employeeId);
  if (rows.length === 0) return null;
  const now = new Date();
  return (
    <div className="rounded-xl border border-brand-accent bg-white p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Formulir Produksi menunggu persetujuan Anda</h2>
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-accent">{rows.length} menunggu</span>
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">{FORM_LABEL[r.kind]}</p>
              <Link href={formHref(r.kind, r.id)} className="text-sm font-semibold text-slate-900 hover:underline">{r.title}</Link>
              <p className="text-xs text-slate-500">{r.subtitle} · {waitText(r.submittedAt, now)}</p>
            </div>
            <Link href={formHref(r.kind, r.id)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Buka dan putuskan
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
