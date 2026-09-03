import type { DefaultSession } from "next-auth";

import type { Role } from "@/core/db/schema";

declare module "next-auth" {
  interface Session {
    // `id` stays a string (next-auth convention). Guards parse it to a number.
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: number;
    role: Role;
    mustChangePassword: boolean;
  }
}

export {};
