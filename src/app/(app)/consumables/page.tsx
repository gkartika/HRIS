import { prisma } from "@/lib/db";
import { listItemsWithStock } from "@/lib/consumables-queries";
import { TakeForm } from "./take-form";
import { consumablesAccessDenied } from "./access";

// Catat Pengambilan — the GA Admin's everyday screen. The gate lives in
// consumables/layout.tsx.
export default async function ConsumableTakePage() {
  const denied = await consumablesAccessDenied();
  if (denied) return denied;
  const [items, departments] = await Promise.all([
    listItemsWithStock(),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT", activeFlag: true }, orderBy: { unitName: "asc" }, select: { id: true, unitName: true } }),
  ]);

  return (
    <TakeForm
      items={items.map((i) => ({
        id: i.id,
        itemCode: i.itemCode,
        itemName: i.itemName,
        category: i.category,
        unit: i.unit,
        stock: i.stock,
        replacementPeriodMonths: i.replacementPeriodMonths,
      }))}
      departments={departments.map((d) => ({ id: d.id, name: d.unitName }))}
    />
  );
}
