import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { accessTo, canOpen } from "@/lib/production-forms-guard";
import { getLeaveWork } from "@/lib/production-forms-queries";
import { requireSession } from "@/lib/require-session";
import { ClerkActions, LeaderPanel, LeaveDecisionPanel } from "../../detail-parts";
import { FormShell } from "../../form-shell";

export default async function LeaveWorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const form = await getLeaveWork(id);
  if (!form) notFound();
  const access = await accessTo(session, form.departmentId);
  if (!canOpen(access)) return <AccessDenied />;

  const body = (
    <>
      <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-[11px] text-slate-500">Karyawan</dt><dd className="font-medium">{form.employee.fullLegalName} <span className="text-xs text-slate-400">{form.employee.employeeNumber}</span></dd></div>
        <div><dt className="text-[11px] text-slate-500">Tanggal</dt><dd className="font-medium">{form.workDate.toISOString().slice(0, 10)}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Keluar</dt><dd className="font-medium">{form.leaveTime}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Kembali</dt><dd className="font-medium">{form.returnTime ?? "Tidak kembali hari itu"}</dd></div>
      </dl>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p className="text-[11px] text-slate-500">Alasan</p><p className="whitespace-pre-line">{form.reason}</p></div>
      {form.leaderNote && <p className="mt-2 text-xs text-slate-600">Catatan atasan: {form.leaderNote}</p>}
      {form.decision && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Keputusan Admin SDM: <b>{form.decision === "HALF_DAY" ? "dihitung setengah hari (kode SH)" : "tetap satu hari penuh (kode I)"}</b>
          {form.decisionNote ? `. ${form.decisionNote}` : ""}
        </p>
      )}
    </>
  );

  const panels = (
    <>
      {access.clerk && <ClerkActions kind="LEAVE_WORK" id={form.id} status={form.status} canCopy={false} />}
      {access.approver && form.status === "SUBMITTED" && <LeaderPanel kind="LEAVE_WORK" id={form.id} />}
      {access.sdm && (form.status === "LEADER_APPROVED" || form.status === "COMPLETED") && <LeaveDecisionPanel id={form.id} current={form.decision} />}
    </>
  );

  return <FormShell kind="LEAVE_WORK" id={form.id} number={form.requestNumber} departmentId={form.departmentId} form={form} title={`Izin ${form.employee.fullLegalName}, ${form.workDate.toISOString().slice(0, 10)}`} body={body} panels={panels} />;
}
