import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { DISCIPLINE_LABEL } from "@/lib/production-forms";
import { accessTo, canOpen } from "@/lib/production-forms-guard";
import { getDiscipline } from "@/lib/production-forms-queries";
import { requireSession } from "@/lib/require-session";
import { ClerkActions, HandoverPanel, LeaderPanel } from "../../detail-parts";
import { FormShell } from "../../form-shell";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

export default async function DisciplineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const form = await getDiscipline(id);
  if (!form) notFound();
  const access = await accessTo(session, form.departmentId);
  if (!canOpen(access)) return <AccessDenied />;

  const body = (
    <>
      <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-[11px] text-slate-500">Karyawan</dt><dd className="font-medium">{form.employee.fullLegalName} <span className="text-xs text-slate-400">{form.employee.employeeNumber}</span></dd></div>
        <div><dt className="text-[11px] text-slate-500">Jenis</dt><dd className="font-medium">{DISCIPLINE_LABEL[form.kind]}</dd></div>
        <div><dt className="text-[11px] text-slate-500">Tanggal kejadian</dt><dd className="font-medium">{iso(form.incidentDate)}</dd></div>
      </dl>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p className="text-[11px] text-slate-500">Apa yang terjadi</p><p className="whitespace-pre-line">{form.description}</p></div>
      {form.leaderNote && <p className="mt-2 text-xs text-slate-600">Catatan atasan: {form.leaderNote}</p>}
      {form.status === "COMPLETED" && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Diserahkan ke karyawan <b>{iso(form.handedOverAt)}</b>. Berlaku sampai <b>{iso(form.validUntil)}</b> (6 bulan).
        </p>
      )}
    </>
  );

  const panels = (
    <>
      {access.clerk && <ClerkActions kind="DISCIPLINE" id={form.id} status={form.status} canCopy={false} />}
      {access.approver && form.status === "SUBMITTED" && <LeaderPanel kind="DISCIPLINE" id={form.id} />}
      {access.sdm && form.status === "LEADER_APPROVED" && <HandoverPanel id={form.id} />}
    </>
  );

  return <FormShell kind="DISCIPLINE" id={form.id} number={form.requestNumber} departmentId={form.departmentId} form={form} title={`${DISCIPLINE_LABEL[form.kind]} untuk ${form.employee.fullLegalName}`} body={body} panels={panels} />;
}
