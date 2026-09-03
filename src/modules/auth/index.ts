import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { loginSchema } from "@/modules/account/presentation/schemas";

import { verifyCredentials } from "./application/authenticate";
import { authConfig } from "./infrastructure/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        phoneNumber: { label: "휴대폰 번호", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.phoneNumber, parsed.data.password);
      },
    }),
  ],
});

export const { GET, POST } = handlers;
