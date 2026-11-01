import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { prisma } from "@/lib/db";
import { isProductionAdmin } from "@/lib/permissions";
import { productionApproversText } from "@/lib/production-forms-guard";
import { getExtraWork } from "@/lib/production-forms-queries";
import { listProductionEmployees } from "@/lib/production-forms-service";
import { requireSession } from "@/lib/require-session";
import { ExtraWorkForm, type ExtraWorkInitial } from "../extra-work-form";

export default async function NewExtraWorkPage({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  const { copy } = await searchParams;
  const session = await requireSession();
  if (!isProductionAdmin(session)) return <AccessDenied />;
  const ctx = await productionApproversText();
  if (!ctx) return <AccessDenied />;
  const [employees, last, source] = await Promise.all([
    listProductionEmployees(ctx.departmentId),
    prisma.extraWorkRequest.findFirst({ where: { departmentId: ctx.departmentId, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, select: { lines: { select: { employeeId: true } } } }),
    copy ? getExtraWork(copy) : Promise.resolve(null),
  ]);
  // "Salin jadi formulir baru": the people, times and reason of an earlier form, on a new date.
  const initial: ExtraWorkInitial =
    source && source.departmentId === ctx.departmentId
      ? {
          id: null,
          workDate: "",
          unit: source.unit,
          reason: source.reason,
          lines: source.lines.map((l) => ({ employeeId: l.employeeId, startTime: l.startTime ?? "", endTime: l.endTime ?? "", amount: String(Number(l.requestedAmount)).replace(".", ",") })),
        }
      : { id: null, workDate: "", unit: "HOURS", reason: "", lines: [] };
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Formulir Produksi", href: "/production-forms" }, { label: "Tambahan jam kerja" }]} />
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Formulir Tambahan Jam Kerja</h1>
        <p className="text-sm text-slate-500">Isi untuk beberapa karyawan sekaligus. Pilih, jangan mengetik bila tidak perlu.</p>
        {source && <p className="mt-1 text-xs text-indigo-700">Disalin dari {source.requestNumber}. Periksa tanggalnya.</p>}
      </div>
      <ExtraWorkForm employees={employees} lastTeam={last?.lines.map((l) => l.employeeId) ?? []} approvers={ctx.text} initial={initial} />
    </div>
  );
}
