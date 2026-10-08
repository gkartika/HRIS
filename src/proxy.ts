import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe route protection (Next.js 16 "proxy" convention, formerly
// middleware.ts). Uses the provider-less authConfig so this never pulls in
// Prisma/bcrypt (which need Node.js, not the Edge runtime). This is a
// convenience redirect only — the real enforcement for data access lives in
// server actions/route handlers via lib/permissions.ts, per CTL: "enforce
// permissions in the backend, not only by hiding buttons."
const { auth } = NextAuth(authConfig);

export function proxy(request: NextRequest) {
  // @ts-expect-error — auth() accepts a middleware-style handler signature
  // that isn't reflected in NextAuth's exported types.
  return auth(request);
}

export const config = {
  // Public files the sign-in page and the installable app need before anyone is
  // logged in (logo, icons, manifest, service worker, offline page).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|offline.html|logo-cbp|pwa/).*)",
  ],
};
