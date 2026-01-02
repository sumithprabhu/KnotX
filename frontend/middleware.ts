import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow access to base route and login
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  // For all other routes, check authentication
  // Note: Privy handles client-side auth, so we'll redirect to login
  // The actual auth check happens in the app layout
  if (pathname.startsWith("/app")) {
    // This will be handled by client-side auth check
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}




