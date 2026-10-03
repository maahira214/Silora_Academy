import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleClient, googleConfigured } from "@/lib/auth/google";

export async function GET() {
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
