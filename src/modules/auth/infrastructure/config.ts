import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/core/db/schema";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 30 },
  pages: { signIn: "/login" },
  providers: [], // real provider is added in ./index.ts
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = Number(user.id);
        token.role = (user as { role: Role }).role;
        token.mustChangePassword = (user as { mustChangePassword: boolean }).mustChangePassword;
      }
      // Client calls `updateSession({ mustChangePassword: false })` right after a
      // successful password change so the JWT reflects it without re-login.
      if (trigger === "update" && session && "mustChangePassword" in session) {
        token.mustChangePassword = Boolean(session.mustChangePassword);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.role = token.role as Role;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
