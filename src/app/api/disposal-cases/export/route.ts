import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";

const HEADERS = ["caseNumber", "asset", "reason", "status", "executionMethod", "executionDate", "executionValue"];

// GA-Admin-only, matching the /disposal-cases list page's own gate.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageGaOperations(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cases = await prisma.disposalCase.findMany({
    include: { asset: { select: { assetCode: true, assetName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    cases.map((c) => ({
      caseNumber: c.caseNumber,
      asset: `${c.asset.assetCode} — ${c.asset.assetName}`,
      reason: c.reason,
      status: c.status,
      executionMethod: c.executionMethod ?? "",
      executionDate: c.executionDate ? c.executionDate.toISOString().slice(0, 10) : "",
      executionValue: c.executionValue !== null ? String(c.executionValue) : "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "DisposalCase",
    reason: `Exported ${cases.length} disposal case(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="disposal-cases.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
