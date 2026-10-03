import * as Sentry from "@sentry/nextjs";

// Server error alerts. Sentry stays off unless SENTRY_DSN is set (production / test site).
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "production",
      tracesSampleRate: 0, // errors only; keeps us inside the free plan
      // Students are often minors: send the error and stack trace only, never user details,
      // cookies, headers, request bodies, query strings, database values or local variables.
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, stackFrameVariables: false },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
