import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { isProductionAdmin } from "@/lib/permissions";
import { canEdit } from "@/lib/production-forms";
import { productionApproversText } from "@/lib/production-forms-guard";
import { getExtraWork } from "@/lib/production-forms-queries";
import { listProductionEmployees } from "@/lib/production-forms-service";
import { requireSession } from "@/lib/require-session";
import { ExtraWorkForm } from "../../extra-work-form";

export default async function EditExtraWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!isProductionAdmin(session)) return <AccessDenied />;
  const ctx = await productionApproversText();
  const form = await getExtraWork(id);
  if (!ctx || !form || form.departmentId !== ctx.departmentId) notFound();
  if (!canEdit(form.status)) return <AccessDenied />;
  const employees = await listProductionEmployees(ctx.departmentId);
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Formulir Produksi", href: "/production-forms" }, { label: form.requestNumber }]} />
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Ubah {form.requestNumber}</h1>
        {form.status === "RETURNED" && form.leaderNote && <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Dikembalikan: {form.leaderNote}</p>}
        {form.status === "RETURNED" && !form.leaderNote && form.payrollNote && <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Dikembalikan Admin SDM: {form.payrollNote}</p>}
      </div>
      <ExtraWorkForm
        employees={employees}
        lastTeam={[]}
        approvers={ctx.text}
        initial={{
          id: form.id,
          workDate: form.workDate.toISOString().slice(0, 10),
          unit: form.unit,
          reason: form.reason,
          lines: form.lines.map((l) => ({ employeeId: l.employeeId, startTime: l.startTime ?? "", endTime: l.endTime ?? "", amount: String(Number(l.requestedAmount)).replace(".", ",") })),
        }}
      />
    </div>
  );
}
