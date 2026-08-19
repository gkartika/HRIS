import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { authConfig } from "@/lib/auth.config";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        usernameOrEmail: { label: "usernameOrEmail", type: "text" },
        password: { label: "password", type: "password" },
      },
      authorize: async (credentials) => {
        const usernameOrEmail = credentials?.usernameOrEmail as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!usernameOrEmail || !password) return null;

        const account = await prisma.account.findUnique({
          where: { usernameOrEmail },
          include: { roles: true, employee: true },
        });

        if (!account) {
          await logAudit({
            actorAccountId: null,
            action: "LOGIN_FAILED",
            datasetName: "Account",
            reason: `Percobaan masuk dengan pengguna tidak dikenal: ${usernameOrEmail}`,
          });
          return null;
        }

        if (account.accountStatus === "DISABLED" || account.accountStatus === "LOCKED") {
          await logAudit({
            actorAccountId: account.id,
            action: "LOGIN_FAILED",
            datasetName: "Account",
            recordId: account.id,
            reason: `Login blocked — account status is ${account.accountStatus}`,
          });
          return null;
        }

        const passwordValid = await bcrypt.compare(password, account.passwordHash);
        if (!passwordValid) {
          const failedLoginCount = account.failedLoginCount + 1;
          const shouldLock = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS;
          await prisma.account.update({
            where: { id: account.id },
            data: {
              failedLoginCount,
              accountStatus: shouldLock ? "LOCKED" : account.accountStatus,
            },
          });
          await logAudit({
            actorAccountId: account.id,
            action: "LOGIN_FAILED",
            datasetName: "Account",
            recordId: account.id,
            reason: shouldLock
              ? "Incorrect password — account locked after 5 failed attempts"
              : `Incorrect password (attempt ${failedLoginCount})`,
          });
          return null;
        }

        await prisma.account.update({
          where: { id: account.id },
          data: { failedLoginCount: 0, lastLoginAt: new Date() },
        });
        await logAudit({
          actorAccountId: account.id,
          action: "LOGIN",
          datasetName: "Account",
          recordId: account.id,
        });

        return {
          id: account.id,
          name: account.employee?.fullLegalName ?? account.usernameOrEmail,
          email: account.usernameOrEmail,
          accountType: account.accountType,
          adminScope: account.adminScope,
          employeeId: account.employeeId,
          roles: account.roles.map((r) => r.role),
        };
      },
    }),
  ],
});
