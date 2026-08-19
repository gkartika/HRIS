import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canViewAssetMaster } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";
import type { AssetCustodyStatus } from "@/generated/prisma/enums";

const HEADERS = [
  "assetCode",
  "assetName",
  "targetType",
  "target",
  "quantity",
  "status",
  "assignedAt",
  "returnedAt",
  "inspectionResult",
];

// CTL-13: GA-Admin-only, matching the Asset Master list page's own gate —
// custody records are GA data, same access boundary as everywhere else in
// Phase 4A (HR Admin never reaches this, only the completion/blocker status
// folded into Onboarding/Offboarding).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewAssetMaster(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const custodies = await prisma.assetCustody.findMany({
    where: status ? { status: status as AssetCustodyStatus } : undefined,
    include: {
      asset: { select: { assetCode: true, assetName: true } },
      employee: { select: { employeeNumber: true, fullLegalName: true } },
      orgUnit: { select: { unitName: true } },
      location: { select: { locationName: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    custodies.map((c) => ({
      assetCode: c.asset.assetCode,
      assetName: c.asset.assetName,
      targetType: c.targetType,
      target:
        c.targetType === "EMPLOYEE" && c.employee
          ? `${c.employee.employeeNumber} — ${c.employee.fullLegalName}`
          : (c.targetType === "DEPARTMENT" ? c.orgUnit?.unitName : c.location?.locationName) ?? "",
      quantity: String(c.quantity),
      status: c.status,
      assignedAt: c.assignedAt.toISOString().slice(0, 10),
      returnedAt: c.returnedAt ? c.returnedAt.toISOString().slice(0, 10) : "",
      inspectionResult: c.inspectionResult ?? "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "AssetCustody",
    reason: `Exported ${custodies.length} asset custody record(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asset-custodies.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
