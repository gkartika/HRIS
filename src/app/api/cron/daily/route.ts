import { NextResponse } from "next/server";
import { reconcileDueDailyAttendance } from "@/lib/attendance-reconciliation";
import { runDueRenewalScan } from "@/lib/renewal-scan";
import { runOffboardingDeactivations } from "@/lib/offboarding-deactivate";
import { applyDuePlacementChanges } from "@/lib/placement-schedule";
import { createDueMaintenanceWorkOrders } from "@/lib/maintenance-create";
import { finalizeExpiredTests } from "@/lib/recruitment-service";
import { finalizeExpiredAssessments } from "@/lib/recruitment-assessment-service";

// Daily scheduled job (Vercel Cron, see vercel.json): the two things that used
// to run — and write to the database — whenever someone opened the Kontrak or
// Rekonsiliasi Absensi pages. Vercel sends "Authorization: Bearer $CRON_SECRET";
// anything else is rejected, so this can't be triggered from a browser.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await reconcileDueDailyAttendance();
  const renewals = await runDueRenewalScan();
  // Access ends with the last working day: deactivate people whose Exit
  // Clearance was done early, and switch off the login of anyone still
  // waiting for clearance after their last day.
  const offboarding = await runOffboardingDeactivations();
  // Future-dated moves whose start date has arrived: new placement becomes
  // ACTIVE, the old one ENDED, current position and seat status follow.
  const placements = await applyDuePlacementChanges();
  // Preventive plans that are set to open their own work order and have come due.
  const maintenance = await createDueMaintenanceWorkOrders();
  // Applicants who left a test open: hand it in as it stands and grade it.
  const expiredTests = await finalizeExpiredTests();
  // Tes Situasi Kerja attempts past their 30 minutes: scored if complete, else closed without a score.
  const expiredAssessments = await finalizeExpiredAssessments();
  return NextResponse.json({
    ok: true,
    recruitmentTestsClosed: expiredTests,
    recruitmentAssessmentsClosed: expiredAssessments,
    renewalCasesCreated: renewals.created,
    employeesDeactivated: offboarding.deactivated,
    loginsDisabled: offboarding.loginsDisabled,
    placementChangesApplied: placements.activated,
    preventiveWorkOrdersCreated: maintenance.created,
  });
}
