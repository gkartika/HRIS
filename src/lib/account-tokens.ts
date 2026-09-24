import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { AccountTokenPurpose } from "@/generated/prisma/enums";

// Invitation links live 7 days, reset links 1 day (per the login design
// answers). Each link works once.
export const TOKEN_TTL_MS: Record<AccountTokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  RESET: 24 * 60 * 60 * 1000,
};

// Minimum gap between two emails for the same account (forgot-password is a
// public form — this keeps it from being used to flood someone's inbox).
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Creates a fresh link for the account and voids any earlier unused ones, so
// only the newest email works. Only the hash is stored; the raw token exists
// just long enough to be put in the email.
export async function createAccountToken(accountId: string, purpose: AccountTokenPurpose): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction([
    prisma.accountToken.updateMany({ where: { accountId, usedAt: null }, data: { usedAt: now } }),
    prisma.accountToken.create({
      data: {
        accountId,
        purpose,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
      },
    }),
  ]);
  return rawToken;
}

export function isTokenUsable(token: { usedAt: Date | null; expiresAt: Date }, now: Date = new Date()): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}

export async function findUsableToken(rawToken: string) {
  if (!rawToken) return null;
  const token = await prisma.accountToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { account: { include: { employee: { select: { fullLegalName: true } } } } },
  });
  return token && isTokenUsable(token) ? token : null;
}

export async function recentlyIssuedToken(accountId: string, now: Date = new Date()): Promise<boolean> {
  const latest = await prisma.accountToken.findFirst({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return !!latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS;
}
