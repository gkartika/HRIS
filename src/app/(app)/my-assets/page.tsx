import Link from "next/link";
import { StatusChip } from "@/components/status-chip";
import { CUSTODY_STATUS_TONE, GA_REQUEST_STATUS_LABEL, GA_REQUEST_STATUS_TONE } from "@/lib/status-ui";
import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { formatDateMedium } from "@/lib/format";
import { OPEN_REPORT_STATUSES } from "@/lib/ga-request-rules";
import { t } from "@/lib/i18n/id";
import { PageHeader, HeldAssetCard, type HeldAsset } from "./request-forms";

const REQUEST_LIMIT = 8;
const HISTORY_LIMIT = 10;

const TYPE_LABEL: Record<string, string> = {
  NEW_ASSET_NEED: "Aset baru",
  DAMAGE_OR_ABNORMAL_CONDITION: "Kerusakan",
  LOSS: "Kehilangan",
};

export default async function MyAssetsPage({ searchParams }: { searchParams: Promise<{ semua?: string }> }) {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <AccessDenied />;
  }
  const { semua } = await searchParams;
  const showAll = semua === "1";

  // Everything is fetched at once: the open-report lookup finds the held assets itself, so it
  // does not have to wait for the custody list.
  const [custodies, openReports, myRequests, requestCount, issues] = await Promise.all([
    prisma.assetCustody.findMany({
      where: { employeeId },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        assetId: true,
        status: true,
        assignedAt: true,
        returnedAt: true,
        quantity: true,
        conditionAtHandover: true,
        asset: { select: { assetName: true, assetCode: true, trackingType: true } },
        location: { select: { locationName: true } },
      },
    }),
    prisma.gaRequest.findMany({
      where: {
        asset: { custodies: { some: { employeeId, status: "ACTIVE" } } },
        OR: [
          { requestType: "DAMAGE_OR_ABNORMAL_CONDITION", status: { in: OPEN_REPORT_STATUSES.DAMAGE_OR_ABNORMAL_CONDITION } },
          { requestType: "LOSS", status: { in: OPEN_REPORT_STATUSES.LOSS } },
        ],
      },
      select: { assetId: true, requestNumber: true, requestType: true, status: true },
    }),
    prisma.gaRequest.findMany({
      where: { requesterEmployeeId: employeeId },
      orderBy: { submittedAt: "desc" },
      take: REQUEST_LIMIT,
      select: { id: true, requestNumber: true, requestType: true, status: true, description: true, asset: { select: { assetName: true, assetCode: true } } },
    }),
    prisma.gaRequest.count({ where: { requesterEmployeeId: employeeId } }),
    prisma.consumableTransaction.findMany({
      where: { type: "ISSUE", employeeId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: showAll ? undefined : HISTORY_LIMIT + 1,
      select: {
        id: true,
        occurredAt: true,
        quantityDelta: true,
        cancelledAt: true,
        item: { select: { itemName: true, itemCode: true, unit: true } },
      },
    }),
  ]);

  const held = custodies.filter((c) => c.status === "ACTIVE");
  const returned = custodies.filter((c) => c.status !== "ACTIVE");
  const reportByAsset = new Map(openReports.map((r) => [r.assetId, r]));
  const heldAssets: HeldAsset[] = held.map((c) => {
    const report = reportByAsset.get(c.assetId);
    return {
      assetId: c.assetId,
      name: c.asset.assetName,
      code: c.asset.assetCode,
      info: [
        `Diserahkan ${c.assignedAt.toISOString().slice(0, 10)}`,
        c.conditionAtHandover ? `Kondisi: ${c.conditionAtHandover}` : null,
        c.asset.trackingType === "QUANTITY_TRACKED" ? `${c.quantity} unit` : null,
        c.location ? c.location.locationName : null,
      ]
        .filter(Boolean)
        .join(" · "),
      openReport: report
        ? {
            label: report.requestType === "LOSS" ? "Kehilangan dilaporkan" : "Kerusakan dilaporkan",
            status: GA_REQUEST_STATUS_LABEL[report.status],
            number: report.requestNumber,
            tone: GA_REQUEST_STATUS_TONE[report.status],
          }
        : null,
    };
  });

  const hasMoreIssues = !showAll && issues.length > HISTORY_LIMIT;
  const shownIssues = hasMoreIssues ? issues.slice(0, HISTORY_LIMIT) : issues;

  return (
    <div className="space-y-6">
      <PageHeader title={t("asset.myAssetsTitle")} />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dipegang sekarang</h2>
        {heldAssets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t("asset.myAssetsEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {heldAssets.map((a) => (
              <HeldAssetCard key={a.assetId} asset={a} />
            ))}
          </div>
        )}
        {returned.length > 0 && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm text-slate-600">Riwayat penyerahan ({returned.length} sudah dikembalikan)</summary>
            <div className="space-y-2 border-t border-slate-100 px-4 py-3">
              {returned.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-900">
                      {c.asset.assetName} <span className="font-mono text-xs text-slate-400">{c.asset.assetCode}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Diserahkan {c.assignedAt.toISOString().slice(0, 10)}
                      {c.returnedAt ? ` · Dikembalikan ${c.returnedAt.toISOString().slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <StatusChip tone={CUSTODY_STATUS_TONE[c.status]}>{t(`assetCustodyStatus.${c.status}`)}</StatusChip>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permintaan saya</h2>
        {myRequests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Belum ada permintaan atau laporan.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {myRequests.map((r) => (
              <Link key={r.id} href={`/ga-requests/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="font-mono text-xs text-slate-400">{r.requestNumber}</span>
                <span className="min-w-0 flex-1 text-sm text-slate-700">
                  {TYPE_LABEL[r.requestType]} · {r.asset ? `${r.asset.assetName} (${r.asset.assetCode})` : r.description.slice(0, 60)}
                </span>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${GA_REQUEST_STATUS_TONE[r.status]}`}>{GA_REQUEST_STATUS_LABEL[r.status]}</span>
              </Link>
            ))}
            {requestCount > REQUEST_LIMIT && (
              <Link href="/ga-requests" className="block px-4 py-3 text-sm text-indigo-600 hover:underline">
                Lihat semua ({requestCount})
              </Link>
            )}
          </div>
        )}
      </section>

      <section id="riwayat">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barang Habis Pakai yang Saya Ambil</h2>
        <p className="mt-1 text-xs text-slate-500">Dicatat oleh GA saat Anda mengambil APD atau ATK. Tidak ada yang perlu diisi di sini.</p>
        {shownIssues.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Belum ada pengambilan yang tercatat.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Barang</th>
                  <th className="px-4 py-3 font-medium">Jumlah</th>
                  <th className="px-4 py-3 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {shownIssues.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-600">{formatDateMedium(i.occurredAt)}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {i.item.itemName} <span className="font-mono text-xs text-slate-400">{i.item.itemCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {Math.abs(i.quantityDelta)} {i.item.unit}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {i.cancelledAt ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">Dibatalkan</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMoreIssues && (
          <Link href="/my-assets?semua=1#riwayat" className="mt-3 inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Tampilkan semua
          </Link>
        )}
      </section>
    </div>
  );
}
