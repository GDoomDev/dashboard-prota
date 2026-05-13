import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("session");
  const role = request.cookies.get("role")?.value;
  const { pathname, searchParams } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Regular users can only access /times without entity selection
  if (session && role === "user") {
    if (!pathname.startsWith("/times")) {
      return NextResponse.redirect(new URL("/times", request.url));
    }
    if (searchParams.get("entity")) {
      const url = new URL("/times", request.url);
      // Preserve period params, strip entity
      for (const key of ["preset", "start", "end"]) {
        const v = searchParams.get(key);
        if (v) url.searchParams.set(key, v);
      }
      return NextResponse.redirect(url);
    }
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
