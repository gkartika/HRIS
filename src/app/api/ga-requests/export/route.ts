import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageGaOperations } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";
import type { GaRequestType, GaRequestStatus } from "@/generated/prisma/enums";

const HEADERS = ["requestNumber", "requestType", "status", "urgency", "requester", "asset", "submittedAt", "processedAt"];

// GA-Admin-only, matching the /ga-requests list page's own gate —
// "permission-scoped exports" per the Phase 4B spec.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageGaOperations(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestType = searchParams.get("requestType");
  const status = searchParams.get("status");

  const requests = await prisma.gaRequest.findMany({
    where: {
      ...(requestType ? { requestType: requestType as GaRequestType } : {}),
      ...(status ? { status: status as GaRequestStatus } : {}),
    },
    include: {
      requester: { select: { employeeNumber: true, fullLegalName: true } },
      asset: { select: { assetCode: true, assetName: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    requests.map((r) => ({
      requestNumber: r.requestNumber,
      requestType: r.requestType,
      status: r.status,
      urgency: r.urgency,
      requester: `${r.requester.employeeNumber} — ${r.requester.fullLegalName}`,
      asset: r.asset ? `${r.asset.assetCode} — ${r.asset.assetName}` : "",
      submittedAt: r.submittedAt.toISOString().slice(0, 10),
      processedAt: r.processedAt ? r.processedAt.toISOString().slice(0, 10) : "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "GaRequest",
    reason: `Exported ${requests.length} GA request(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ga-requests.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
