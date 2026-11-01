import { AccessDenied } from "@/components/access-denied";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { isProductionAdmin } from "@/lib/permissions";
import { productionApproversText } from "@/lib/production-forms-guard";
import { listProductionEmployees } from "@/lib/production-forms-service";
import { requireSession } from "@/lib/require-session";
import { LeaveWorkForm } from "../leave-work-form";

export default async function NewLeaveWorkPage() {
  const session = await requireSession();
  if (!isProductionAdmin(session)) return <AccessDenied />;
  const ctx = await productionApproversText();
  if (!ctx) return <AccessDenied />;
  const employees = await listProductionEmployees(ctx.departmentId);
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Beranda", href: "/dashboard" }, { label: "Formulir Produksi", href: "/production-forms" }, { label: "Izin meninggalkan pekerjaan" }]} />
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Formulir Izin Meninggalkan Pekerjaan</h1>
        <p className="text-sm text-slate-500">Untuk satu karyawan pada satu tanggal.</p>
      </div>
      <LeaveWorkForm employees={employees} approvers={ctx.text} initial={{ id: null, employeeId: "", workDate: "", leaveTime: "", returnTime: "", reason: "" }} />
    </div>
  );
}
