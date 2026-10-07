import { StatusChip } from "@/components/status-chip";
import { CONSUMABLE_STATUS_TONE } from "@/lib/status-ui";
import Link from "next/link";
import { listItemsWithStock } from "@/lib/consumables-queries";
import { t } from "@/lib/i18n/id";
import { EmptyState } from "@/components/empty-state";
import type { ConsumableCategory } from "@/generated/prisma/enums";
import type { ConsumableStatusValue } from "@/lib/consumables";
import { ReceiptDialog, AdjustmentDialog } from "../stock-forms";
import { consumablesAccessDenied } from "../access";

export default async function ConsumableStockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; archived?: string }>;
}) {
  const denied = await consumablesAccessDenied();
  if (denied) return denied;
  const { q, category, status, archived } = await searchParams;
  const cat = category === "APD" || category === "ATK" ? (category as ConsumableCategory) : undefined;
  const statusFilter = status === "AMAN" || status === "MENIPIS" || status === "HABIS" ? status : undefined;
  const includeArchived = archived === "1";

  // Status is derived from the ledger, so it filters after stock is computed.
  const all = await listItemsWithStock({ includeArchived, category: cat, q });
  const items = statusFilter ? all.filter((i) => i.status === statusFilter) : all;
  const counts = { AMAN: 0, MENIPIS: 0, HABIS: 0 };
  for (const i of all) counts[i.status] += 1;

  const hasFilters = !!(q || cat || statusFilter || includeArchived);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {(["AMAN", "MENIPIS", "HABIS"] as const).map((s) => (
          <div key={s} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t(`consumableStatus.${s}`)}</p>
            <p className={`mt-1 text-2xl font-semibold ${CONSUMABLE_STATUS_TONE[s].split(" ")[1]}`}>{counts[s]}</p>
          </div>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Kode atau nama barang"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Kategori</label>
          <select name="category" defaultValue={cat ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            <option value="APD">APD</option>
            <option value="ATK">ATK</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select name="status" defaultValue={statusFilter ?? ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {(["AMAN", "MENIPIS", "HABIS"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`consumableStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs text-slate-600">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} />
          Tampilkan yang diarsipkan
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/consumables/stock" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          filtered={hasFilters}
          message="Belum ada barang habis pakai."
          resetHref="/consumables/stock"
          action={{ href: "/consumables/items", label: "Tambah barang" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Barang</th>
                <th className="px-3 py-3 text-right font-medium">Awal</th>
                <th className="px-3 py-3 text-right font-medium">Masuk</th>
                <th className="px-3 py-3 text-right font-medium">Keluar</th>
                <th className="px-3 py-3 text-right font-medium">Penyesuaian</th>
                <th className="px-3 py-3 text-right font-medium">Sisa</th>
                <th className="px-3 py-3 text-right font-medium">Min</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={`border-t border-slate-100 ${i.archived ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{i.itemName}</p>
                    <p className="font-mono text-xs text-slate-400">
                      {i.itemCode} · {i.category} · {i.unit}
                      {i.archived ? " · diarsipkan" : ""}
                    </p>
                  </td>
                  <td className="px-3 text-right text-slate-600">{i.openingStock}</td>
                  <td className="px-3 text-right text-slate-600">{i.totals.received}</td>
                  <td className="px-3 text-right text-slate-600">{i.totals.issued}</td>
                  <td className="px-3 text-right text-slate-600">{i.totals.adjusted > 0 ? `+${i.totals.adjusted}` : i.totals.adjusted}</td>
                  <td className="px-3 text-right font-semibold text-slate-900">{i.stock}</td>
                  <td className="px-3 text-right text-slate-600">{i.minStock}</td>
                  <td className="px-3">
                    <StatusChip tone={CONSUMABLE_STATUS_TONE[i.status]}>{t(`consumableStatus.${i.status}`)}</StatusChip>
                  </td>
                  <td className="whitespace-nowrap px-3 text-right">
                    {!i.archived && (
                      <span className="inline-flex gap-1.5">
                        <ReceiptDialog itemId={i.id} itemName={i.itemName} unit={i.unit} stock={i.stock} />
                        <AdjustmentDialog itemId={i.id} itemName={i.itemName} unit={i.unit} stock={i.stock} />
                      </span>
                    )}
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
