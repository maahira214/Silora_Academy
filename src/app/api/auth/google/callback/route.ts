import { decodeIdToken } from "arctic";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, createSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { googleClient } from "@/lib/auth/google";
import { homeFor } from "@/lib/authz";

type GoogleClaims = { sub: string; email?: string; email_verified?: boolean; name?: string };

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, appUrl));
  if (!rateLimit(`signin:${clientIp(req.headers) ?? "unknown"}`, LIMITS.signIn).ok) return fail("too_many_attempts");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const storedState = jar.get("google_oauth_state")?.value;
  const verifier = jar.get("google_code_verifier")?.value;
  jar.delete("google_oauth_state");
  jar.delete("google_code_verifier");

  if (!code || !state || !storedState || !verifier || state !== storedState) return fail("invalid_request");

  let claims: GoogleClaims;
  try {
    const tokens = await googleClient().validateAuthorizationCode(code, verifier);
    // The ID token comes straight from Google's token endpoint over TLS.
    claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  } catch {
    return fail("google_failed");
  }

  const email = claims.email?.toLowerCase();
  if (!email || !claims.email_verified) return fail("email_unverified");

  // Accounts are created by Silora only — signing in never creates a user.
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return fail("not_registered");
  if (user.status !== "ACTIVE") {
    await audit({ orgId: user.orgId, actorId: user.id, action: "LOGIN", targetType: "User", targetId: user.id, result: "DENIED", metadata: { reason: user.status } });
    return fail("account_inactive");
  }
  if (user.googleSub && user.googleSub !== claims.sub) {
    await audit({ orgId: user.orgId, actorId: user.id, action: "LOGIN", targetType: "User", targetId: user.id, result: "DENIED", metadata: { reason: "google_account_mismatch" } });
    return fail("account_mismatch");
  }

  await db.user.update({
    where: { id: user.id },
    data: { googleSub: claims.sub, lastLoginAt: new Date() },
  });
  await createSession(user.id);
  await audit({ orgId: user.orgId, actorId: user.id, action: "LOGIN", targetType: "User", targetId: user.id, metadata: { method: "google" } });

  return NextResponse.redirect(new URL(homeFor(user.role), appUrl));
}
