import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getActiveSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { monthName, parseMonthKey } from "@/lib/bpjs-reminders";
import { getMonthlyList } from "@/lib/bpjs-queries";
import { buildBpjsListSheet } from "@/lib/bpjs-export";

// Excel of the monthly BPJS TK list of harian lepas and magang. Admin SDM only: it holds NIK and birth dates, so the
// download is written to the audit log.
export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHrAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const month = parseMonthKey(new URL(request.url).searchParams.get("bulan") ?? "");
  if (!month) return NextResponse.json({ error: "Bulan tidak valid" }, { status: 400 });

  const rows = await getMonthlyList(month.year, month.monthIndex);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildBpjsListSheet(rows)), "Daftar BPJS TK");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "Employee",
    reason: `Exported daftar BPJS TK harian lepas dan magang ${monthName(month.monthIndex)} ${month.year} (${rows.length} orang)`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="daftar-bpjs-tk-${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
