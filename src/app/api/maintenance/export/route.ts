import { csvResponse } from "@/lib/csv-response";
import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";

const HEADERS = ["workOrderNumber", "asset", "sourceType", "workType", "status", "serviceDate", "outcome", "cost"];

// GA-Admin-only, matching the /maintenance/work-orders list page's own gate.
export async function GET() {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageGaOperations(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workOrders = await prisma.maintenanceWorkOrder.findMany({
    include: { asset: { select: { assetCode: true, assetName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    workOrders.map((w) => ({
      workOrderNumber: w.workOrderNumber,
      asset: `${w.asset.assetCode} — ${w.asset.assetName}`,
      sourceType: w.sourceType,
      workType: w.workType,
      status: w.status,
      serviceDate: w.serviceDate ? w.serviceDate.toISOString().slice(0, 10) : "",
      outcome: w.outcome ?? "",
      cost: w.cost !== null ? String(w.cost) : "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "MaintenanceWorkOrder",
    reason: `Exported ${workOrders.length} maintenance work order(s)`,
  });

  return csvResponse(csv, "maintenance-work-orders.csv");
}
