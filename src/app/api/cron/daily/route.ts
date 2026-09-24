import { NextResponse } from "next/server";
import { reconcileDueDailyAttendance } from "@/lib/attendance-reconciliation";
import { runDueRenewalScan } from "@/lib/renewal-scan";

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
  return NextResponse.json({ ok: true, renewalCasesCreated: renewals.created });
}
