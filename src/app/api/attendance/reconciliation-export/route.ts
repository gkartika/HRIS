import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { reconcileDueDailyAttendance } from "@/lib/attendance-reconciliation";
import { resolveCutoffPeriod, parseCutoffParam, formatCutoffParam } from "@/lib/absence-cutoff";
import { getReconciliationGrid } from "@/lib/attendance-reconciliation-queue";
import { buildReconciliationExportSheet } from "@/lib/attendance-reconciliation-export";

// Excel export for Rekonsiliasi Grid (Opsi B), per direct request — same
// employee scope (activeFlag + Departemen/Cari Nama filters) and same
// payroll cutoff period as whatever's currently selected on the Grid page,
// HR-Admin-only like the rest of Rekonsiliasi. The `xlsx` package is
// already in this app for reading Fingerprint imports (its known CVEs were
// accepted there since the upload path is HR-Admin-only — same access
// boundary applies here); this is its first *writing* use.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHrAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cutoff = searchParams.get("cutoff") ?? undefined;
  const orgUnitId = searchParams.get("orgUnitId") ?? undefined;
  const search = searchParams.get("q")?.trim() ?? "";

  await reconcileDueDailyAttendance();

  const referenceDate = parseCutoffParam(cutoff) ?? new Date();
  const period = resolveCutoffPeriod(referenceDate);

  const employeeIds = await prisma.employee
    .findMany({
      where: {
        activeFlag: true,
        ...(orgUnitId ? { currentPosition: { orgUnitId } } : {}),
        ...(search ? { fullLegalName: { contains: search, mode: "insensitive" } } : {}),
      },
      select: { id: true },
      orderBy: { fullLegalName: "asc" },
    })
    .then((rows) => rows.map((r) => r.id));

  const rows = await getReconciliationGrid(period, employeeIds);
  const sheet = buildReconciliationExportSheet(rows);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheet);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekonsiliasi");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "DailyAttendanceRecord",
    reason: `Exported Rekonsiliasi Grid for periode ${period.label} (${rows.length} karyawan)`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekonsiliasi-${formatCutoffParam(period.start)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
