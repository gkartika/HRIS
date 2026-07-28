import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

// Split out of permissions.ts on purpose: this file pulls in NextAuth/
// next/navigation (Next.js-runtime-only modules), while permissions.ts is
// kept dependency-free so its pure predicate/projection logic (isHrAdmin,
// projectEmployee, canViewEmployeeDocument, etc.) can be unit tested with
// plain mock objects under Vitest without dragging in the Next.js runtime.
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}
