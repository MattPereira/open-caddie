"use client";

import { useEffect } from "react";

import { recordClientError } from "@/modules/problem-reports/client";
import "./globals.css";

// Replaces the root layout, so it brings its own html, body and styles, and
// there is no menu to report from: the digest on screen is what to pass on.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    recordClientError("boundary", error, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <title>Something went wrong</title>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Open Caddie hit an error. Try again.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Error {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
