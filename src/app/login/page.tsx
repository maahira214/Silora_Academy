import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { devLoginEnabled, googleConfigured } from "@/lib/auth/google";
import { homeFor } from "@/lib/authz";
import { Logo } from "@/components/logo";
import { Card, Eyebrow, Notice } from "@/components/ui";
import { devLogin } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_registered: "This Google account isn't registered with Silora Academy. Please contact Silora to get access.",
  account_inactive: "This account is not active. Please contact Silora Academy.",
  account_mismatch: "This email is linked to a different Google account. Please contact Silora Academy.",
  email_unverified: "Your Google email address isn't verified.",
  google_failed: "Google sign-in failed. Please try again.",
  too_many_attempts: "Too many sign-in attempts. Please wait 10 minutes and try again.",
  invalid_request: "Your sign-in link expired. Please try again.",
  google_not_configured: "Google sign-in hasn't been configured yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
};

const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", OPERATIONS: "Operations", TEACHER: "Teacher", STUDENT: "Student" } as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;

  const devUsers = devLoginEnabled()
    ? await db.user.findMany({ where: { status: "ACTIVE" }, orderBy: [{ role: "asc" }, { name: "asc" }], take: 30 })
    : [];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo inverted className="h-14" />
        <div className="max-w-md">
          <span className="inline-flex rounded-full border border-gold-500/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-400">
            Classes · Messages · Support
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight">
            Learning, <span className="italic text-gold-500">simplified.</span>
          </h1>
          <p className="mt-4 text-lg font-light text-navy-100">
            Join your classes, message your teacher or student and get class updates, all in one place.
          </p>
        </div>
        <p className="text-xs text-navy-300">
          © {new Date().getFullYear()} Silora Academy ·{" "}
          <Link href="/privacy" className="underline hover:text-white">
            Privacy policy
          </Link>
        </p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-gold-500/10" />
      </div>

      <div className="flex items-center justify-center bg-slate-50 p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-14" />
          </div>
          <Card className="p-8">
            <Eyebrow>Welcome back</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold text-navy-900">Sign in to Silora Academy</h2>
            <p className="mt-1 text-sm text-slate-600">Use the Google account registered with Silora.</p>

            {error && (
              <div className="mt-5">
                <Notice tone="danger">{error}</Notice>
              </div>
            )}

            <a
              href="/api/auth/google"
              className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-50"
            >
              <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </a>
            {!googleConfigured() && <p className="mt-2 text-center text-xs text-slate-500">Google sign-in is not configured in this environment.</p>}

            <p className="mt-6 text-center text-xs text-slate-500">
              Don&apos;t have access? Contact Silora Academy. Accounts are created by Silora only.
            </p>
            <p className="mt-2 text-center text-xs">
              <Link href="/privacy" className="font-semibold text-gold-700 underline">
                Privacy policy
              </Link>
            </p>
          </Card>

          {devUsers.length > 0 && (
            <Card className="mt-4 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Development only: sign in as</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {devUsers.map((u) => (
                  <form key={u.id} action={devLogin}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:bg-gold-50 hover:ring-gold-300">
                      <span className="block font-semibold text-navy-900">{u.name}</span>
                      <span className="text-xs text-slate-500">{ROLE_LABEL[u.role]}</span>
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
