import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getActiveSession } from "@/lib/require-session";
import {
  canManageOrgStructure,
  canListEmployees,
  isHrAdmin,
  canExportAttendanceData,
  canRunCompetencyHistoricalMigration,
  canImportMandatoryTrainingParticipants,
  canImportTrainingAttendance,
  canViewAssetMaster,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { DATASET_REGISTRY, isDatasetKey } from "@/lib/import-export/registry";
import { rowsToCsv } from "@/lib/import-export/csv";

function canAccessDataset(session: Session, dataset: string): boolean {
  if (dataset === "employees") return canListEmployees(session);
  if (dataset === "assignments") return isHrAdmin(session);
  if (dataset === "fingerprint-attendance") return canExportAttendanceData(session);
  if (dataset === "competency-migration") return canRunCompetencyHistoricalMigration(session);
  if (dataset === "mandatory-training-participants") return canImportMandatoryTrainingParticipants(session);
  if (dataset === "training-attendance") return canImportTrainingAttendance(session);
  if (dataset === "asset-master") return canViewAssetMaster(session);
  return canManageOrgStructure(session);
}

// CTL-13: "permission-filtered XLSX/CSV export ... sensitive exports require
// explicit permission and audit logging." Every export is logged as an
// EXPORT audit event, and Employee export reuses the same field projection
// as the UI so a Training/GA Admin export can't leak more than their screen
// view already shows.
export async function GET(_request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatasetKey(dataset)) return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
  if (!canAccessDataset(session, dataset)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mod = DATASET_REGISTRY[dataset];
  const { headers, rows } = await mod.exportData(session);
  const csv = rowsToCsv(headers, rows);

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: mod.label,
    reason: `Exported ${rows.length} row(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${dataset}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
