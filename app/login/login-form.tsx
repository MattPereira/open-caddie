"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { LoginForm, type LoginFormValues } from "@/components/login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signInWithEmail } from "./actions";

export function LoginPageForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (values: LoginFormValues) => {
    const result = await signInWithEmail(values.email);

    if (result.ok) {
      setSentTo(values.email);
    }

    return result;
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {sentTo ? (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50">
            <HugeiconsIcon icon={InformationCircleIcon} />
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription className="text-blue-900/80 dark:text-blue-50/80">
              Magic link sent to <span className="font-medium">{sentTo}</span>.
              Click the link in the email to finish signing in.
            </AlertDescription>
          </Alert>
          <Button
            variant="ghost"
            onClick={() => {
              setSentTo(null);
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <LoginForm onSubmit={onSubmit} />
        </div>
      )}
    </main>
  );
}
