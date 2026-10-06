import Link from "next/link";
import { prisma } from "@/lib/db";
import { listItemsWithStock } from "@/lib/consumables-queries";
import { toggleConsumableItemArchived } from "../actions";
import { CreateItemForm, EditItemDialog } from "../item-forms";
import { consumablesAccessDenied } from "../access";

export default async function ConsumableItemsPage() {
  const denied = await consumablesAccessDenied();
  if (denied) return denied;
  const items = await listItemsWithStock({ includeArchived: true });

  // Which items already have ledger rows — their opening stock is then locked.
  const withTransactions = new Set(
    (await prisma.consumableItem.findMany({ where: { transactions: { some: {} } }, select: { id: true } })).map((i) => i.id)
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <CreateItemForm key={items.length} existingCodes={items.map((i) => i.itemCode)} />
      </div>
      <div className="lg:col-span-2">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Barang</th>
                <th className="px-2 py-3 font-medium">Periode</th>
                <th className="px-2 py-3 font-medium">Min</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    Belum ada barang. Tambahkan barang pertama di samping.
                  </td>
                </tr>
              )}
              {items.map((i) => (
                <tr key={i.id} className={`border-t border-slate-100 ${i.archived ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{i.itemName}</p>
                    <p className="font-mono text-xs text-slate-400">
                      {i.itemCode} · {i.category} · {i.unit}
                    </p>
                  </td>
                  <td className="px-2 text-slate-600">{i.replacementPeriodMonths ? `${i.replacementPeriodMonths} bulan` : "—"}</td>
                  <td className="px-2 text-slate-600">{i.minStock}</td>
                  <td className="px-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${i.archived ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {i.archived ? "Diarsipkan" : "Aktif"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 text-right">
                    <span className="inline-flex gap-1.5">
                      <EditItemDialog item={i} hasTransactions={withTransactions.has(i.id)} />
                      {!i.archived && (
                        <Link href={`/consumables/labels?item=${i.id}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                          Label QR
                        </Link>
                      )}
                      <form action={toggleConsumableItemArchived.bind(null, i.id)}>
                        <button type="submit" className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                          {i.archived ? "Aktifkan" : "Arsipkan"}
                        </button>
                      </form>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/consumables/labels" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cetak label semua barang aktif
          </Link>
          <Link href="/import" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Impor data dari sistem lama
          </Link>
          <a href="/api/consumables/export?type=stock" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Ekspor stok (Excel)
          </a>
        </div>
        <p className="mt-2 text-[11.5px] text-slate-400">
          Tidak ada tombol hapus. Barang yang tidak dipakai lagi diarsipkan: hilang dari daftar pilihan dan label, riwayat dan stoknya tetap utuh.
        </p>
      </div>
    </div>
  );
}
