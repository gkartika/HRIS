import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { formatAmount } from "@/lib/production-forms";
import { accessTo, canOpen } from "@/lib/production-forms-guard";
import { getExtraWork } from "@/lib/production-forms-queries";
import { requireSession } from "@/lib/require-session";
import { ClerkActions, LeaderPanel, PayrollPanel } from "../../detail-parts";
import { FormShell } from "../../form-shell";

export default async function ExtraWorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const form = await getExtraWork(id);
  if (!form) notFound();
  const access = await accessTo(session, form.departmentId);
  if (!canOpen(access)) return <AccessDenied />;

  const asked = form.lines.reduce((s, l) => s + Number(l.requestedAmount), 0);
  const final = form.lines.reduce((s, l) => s + Number(l.finalAmount ?? l.requestedAmount), 0);
  const done = form.status === "COMPLETED";

  const body = (
    <>
      <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[11px] text-slate-500">Tanggal</dt><dd className="font-medium">{form.workDate.toISOString().slice(0, 10)}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Dihitung dalam</dt><dd className="font-medium">{form.unit === "HOURS" ? "Jam" : "Hari kerja"}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Total {done ? "(final)" : ""}</dt><dd className="font-medium">{form.lines.length} karyawan, {formatAmount(done ? final : asked, form.unit)}</dd></div>
      </dl>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {form.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">{l.employee.fullLegalName} <span className="text-xs text-slate-400">{l.employee.employeeNumber}</span></td>
                <td className="px-3 py-2 text-slate-500">{l.startTime && l.endTime ? `${l.startTime} – ${l.endTime}` : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {done && l.finalAmount !== null && Number(l.finalAmount) !== Number(l.requestedAmount) ? (
                    <>
                      <span className="text-xs text-slate-400 line-through">{formatAmount(Number(l.requestedAmount), form.unit)}</span> <b>{formatAmount(Number(l.finalAmount), form.unit)}</b>
                    </>
                  ) : (
                    formatAmount(Number(l.requestedAmount), form.unit)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p className="text-[11px] text-slate-500">Alasan</p><p className="whitespace-pre-line">{form.reason}</p></div>
      {form.leaderNote && <p className="mt-2 text-xs text-slate-600">Catatan atasan: {form.leaderNote}</p>}
      {form.payrollNote && <p className="mt-1 text-xs text-slate-600">Catatan Admin SDM: {form.payrollNote}</p>}
    </>
  );

  const panels = (
    <>
      {access.clerk && <ClerkActions kind="EXTRA_WORK" id={form.id} status={form.status} canCopy />}
      {access.approver && form.status === "SUBMITTED" && <LeaderPanel kind="EXTRA_WORK" id={form.id} />}
      {access.sdm && form.status === "LEADER_APPROVED" && (
        <PayrollPanel id={form.id} unit={form.unit} lines={form.lines.map((l) => ({ id: l.id, name: l.employee.fullLegalName, requested: Number(l.requestedAmount) }))} />
      )}
    </>
  );

  return <FormShell kind="EXTRA_WORK" id={form.id} number={form.requestNumber} departmentId={form.departmentId} form={form} title={`Tambahan jam kerja, ${form.workDate.toISOString().slice(0, 10)}`} body={body} panels={panels} />;
}
