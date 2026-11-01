import Link from "next/link";
import { prisma } from "@/lib/db";
import { companyToday, MONTH_LABELS_ID } from "@/lib/company-time";
import { DISCIPLINE_LABEL, formHref } from "@/lib/production-forms";

const day = (d: Date | null) => (d ? `${d.getUTCDate()} ${MONTH_LABELS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—");

// Surat Peringatan of one employee (Admin SDM only): the ones in force, and the history. Only warnings that were handed
// to the employee count as in force; the 6 months run from that day.
export async function DisiplinTabContent({ employeeId }: { employeeId: string }) {
  const today = companyToday();
  const rows = await prisma.disciplinaryAction.findMany({
    where: { employeeId, status: { in: ["SUBMITTED", "LEADER_APPROVED", "COMPLETED", "REJECTED"] } },
    orderBy: { incidentDate: "desc" },
    select: { id: true, requestNumber: true, kind: true, incidentDate: true, description: true, status: true, handedOverAt: true, validUntil: true },
  });
  const inForce = rows.filter((r) => r.status === "COMPLETED" && r.validUntil && r.validUntil >= today);
  const label = (r: (typeof rows)[number]) =>
    r.status === "COMPLETED" ? (r.validUntil && r.validUntil >= today ? `Berlaku sampai ${day(r.validUntil)}` : `Sudah berakhir ${day(r.validUntil)}`) : r.status === "REJECTED" ? "Ditolak" : r.status === "SUBMITTED" ? "Menunggu persetujuan atasan" : "Disetujui, belum diserahkan";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Berlaku sekarang</h3>
        {inForce.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Tidak ada Surat Peringatan yang berlaku.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {inForce.map((r) => (
              <Link key={r.id} href={formHref("DISCIPLINE", r.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm hover:bg-amber-100">
                <span><b>{DISCIPLINE_LABEL[r.kind]}</b> · diserahkan {day(r.handedOverAt)}</span>
                <span className="text-xs text-amber-800">berlaku sampai {day(r.validUntil)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Riwayat</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada Surat Peringatan.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {rows.map((r) => (
              <Link key={r.id} href={formHref("DISCIPLINE", r.id)} className="block px-4 py-2 hover:bg-slate-50">
                <p className="text-sm font-medium text-slate-900">{DISCIPLINE_LABEL[r.kind]} <span className="font-normal text-slate-400">· kejadian {day(r.incidentDate)} · {r.requestNumber}</span></p>
                <p className="text-xs text-slate-500">{label(r)}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{r.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
