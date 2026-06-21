import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  // Login page and API are always accessible
  const path = request.nextUrl.pathname;
  if (path === "/admin/login" || path.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  const session = request.cookies.get("admin_session")?.value;
  if (!session || session !== process.env.ADMIN_SECRET) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
