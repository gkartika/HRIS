import { NextResponse } from "next/server";

// Which build of the app is live. Open tabs and installed apps ask this now and then (see
// components/app-update-watcher.tsx) and refresh themselves when it differs from the build they were
// loaded from. Public and tiny on purpose: it says nothing about anyone or anything.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
