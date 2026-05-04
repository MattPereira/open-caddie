"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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

export default function SignInPage() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: SignInValues) => {
    startTransition(async () => {
      await signInWithEmail(values.email);
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-sm flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Sign in to Open Caddie</h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ll email you a magic link to sign in.
            </p>
          </div>

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
    </main>
  );
}
