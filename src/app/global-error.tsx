"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort page when the whole app fails to render. Reports the crash and offers a retry.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0A2D4A" }}>
        <title>Something went wrong · Silora Academy</title>
        <main style={{ maxWidth: 420, margin: "20vh auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p>Please try again. If it keeps happening, message Silora Academy.</p>
          <button
            onClick={() => retry()}
            style={{ background: "#E8B112", color: "#0A2D4A", border: 0, borderRadius: 10, padding: "14px 28px", fontSize: 17, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
