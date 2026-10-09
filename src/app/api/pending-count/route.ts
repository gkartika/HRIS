import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { getPendingApprovals, countPendingApprovals } from "@/lib/pending-approvals";
import { prisma } from "@/lib/db";
import { DEFAULT_PREFS, prefsFromAccount } from "@/lib/notification-prefs";

// How many approvals are waiting for the signed-in person (the same number as
// the "Perlu Persetujuan Anda" box on Beranda) and where they want it shown.
// Feeds the number on the app icon, the side menu and the tab title (see
// components/app-badge-sync.tsx and public/sw.js).
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ count: 0 }, { status: 401, headers });
  const [pending, account] = await Promise.all([
    getPendingApprovals(session),
    prisma.account.findUnique({
      where: { id: session.user.id },
      select: { notifyIconBadge: true, notifyMenuBadge: true, notifyTabTitle: true },
    }),
  ]);
  const prefs = account ? prefsFromAccount(account) : DEFAULT_PREFS;
  return NextResponse.json({ count: countPendingApprovals(pending), prefs }, { headers });
}
