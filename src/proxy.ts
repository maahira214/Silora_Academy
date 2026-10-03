import { NextResponse, type NextRequest } from "next/server";

// Fast redirect for signed-out visitors. Real authorization happens on the
// server in every page/action/route via src/lib/authz.ts.
export function proxy(req: NextRequest) {
  if (!req.cookies.has("silora_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/student/:path*", "/join/:path*", "/classes/:path*", "/messages/:path*", "/notifications/:path*"],
};
