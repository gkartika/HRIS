import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getActiveSession } from "@/lib/require-session";
import {
  canManageOrgStructure,
  canCreateEmployee,
  isHrAdmin,
  canImportFingerprintAttendance,
  canRunCompetencyHistoricalMigration,
  canImportMandatoryTrainingParticipants,
  canImportTrainingAttendance,
  canImportAssetMaster,
  canManageConsumables,
} from "@/lib/permissions";
import { DATASET_REGISTRY, isDatasetKey } from "@/lib/import-export/registry";
import { templateCsv } from "@/lib/import-export/csv";

function canAccessDataset(session: Session, dataset: string): boolean {
  if (dataset === "employees") return canCreateEmployee(session);
  if (dataset === "assignments") return isHrAdmin(session);
  if (dataset === "fingerprint-attendance") return canImportFingerprintAttendance(session);
  if (dataset === "competency-migration") return canRunCompetencyHistoricalMigration(session);
  if (dataset === "mandatory-training-participants") return canImportMandatoryTrainingParticipants(session);
  if (dataset === "training-attendance") return canImportTrainingAttendance(session);
  if (dataset === "asset-master") return canImportAssetMaster(session);
  if (dataset.startsWith("consumable-")) return canManageConsumables(session);
  return canManageOrgStructure(session);
}

export async function GET(_request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatasetKey(dataset)) return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
  if (!canAccessDataset(session, dataset)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mod = DATASET_REGISTRY[dataset];
  const csv = templateCsv(mod.templateHeaders, mod.templateExampleRow);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="template-${dataset}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
