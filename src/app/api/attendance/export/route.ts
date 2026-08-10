import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isHrAdmin, canExportAttendanceData } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { computeAttendanceRecordsForDate } from "@/lib/attendance-records";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";
import { t } from "@/lib/i18n/id";
import type { Prisma } from "@/generated/prisma/client";

const HEADERS = ["employeeNumber", "name", "department", "checkInAt", "checkOutAt", "exceptions"];

// CTL-13: "permission-filtered XLSX/CSV export" applied to Attendance — same
// visibility scope as the Attendance Records page itself (HR Admin sees
// everyone, a Level-3 holder only their own department's employees).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canExportAttendanceData(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();

  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);
  if (!isHrAdminUser && level3DepartmentIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const positionFilter: Prisma.PositionWhereInput = {};
  if (!isHrAdminUser) {
    positionFilter.orgUnit = {
      OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }],
    };
  }

  const employees = await prisma.employee.findMany({
    where: {
      activeFlag: true,
      ...(Object.keys(positionFilter).length > 0 ? { currentPosition: positionFilter } : {}),
    },
    select: { id: true },
  });

  const records = await computeAttendanceRecordsForDate(employees.map((e) => e.id), date);
  const csv = rowsToCsv(
    HEADERS,
    records.map((r) => ({
      employeeNumber: r.employeeNumber,
      name: r.name,
      department: r.departmentName,
      checkInAt: r.checkInAt ? r.checkInAt.toISOString() : "",
      checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : "",
      exceptions: r.exceptions.map((ex) => t(`attendanceException.${ex}`)).join("; "),
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "AttendanceRecord",
    reason: `Exported ${records.length} attendance record(s) for ${date.toISOString().slice(0, 10)}`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${date.toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
