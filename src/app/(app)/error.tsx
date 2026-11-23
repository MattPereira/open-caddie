"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { recordClientError } from "@/modules/problem-reports/client";

export default function AppError({
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This page hit an error. Try again, or report it from the menu.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Error {error.digest}
        </p>
      ) : null}
      <Button onClick={() => unstable_retry()}>Try again</Button>
    </main>
  );
}
