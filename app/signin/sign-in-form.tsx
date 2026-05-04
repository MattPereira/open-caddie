"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signInWithEmail } from "./actions";

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: SignInValues) => {
    startTransition(async () => {
      await signInWithEmail(values.email);
      setSentTo(values.email);
    });
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
              form.reset();
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in to Open Caddie</CardTitle>
            <CardDescription>
              We&apos;ll email you a magic link to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-6"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? "Sending…" : "Send magic link"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
