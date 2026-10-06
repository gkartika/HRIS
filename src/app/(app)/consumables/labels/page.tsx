import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { PrintButton } from "../print-button";
import { consumablesAccessDenied } from "../access";

// Printable QR labels. The QR carries only the item code, so a label stays
// valid if the item is later renamed. ?item=<id> prints one label; with no
// parameter it prints every active (non-archived) item.
export default async function ConsumableLabelsPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const denied = await consumablesAccessDenied();
  if (denied) return denied;
  const { item: itemId } = await searchParams;
  const items = await prisma.consumableItem.findMany({
    where: itemId ? { id: itemId, archived: false } : { archived: false },
    orderBy: [{ category: "asc" }, { itemCode: "asc" }],
  });
  const labels = await Promise.all(
    items.map(async (i) => ({
      item: i,
      svg: await QRCode.toString(i.itemCode, { type: "svg", margin: 0, errorCorrectionLevel: "M" }),
    }))
  );

  return (
    <div>
      {/* Print only the label sheet, whatever the surrounding app shell is. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #label-sheet, #label-sheet * { visibility: visible !important; }
        #label-sheet { position: absolute; left: 0; top: 0; width: 100%; }
      }`}</style>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{itemId ? "Label QR barang" : "Label QR semua barang aktif"}</p>
          <p className="text-xs text-slate-500">{labels.length} label · isi QR = kode barang</p>
        </div>
        <div className="flex gap-2">
          <Link href="/consumables/items" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Kembali
          </Link>
          {labels.length > 0 && <PrintButton label="Cetak label" />}
        </div>
      </div>
      {labels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Tidak ada barang aktif untuk dicetak.
        </p>
      ) : (
        <div id="label-sheet" className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {labels.map(({ item, svg }) => (
            <div key={item.id} className="flex items-center gap-3 break-inside-avoid rounded-lg border border-slate-300 bg-white p-3">
              <div className="h-20 w-20 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight text-slate-900">{item.itemName}</p>
                <p className="font-mono text-xs text-slate-500">{item.itemCode}</p>
                <p className="text-[11px] text-slate-400">
                  {item.unit} · {item.category}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
