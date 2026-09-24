import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Session } from "next-auth";

// Split out of permissions.ts on purpose: this file pulls in NextAuth/
// next/navigation (Next.js-runtime-only modules), while permissions.ts is
// kept dependency-free so its pure predicate/projection logic (isHrAdmin,
// projectEmployee, canViewEmployeeDocument, etc.) can be unit tested with
// plain mock objects under Vitest without dragging in the Next.js runtime.

// The login token only proves who someone was when they signed in — it can
// stay valid for days. So every request re-reads the account (one small query,
// shared by the whole request via `cache`): a DISABLED/LOCKED account is
// treated as signed out at once (e.g. right after Exit Clearance), and roles
// come from the database, so a role change applies immediately.
export const getActiveSession = cache(async (): Promise<Session | null> => {
  const session = await auth();
  if (!session?.user) return null;

  const account = await prisma.account.findUnique({
    where: { id: session.user.id },
    select: { accountStatus: true, employeeId: true, roles: { select: { role: true } } },
  });
  if (!account || account.accountStatus === "DISABLED" || account.accountStatus === "LOCKED") return null;

  return {
    ...session,
    user: { ...session.user, employeeId: account.employeeId, roles: account.roles.map((r) => r.role) },
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getActiveSession();
  if (!session) redirect("/login?reason=inactive");
  return session;
}
