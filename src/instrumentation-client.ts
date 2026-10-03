import * as Sentry from "@sentry/nextjs";

// Browser error alerts (e.g. a page crashing on a student's phone). The DSN is public by design
// and is baked in at build time, so it is off in local builds without NEXT_PUBLIC_SENTRY_DSN.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0,
    // Students are often minors: send the error and stack trace only, never user details,
    // cookies, headers, request bodies, query strings, database values or local variables.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, stackFrameVariables: false },
  });
}
