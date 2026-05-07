"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
};

export function LoginForm({ className, onSubmit, ...props }: LoginFormProps) {
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
            <div className="flex size-8 items-center justify-center rounded-md">
              <HugeiconsIcon icon={GolfHoleIcon} strokeWidth={2} size={38} />
            </div>
            <h1 className="text-xl font-bold">Welcome to Open Caddie</h1>
            <FieldDescription>
              Don&apos;t have an account?{" "}
              <span aria-disabled="true" className="text-muted-foreground">
                Sign up
              </span>
            </FieldDescription>
          </div>
          <Field data-invalid={!!emailError}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              autoComplete="email"
              aria-invalid={!!emailError}
              type="email"
              placeholder="you@example.com"
              {...form.register("email")}
            />
            <FieldError errors={[emailError]} />
          </Field>
          <Field>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending magic link..." : "Login"}
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field>
            <Button variant="outline" type="button" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
