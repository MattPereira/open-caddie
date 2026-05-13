"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

type LoginFormResult = { ok: true } | { ok: false; error: string };

type LoginFormProps = Omit<React.ComponentProps<"div">, "onSubmit"> & {
  onSubmit?: (
    values: LoginFormValues,
  ) => LoginFormResult | Promise<LoginFormResult>;
  onGoogleSignIn?: () => Promise<void>;
};

export function LoginForm({
  className,
  onSubmit,
  onGoogleSignIn,
  ...props
}: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const emailError = form.formState.errors.email;

  function handleSubmit(values: LoginFormValues) {
    startTransition(async () => {
      const result: LoginFormResult = onSubmit
        ? await onSubmit(values)
        : { ok: true };

      if (!result.ok) {
        form.setError("email", { message: result.error });
      }
    });
  }
  // shadcn example: https://ui.shadcn.com/blocks/login
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-semibold">Welcome to Open Caddie</h1>
            <FieldDescription>
              Forgot your email? Search the list of{" "}
              <Link href="/players" className="text-muted-foreground">
                players
              </Link>
            </FieldDescription>
          </div>
          <Field data-invalid={!!emailError}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              size="xl"
              autoComplete="email"
              aria-invalid={!!emailError}
              type="email"
              placeholder="you@example.com"
              {...form.register("email")}
            />
            <FieldError errors={[emailError]} />
          </Field>
          <Field>
            <Button
              variant="secondary"
              size="xl"
              type="submit"
              disabled={isPending}
            >
              <HugeiconsIcon icon={AiMagicIcon} data-icon="inline-start" />
              {isPending ? "Sending magic link..." : "Send a magic link"}
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
        </FieldGroup>
      </form>
      {onGoogleSignIn ? (
        <form action={onGoogleSignIn}>
          <Field>
            <Button
              size="xl"
              variant="secondary"
              type="submit"
              disabled={isPending}
            >
              <Image
                src="/google.svg"
                alt="Google Logo"
                width={22}
                height={22}
              />
              Sign in with Google
            </Button>
          </Field>
        </form>
      ) : null}
    </div>
  );
}
