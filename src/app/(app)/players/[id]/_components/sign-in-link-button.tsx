"use client";

import { useState, useTransition } from "react";
import { Link01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlayerSignInLink } from "../../actions";

/**
 * Safari drops clipboard permission once we await a server round-trip, so hand
 * the clipboard a pending promise while the click gesture is still live and
 * only fall back to `writeText` when that is unsupported.
 */
async function copyWhilePending(pending: Promise<string>) {
  if (typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": pending.then(
            (text) => new Blob([text], { type: "text/plain" }),
          ),
        }),
      ]);
      return true;
    } catch {
      // Fall through to the simpler API.
    }
  }

  try {
    await navigator.clipboard.writeText(await pending);
    return true;
  } catch {
    return false;
  }
}

export function SignInLinkButton({ playerId }: { playerId: string }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const handleClick = () => {
    setCopied(false);
    setError(null);
    setManualUrl(null);

    const request = createPlayerSignInLink(playerId);
    const url = request.then((result) =>
      result.ok ? result.url : Promise.reject(new Error(result.error)),
    );
    url.catch(() => {});

    startTransition(async () => {
      const didCopy = await copyWhilePending(url);
      const result = await request;

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (didCopy) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      setManualUrl(result.url);
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        size="xl"
        className="w-full sm:w-auto"
        onClick={handleClick}
        disabled={isPending}
        title="Copy a sign-in link to text this player"
      >
        <HugeiconsIcon
          icon={copied ? Tick02Icon : Link01Icon}
          data-icon="inline-start"
        />
        {copied ? "Copied" : "Copy Link"}
      </Button>
      {error ? (
        <p className="absolute top-full left-0 mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {manualUrl ? (
        <Input
          readOnly
          value={manualUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="absolute top-full left-0 mt-1 w-64 text-xs"
        />
      ) : null}
    </>
  );
}
