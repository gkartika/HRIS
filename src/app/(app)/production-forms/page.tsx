import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { isHrAdmin, isProductionAdmin } from "@/lib/permissions";
import { currentStep, FORM_LABEL, formHref, STEP_LABELS, statusLine } from "@/lib/production-forms";
import { listForms, type FormRow } from "@/lib/production-forms-queries";
import { approverOf, getDepartmentApprovers, getProductionDepartment } from "@/lib/production-forms-service";
import { requireSession } from "@/lib/require-session";
import type { ProductionFormStatus } from "@/generated/prisma/enums";

const TABS: { key: string; label: string; statuses: ProductionFormStatus[] | null }[] = [
  { key: "proses", label: "Sedang diproses", statuses: ["DRAFT", "RETURNED", "SUBMITTED", "LEADER_APPROVED"] },
  { key: "menunggu", label: "Menunggu persetujuan", statuses: ["SUBMITTED", "LEADER_APPROVED"] },
  { key: "selesai", label: "Selesai", statuses: ["COMPLETED"] },
  { key: "ditutup", label: "Ditolak atau dibatalkan", statuses: ["REJECTED", "CANCELLED"] },
  { key: "semua", label: "Semua", statuses: null },
];

function Steps({ status }: { status: ProductionFormStatus }) {
  const now = currentStep(status);
  if (now < 0) return null;
  return (
    <div className="flex items-center gap-1">
      {STEP_LABELS.map((label, i) => (
        <span key={label} title={label} className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${i < now ? "bg-emerald-500 text-white" : i === now ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-400"}`}>
          {i < now ? "✓" : i + 1}
        </span>
      ))}
    </div>
  );
}

// All Admin Produksi forms in one list: the Production clerk and Admin SDM see every form, a 3A or 3B the ones of their
// own department.
export default async function ProductionFormsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; jenis?: string }> }) {
  const { tab, q, jenis } = await searchParams;
  // Opened from the Beranda card of one form: only that kind of form.
  const kindFilter = (["EXTRA_WORK", "LEAVE_WORK", "DISCIPLINE"] as const).find((k) => k === jenis) ?? null;
  const session = await requireSession();
  const clerk = isProductionAdmin(session);
  const sdm = isHrAdmin(session);
  const dept = await getProductionDepartment();
  let rows: FormRow[] = [];
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  if (dept) {
    if (clerk || sdm) {
      rows = await listForms({ statuses: active.statuses ?? undefined, search: q, ...(clerk ? { departmentId: dept.id } : {}) });
    } else {
      // A 3A or 3B of the department sees its forms; anyone else has nothing here.
      if (!(await approverOf(session.user.employeeId, dept.id))) return <AccessDenied />;
      rows = await listForms({ statuses: active.statuses ?? undefined, search: q, departmentId: dept.id });
    }
  } else if (!clerk && !sdm) {
    return <AccessDenied />;
  }
  if (kindFilter) rows = rows.filter((r) => r.kind === kindFilter);
  const approvers = dept ? await getDepartmentApprovers(dept.id) : [];
  const now = new Date();

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Formulir Produksi" }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Formulir Produksi</h1>
          <p className="text-sm text-slate-500">Tambahan jam kerja, izin meninggalkan pekerjaan, dan Surat Peringatan untuk departemen Production.</p>
        </div>
        {clerk && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/production-forms/extra-work/new" className="rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700">+ Tambahan jam kerja</Link>
            <Link href="/production-forms/leave-work/new" className="rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700">+ Izin meninggalkan pekerjaan</Link>
            <Link href="/production-forms/discipline/new" className="rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700">+ Surat Peringatan</Link>
          </div>
        )}
      </div>
      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={active.key} />
        {kindFilter && <input type="hidden" name="jenis" value={kindFilter} />}
        <input name="q" defaultValue={q ?? ""} placeholder="Cari nama karyawan atau nomor formulir" aria-label="Cari formulir" className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cari</button>
      </form>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {kindFilter && (
          <Link href={`/production-forms?tab=${active.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            {FORM_LABEL[kindFilter]} ✕
          </Link>
        )}
        {TABS.map((t) => (
          <Link key={t.key} href={`/production-forms?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${kindFilter ? `&jenis=${kindFilter}` : ""}`} className={`rounded-full border px-3 py-1.5 ${active.key === t.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Tidak ada formulir di sini.</p>
        ) : (
          rows.map((r) => (
            <Link key={`${r.kind}-${r.id}`} href={formHref(r.kind, r.id)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
                <p className="text-[11px] font-medium text-slate-500">{FORM_LABEL[r.kind]}</p>
                <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500">{r.subtitle}</p>
              </div>
              <div>
                <Steps status={r.status} />
                <p className="mt-1 text-xs text-slate-600">{statusLine(r.kind, r, approvers, now)}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
