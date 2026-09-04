// DIAGNOSTIC: no-op middleware to isolate the Netlify edge crash.
// Original (next-auth based) version is in git history — restore with:
//   git checkout src/middleware.ts
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
