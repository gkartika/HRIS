import Link from "next/link";
import { formatDateLong } from "@/lib/format";
import { requireSession } from "@/lib/require-session";
import { canManageAssets } from "@/lib/permissions";
import { blocksOffboarding } from "@/lib/assets";
import { blocksOffboardingGaRequest } from "@/lib/ga-operations";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ConfirmGaAssetClearanceForm } from "./confirm-form";

const STATUS_LABEL: Record<string, string> = {
  PENDING_CLEARANCE: "Menunggu Exit Clearance",
};

// GA-Admin-scoped view of who's currently offboarding, purpose-built so GA
// Admin can proactively confirm every asset has been returned — deliberately
// NOT the full Offboarding case (reason, clearance notes stay HR-only; GA Admin only ever needed the asset/GA-
// request piece, same access-boundary reasoning as everywhere else in
// Phase 4A/4B). Case numbers here are plain text, not links — GA Admin
// can't open the full case detail page.
export default async function OffboardingAssetClearancePage() {
  const session = await requireSession();
  if (!canManageAssets(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const activeCases = await prisma.offboardingCase.findMany({
    where: { status: "PENDING_CLEARANCE" },
    include: {
      employee: { include: { currentPosition: { include: { job: true, orgUnit: true } } } },
      gaAssetClearanceConfirmedBy: { select: { usernameOrEmail: true } },
    },
    orderBy: { clearanceDueDate: "asc" },
  });

  const employeeIds = activeCases.map((c) => c.employeeId);
  const [openCustodies, gaRequests] = await Promise.all([
    employeeIds.length > 0
      ? prisma.assetCustody.findMany({
          where: { employeeId: { in: employeeIds }, status: { not: "RETURNED" } },
          include: { asset: { select: { assetName: true, assetCode: true } } },
        })
      : Promise.resolve([]),
    employeeIds.length > 0
      ? prisma.gaRequest.findMany({
          where: { requesterEmployeeId: { in: employeeIds } },
          include: { asset: { select: { assetName: true, assetCode: true } } },
        })
      : Promise.resolve([]),
  ]);

  const custodiesByEmployee = new Map<string, typeof openCustodies>();
  for (const c of openCustodies) {
    if (!blocksOffboarding("EMPLOYEE", c.status)) continue;
    const list = custodiesByEmployee.get(c.employeeId ?? "") ?? [];
    list.push(c);
    custodiesByEmployee.set(c.employeeId ?? "", list);
  }
  const requestsByEmployee = new Map<string, typeof gaRequests>();
  for (const r of gaRequests) {
    if (!blocksOffboardingGaRequest(r.requestType, r.status)) continue;
    const list = requestsByEmployee.get(r.requesterEmployeeId) ?? [];
    list.push(r);
    requestsByEmployee.set(r.requesterEmployeeId, list);
  }

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">Klirens Aset Karyawan Offboarding</h1>
      <p className="mt-1 text-sm text-slate-500">
        Karyawan yang sedang dalam proses offboarding — konfirmasi seluruh aset dan permintaan GA sudah selesai
        sebelum exit clearance.
      </p>

      {activeCases.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">Tidak ada karyawan yang sedang offboarding saat ini.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {activeCases.map((c) => {
            const custodies = custodiesByEmployee.get(c.employeeId) ?? [];
            const requests = requestsByEmployee.get(c.employeeId) ?? [];
            const clear = custodies.length === 0 && requests.length === 0;
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {c.employee.fullLegalName} ({c.employee.employeeNumber})
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.employee.currentPosition
                        ? `${c.employee.currentPosition.job.jobTitle} · ${c.employee.currentPosition.orgUnit.unitName}`
                        : "—"}
                      {" — "}
                      <span className="font-mono">{c.caseNumber}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${clear ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {clear ? "Aset Selesai" : "Perlu Ditindaklanjuti"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{STATUS_LABEL[c.status] ?? c.status}</p>

                {clear && (
                  <p className="mt-3 text-sm text-emerald-700">✓ Semua aset sudah dikembalikan, tidak ada permintaan GA yang belum selesai.</p>
                )}

                {c.gaAssetClearanceConfirmedAt ? (
                  <p className="mt-3 text-xs text-slate-500">
                    ✓ Dikonfirmasi oleh {c.gaAssetClearanceConfirmedBy?.usernameOrEmail ?? "—"} pada{" "}
                    {formatDateLong(c.gaAssetClearanceConfirmedAt)}
                    {c.gaAssetClearanceNote && ` — "${c.gaAssetClearanceNote}"`}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {custodies.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500">Aset Belum Dikembalikan</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Tidak perlu diproses satu per satu di halaman aset — tombol di bawah mengembalikan semuanya sekaligus.
                        </p>
                        <ul className="mt-1 space-y-1 text-sm text-slate-700">
                          {custodies.map((custody) => (
                            <li key={custody.id}>
                              <Link href={`/assets/${custody.assetId}`} className="text-indigo-600 hover:underline">
                                {custody.asset.assetName} ({custody.asset.assetCode})
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-slate-400">
                          Pilih kondisi tiap aset di bawah sebelum konfirmasi — tidak lagi otomatis dianggap Baik.
                        </p>
                      </div>
                    )}
                    {requests.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500">Permintaan GA Belum Selesai (harus diselesaikan satu per satu)</p>
                        <ul className="mt-1 space-y-1 text-sm text-slate-700">
                          {requests.map((r) => (
                            <li key={r.id}>
                              <Link href={`/ga-requests/${r.id}`} className="font-mono text-indigo-600 hover:underline">
                                {r.requestNumber}
                              </Link>
                              {r.asset && ` — ${r.asset.assetName} (${r.asset.assetCode})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <ConfirmGaAssetClearanceForm
                      caseId={c.id}
                      custodies={custodies.map((custody) => ({
                        id: custody.id,
                        assetName: custody.asset.assetName,
                        assetCode: custody.asset.assetCode,
                      }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
