import type { NextAuthConfig, DefaultSession } from "next-auth";
import type { AccountType, AdminScope, AppRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountType: AccountType;
      adminScope: AdminScope;
      employeeId: string | null;
      roles: AppRole[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accountId: string;
    accountType: AccountType;
    adminScope: AdminScope;
    employeeId: string | null;
    roles: AppRole[];
  }
}

// Edge-safe subset of the NextAuth config: no providers here (those touch
// Prisma/bcrypt, which need the Node.js runtime). This is what middleware.ts
// loads so route protection can run without pulling in native DB bindings.
// The full config in auth.ts spreads this and adds the Credentials provider.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as unknown as {
          id: string;
          accountType: AccountType;
          adminScope: AdminScope;
          employeeId: string | null;
          roles: AppRole[];
        };
        token.accountId = u.id;
        token.accountType = u.accountType;
        token.adminScope = u.adminScope;
        token.employeeId = u.employeeId;
        token.roles = u.roles;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.accountId;
      session.user.accountType = token.accountType;
      session.user.adminScope = token.adminScope;
      session.user.employeeId = token.employeeId;
      session.user.roles = token.roles;
      return session;
    },
    authorized: ({ auth, request }) => {
      const isLoggedIn = !!auth?.user;
      // Pages an employee must reach before they have a session, plus the public
      // recruitment pages (applicants have no account; those pages check access themselves).
      const { pathname } = request.nextUrl;
      if (["/login", "/forgot-password", "/set-password", "/cbp-recruitment"].some((p) => pathname.startsWith(p))) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
