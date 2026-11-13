"use client";

import { useState } from "react";

import { LoginForm, type LoginFormValues } from "./login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signInWithEmail, signInWithGoogle } from "../actions";

export function LoginPageForm({
  hasAuthError = false,
  rejectedEmail,
}: {
  hasAuthError?: boolean;
  rejectedEmail?: string;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (values: LoginFormValues) => {
    const result = await signInWithEmail(values.email);

    if (result.ok) {
      setSentTo(values.email);
    }

    return result;
  };

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6">
      {sentTo ? (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Alert variant="info">
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
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
        <div className="flex w-full max-w-sm flex-col gap-4">
          <LoginForm onSubmit={onSubmit} onGoogleSignIn={signInWithGoogle} />

          {hasAuthError ? (
            <Alert variant="error">
              <AlertTitle>
                {rejectedEmail
                  ? `No account found for ${rejectedEmail}`
                  : "No account found"}
              </AlertTitle>
              <AlertDescription>
                If you are a new user, contact an admin to request account
                creation
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}
    </main>
  );
}
