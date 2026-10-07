import { StatusChip } from "@/components/status-chip";
import { DISPOSAL_STATUS_LABEL, DISPOSAL_STATUS_TONE } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const REASON_LABEL: Record<string, string> = {
  BEYOND_REPAIR: "Tidak Dapat Diperbaiki",
  OBSOLETE: "Obsolete",
  CONFIRMED_LOSS: "Kehilangan Dikonfirmasi",
};

export default async function DisposalCasesPage() {
  const session = await requireSession();
  const isGaAdminUser = canManageGaOperations(session);

  if (!isGaAdminUser) {
    return <AccessDenied />;
  }

  const cases = await prisma.disposalCase.findMany({
    include: { asset: { select: { assetCode: true, assetName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">Kasus Disposal</h1>
        {isGaAdminUser && (
          <a href="/api/disposal-cases/export" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Ekspor
          </a>
        )}
      </div>

      {cases.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada kasus disposal.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Aset</th>
                <th className="px-4 py-3 font-medium">Alasan</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/disposal-cases/${c.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.asset.assetName} ({c.asset.assetCode})
                  </td>
                  <td className="px-4 py-3 text-slate-600">{REASON_LABEL[c.reason]}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={DISPOSAL_STATUS_TONE[c.status]}>{DISPOSAL_STATUS_LABEL[c.status]}</StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
