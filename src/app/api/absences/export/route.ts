import { csvResponse } from "@/lib/csv-response";
import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { canExportAbsenceData } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";
import { t } from "@/lib/i18n/id";

const HEADERS = ["requestNumber", "employeeNumber", "name", "absenceType", "startDate", "endDate", "status"];

// CTL-13: "permission-filtered XLSX/CSV export" — HR Admin only, same as
// every other sensitive export in this app (canExportAbsenceData).
export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canExportAbsenceData(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const absenceType = searchParams.get("absenceType");

  const requests = await prisma.absenceRequest.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(absenceType ? { absenceTypeCode: absenceType } : {}),
    },
    include: { employee: { select: { employeeNumber: true, fullLegalName: true } }, absenceType: true },
    orderBy: { submittedAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    requests.map((r) => ({
      requestNumber: r.requestNumber,
      employeeNumber: r.employee.employeeNumber,
      name: r.employee.fullLegalName,
      absenceType: r.absenceType.label,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      status: t(`absenceStatus.${r.status}`),
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "AbsenceRequest",
    reason: `Exported ${requests.length} absence request(s)`,
  });

  return csvResponse(csv, `absences-${new Date().toISOString().slice(0, 10)}.csv`);
}
