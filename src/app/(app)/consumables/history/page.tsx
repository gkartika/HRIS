import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { EmptyState } from "@/components/empty-state";
import { t } from "@/lib/i18n/id";
import type { ConsumableTxType } from "@/generated/prisma/enums";
import { buildHistoryWhere, getMovementTotals, stockFromTotals } from "@/lib/consumables-queries";
import { cancelWouldGoNegative } from "@/lib/consumables";
import { CancelDialog } from "../cancel-dialog";
import { consumablesAccessDenied } from "../access";

type Tab = "keluar" | "masuk" | "adj";

const TABS: { key: Tab; label: string; type: ConsumableTxType }[] = [
  { key: "keluar", label: "Barang Keluar", type: "ISSUE" },
  { key: "masuk", label: "Barang Masuk", type: "RECEIPT" },
  { key: "adj", label: "Penyesuaian Stok", type: "ADJUSTMENT" },
];

const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" });

export default async function ConsumableHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; status?: string; page?: string }>;
}) {
  const denied = await consumablesAccessDenied();
  if (denied) return denied;
  const { type, q, status, page: pageRaw } = await searchParams;
  const tab = TABS.find((x) => x.key === type) ?? TABS[0];
  const query = q?.trim() ?? "";

  const where = buildHistoryWhere(tab.type, query, status);

  const { page, skip, take } = pageParams(pageRaw);
  const [rows, total] = await Promise.all([
    prisma.consumableTransaction.findMany({
      where,
      skip,
      take,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { item: true },
    }),
    prisma.consumableTransaction.count({ where }),
  ]);

  // Current stock of the items on this page, to warn before cancelling a
  // receipt that has already been (partly) used.
  const totals = await getMovementTotals(prisma, [...new Set(rows.map((r) => r.itemId))]);

  const hasFilters = !!(query || status);
  const baseParams = { type: tab.key, q: query || undefined, status: status || undefined };

  return (
    <div>
      <form className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <input type="hidden" name="type" value={tab.key} />
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          {TABS.map((x) => (
            <Link
              key={x.key}
              href={`/consumables/history?type=${x.key}`}
              className={`rounded-md px-3 py-1.5 ${x.key === tab.key ? "bg-indigo-600 font-semibold text-white" : "text-slate-600"}`}
            >
              {x.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={tab.type === "ISSUE" ? "Cari nama pengambil atau barang" : "Cari barang"}
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          />
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value="">Semua</option>
            <option value="Aktif">Aktif</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          <a
            href={`/api/consumables/export?type=${tab.key}${query ? `&q=${encodeURIComponent(query)}` : ""}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Ekspor Excel
          </a>
          {hasFilters && (
            <Link href={`/consumables/history?type=${tab.key}`} className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState filtered={hasFilters} message="Belum ada transaksi." resetHref={`/consumables/history?type=${tab.key}`} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                {tab.type === "ISSUE" && <th className="px-4 py-3 font-medium">Pengambil</th>}
                <th className="px-4 py-3 font-medium">Barang</th>
                {tab.type === "ADJUSTMENT" ? (
                  <>
                    <th className="px-4 py-3 font-medium">Stok sistem → fisik</th>
                    <th className="px-4 py-3 font-medium">Selisih</th>
                  </>
                ) : (
                  <th className="px-4 py-3 font-medium">Jumlah</th>
                )}
                <th className="px-4 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cancelled = r.cancelledAt !== null;
                const qty = Math.abs(r.quantityDelta);
                const stockNow = stockFromTotals(r.item.openingStock, totals.get(r.itemId));
                const warning =
                  !cancelled && cancelWouldGoNegative(stockNow, { type: r.type, quantityDelta: r.quantityDelta })
                    ? `Stok ${r.item.itemName} saat ini ${stockNow}. Membatalkan barang masuk ini membuat stok menjadi ${stockNow - r.quantityDelta}.`
                    : undefined;
                const summary = `${r.item.itemName}${r.recipientNameSnapshot ? ` · ${r.recipientNameSnapshot}` : ""} · ${qty} ${r.item.unit}`;
                return (
                  <tr key={r.id} className={`border-t border-slate-100 align-top ${cancelled ? "text-slate-400 line-through decoration-slate-300" : ""}`}>
                    <td className="px-4 py-2.5">{dateFmt.format(r.occurredAt)}</td>
                    {tab.type === "ISSUE" && (
                      <td className="px-4 py-2.5">
                        {r.recipientNameSnapshot ?? "—"}
                        <br />
                        <span className="text-xs text-slate-400">
                          {r.recipientType === "DEPARTMENT" ? "pengambilan departemen" : (r.departmentNameSnapshot ?? "")}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      {r.item.itemName}
                      <br />
                      <span className="font-mono text-xs text-slate-400">{r.item.itemCode}</span>
                    </td>
                    {tab.type === "ADJUSTMENT" ? (
                      <>
                        <td className="px-4 py-2.5">
                          {r.systemStockSnapshot} → {r.physicalStock}
                        </td>
                        <td className="px-4 py-2.5">{r.quantityDelta > 0 ? `+${r.quantityDelta}` : r.quantityDelta}</td>
                      </>
                    ) : (
                      <td className="px-4 py-2.5">
                        {tab.type === "RECEIPT" ? "+" : ""}
                        {qty} {r.item.unit}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {r.beforePeriod && <span className="mr-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 no-underline">Sebelum periode</span>}
                      {r.exceededStock && <span className="mr-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700 no-underline">Melebihi stok</span>}
                      <div className="mt-1 max-w-[240px]">
                        {[r.warningReason, r.purpose, r.reference, r.note, r.reason].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {cancelled && r.cancelReason && <div className="mt-1 max-w-[240px] text-slate-400">Dibatalkan: {r.cancelReason}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {cancelled ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500 no-underline">Dibatalkan</span>
                      ) : (
                        <CancelDialog txId={r.id} summary={summary} warning={warning} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11.5px] text-slate-400">Transaksi tidak pernah dihapus. Yang salah dicatat dibatalkan dengan alasan, dan tetap terlihat di sini.</p>
      <Pager page={page} total={total} basePath="/consumables/history" params={baseParams} />
    </div>
  );
}
