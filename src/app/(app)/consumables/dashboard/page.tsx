import { countByStatus } from "@/lib/consumables";
import { MONTH_LABELS_ID } from "@/lib/company-time";
import { CONSUMABLE_STATUS_TONE } from "@/lib/status-ui";
import Link from "next/link";
import { getMonthlyIssued, getMonthlyReportRows, listItemsWithStock } from "@/lib/consumables-queries";
import { t } from "@/lib/i18n/id";
import { bucketMonthlyIssued, monthKey, monthLabel, monthRange } from "@/lib/consumables-report";
import { consumablesAccessDenied } from "../access";

const MONTHS_SHOWN = 6;

export default async function ConsumableDashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const denied = await consumablesAccessDenied();
  if (denied) return denied;
  const { month } = await searchParams;
  const now = new Date();
  const selectedKey = month && monthRange(month) ? month : monthKey(now);
  const range = monthRange(selectedKey)!;

  const buckets = bucketMonthlyIssued([], MONTHS_SHOWN, now); // just for the window keys
  const windowStart = monthRange(buckets[0].key)!.start;

  const [items, monthly, report] = await Promise.all([
    listItemsWithStock({ includeArchived: true }),
    getMonthlyIssued(windowStart, MONTHS_SHOWN, now),
    getMonthlyReportRows(range),
  ]);

  const active = items.filter((i) => !i.archived);
  const counts = countByStatus(active);
  const restock = active.filter((i) => i.status !== "AMAN").sort((a, b) => a.stock - b.stock);

  const maxUnits = Math.max(1, ...monthly.flatMap((b) => [b.APD, b.ATK]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Barang aktif</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{active.length}</p>
        </div>
        {(["AMAN", "MENIPIS", "HABIS"] as const).map((s) => (
          <div key={s} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t(`consumableStatus.${s}`)}</p>
            <p className={`mt-1 text-2xl font-semibold ${CONSUMABLE_STATUS_TONE[s].split(" ")[1]}`}>{counts[s]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Barang keluar per bulan</p>
            <span className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" /> APD</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> ATK</span>
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            {monthly.map((b) => (
              <div key={b.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div className="w-1/3 rounded-t bg-indigo-600" style={{ height: `${(b.APD / maxUnits) * 100}%` }} title={`APD ${b.APD}`} />
                  <div className="w-1/3 rounded-t bg-amber-400" style={{ height: `${(b.ATK / maxUnits) * 100}%` }} title={`ATK ${b.ATK}`} />
                </div>
                <span className="text-[10.5px] text-slate-500">{MONTH_LABELS_ID[Number(b.key.slice(5)) - 1]}</span>
                <span className="text-[10.5px] text-slate-400">
                  {b.APD}/{b.ATK}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Jumlah satuan yang keluar (APD/ATK), tidak termasuk transaksi dibatalkan.</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Perlu dibeli</p>
          {restock.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Semua stok aman.</p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100">
              {restock.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-900">{i.itemName}</span> <span className="font-mono text-xs text-slate-400">{i.itemCode}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    sisa {i.stock} / min {i.minStock}
                    <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${CONSUMABLE_STATUS_TONE[i.status]}`}>{t(`consumableStatus.${i.status}`)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Laporan bulanan · {monthLabel(selectedKey)}</p>
          <form className="flex items-center gap-2">
            <input type="month" name="month" defaultValue={selectedKey} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" />
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              Tampilkan
            </button>
            <a href={`/api/consumables/export?type=report&month=${selectedKey}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Ekspor Excel
            </a>
            <a href="/api/consumables/export?type=stock" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Ekspor stok
            </a>
          </form>
        </div>
        {report.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Tidak ada pergerakan stok pada bulan ini. <Link href="/consumables/items" className="text-indigo-600 hover:underline">Kelola barang</Link>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Barang</th>
                  <th className="px-3 py-2 text-right font-medium">Awal</th>
                  <th className="px-3 py-2 text-right font-medium">Masuk</th>
                  <th className="px-3 py-2 text-right font-medium">Keluar</th>
                  <th className="px-3 py-2 text-right font-medium">Penyesuaian</th>
                  <th className="px-3 py-2 text-right font-medium">Akhir</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.itemCode} className="border-t border-slate-100">
                    <td className="py-2">
                      <span className="text-slate-900">{r.itemName}</span> <span className="font-mono text-xs text-slate-400">{r.itemCode}</span>
                    </td>
                    <td className="px-3 text-right text-slate-600">{r.opening}</td>
                    <td className="px-3 text-right text-slate-600">{r.received}</td>
                    <td className="px-3 text-right text-slate-600">{r.issued}</td>
                    <td className="px-3 text-right text-slate-600">{r.adjusted > 0 ? `+${r.adjusted}` : r.adjusted}</td>
                    <td className="px-3 text-right font-semibold text-slate-900">{r.closing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
