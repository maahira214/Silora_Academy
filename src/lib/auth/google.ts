import "server-only";
import { Google } from "arctic";

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function googleClient() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${appUrl}/api/auth/google/callback`,
  );
}

/** Dev-only sign-in shortcut. Hard-disabled in production builds. */
export const devLoginEnabled = () => process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";
