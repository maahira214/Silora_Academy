import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { googleClient, googleConfigured } from "@/lib/auth/google";
import { clientIp } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  if (!rateLimit(`signin:${clientIp(req.headers) ?? "unknown"}`, LIMITS.signIn).ok) {
    return NextResponse.redirect(new URL("/login?error=too_many_attempts", process.env.APP_URL ?? req.nextUrl.origin));
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", process.env.APP_URL));
  }
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);
  url.searchParams.set("prompt", "select_account");

  const jar = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  jar.set("google_oauth_state", state, opts);
  jar.set("google_code_verifier", codeVerifier, opts);
  return NextResponse.redirect(url);
}
