"use client";

import { useState } from "react";

import { InfoAlert } from "@/components/info-alert";
import { LoginForm, type LoginFormValues } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { signInWithEmail, signInWithGoogle } from "../actions";

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
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      {sentTo ? (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <InfoAlert title="Check your email">
            Magic link sent to <span className="font-medium">{sentTo}</span>.
            Click the link in the email to finish signing in.
          </InfoAlert>
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
          <LoginForm onSubmit={onSubmit} onGoogleSignIn={signInWithGoogle} />
        </div>
      )}
    </main>
  );
}
