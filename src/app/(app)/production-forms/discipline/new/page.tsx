import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { isProductionAdmin } from "@/lib/permissions";
import { productionApproversText } from "@/lib/production-forms-guard";
import { listProductionEmployees } from "@/lib/production-forms-service";
import { requireSession } from "@/lib/require-session";
import { DisciplineForm } from "../discipline-form";

export default async function NewDisciplinePage() {
  const session = await requireSession();
  if (!isProductionAdmin(session)) return <AccessDenied />;
  const ctx = await productionApproversText();
  if (!ctx) return <AccessDenied />;
  const employees = await listProductionEmployees(ctx.departmentId);
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Formulir Produksi", href: "/production-forms" }, { label: "Surat Peringatan" }]} />
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Surat Peringatan</h1>
        <p className="text-sm text-slate-500">Teguran, SP 1, SP 2, atau SP 3. Dibuat langkah demi langkah.</p>
      </div>
      <DisciplineForm employees={employees} approvers={ctx.text} initial={{ id: null, employeeId: "", kind: "WARNING", incidentDate: "", description: "" }} />
    </div>
  );
}
