import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/modules/auth/infrastructure/config";

const { auth } = NextAuth(authConfig);

const MANAGER_ONLY_PREFIXES = ["/api/staff", "/api/schedules/manager-edit", "/admin"];

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const user = req.auth?.user;
  const isApi = pathname.startsWith("/api/");

  // Auth.js's own endpoints and the auth pages must stay open.
  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (pathname === "/login" || pathname === "/change-password") {
    return NextResponse.next();
  }

  if (!user) {
    if (isApi) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const needsManager = MANAGER_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
  if (needsManager && user.role !== "MANAGER") {
    if (isApi) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: "FORBIDDEN", message: "권한이 없습니다." },
        },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Everything except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
