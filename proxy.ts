import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/signin"];
const ONBOARDING_PATH = "/onboarding";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const user = req.auth.user;
  const profileIncomplete =
    !user?.username || !user?.firstName || !user?.lastName;

  if (profileIncomplete && pathname !== ONBOARDING_PATH) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
  }

  if (!profileIncomplete && pathname === ONBOARDING_PATH) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
