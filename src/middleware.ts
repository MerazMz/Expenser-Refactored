import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isPublicRoute = pathname === "/login";
  const isProtectedRoot = pathname === "/" || pathname === "/dashboard" || pathname === "/calendar" || pathname === "/insights" || pathname === "/settings" || pathname === "/onboarding";

  // 1. Unauthenticated users trying to access protected routes -> Redirect to /login
  if (!token && isProtectedRoot) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated users trying to access /login -> Redirect to /dashboard
  if (token && isPublicRoute) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 3. Root path / -> Redirect to /dashboard if authenticated
  if (pathname === "/") {
    const targetUrl = token ? new URL("/dashboard", request.url) : new URL("/login", request.url);
    return NextResponse.redirect(targetUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
