"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { createClub, updateClub } from "../actions";
import {
  ClubFormSchema,
  type ClubFormValues,
  type PointRules,
} from "../schema";
import { PointRulesFields } from "./point-rules-fields";

export type AdminClub = {
  handle: string;
  name: string;
  logo: string | null;
  pointRules: PointRules;
};

type ClubFormProps = { mode: "create" } | { mode: "edit"; club: AdminClub };

const defaultPointRules: PointRules = {
  participation: 0,
  pars: 0,
  birdies: 0,
  eagles: 0,
  aces: 0,
  strokes: { positions: [] },
  putts: { positions: [] },
  greenies: { tiers: [{ maxFt: null, pts: 0 }] },
};

function toFormValues(club?: AdminClub): ClubFormValues {
  if (!club) {
    return { handle: "", name: "", logo: "", pointRules: defaultPointRules };
  }
  return {
    handle: club.handle,
    name: club.name,
    logo: club.logo ?? "",
    pointRules: club.pointRules,
  };
}

export function ClubForm(props: ClubFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const club = props.mode === "edit" ? props.club : undefined;
  const cancelHref =
    props.mode === "edit" ? `/clubs/${props.club.handle}` : "/clubs";

  const form = useForm<ClubFormValues>({
    resolver: zodResolver(ClubFormSchema),
    defaultValues: toFormValues(club),
  });
  const serverError = form.formState.errors.root?.server?.message;

  const onSubmit = (values: ClubFormValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createClub(values)
          : await updateClub(values);

      if (!result.ok) {
        form.setError("root.server", { type: "server", message: result.error });
        return;
      }
      router.push(`/clubs/${values.handle}`);
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {serverError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FormField
            control={form.control}
            name="handle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Handle</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    readOnly={props.mode === "edit"}
                    placeholder="ccgc"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo URL</FormLabel>
                <FormControl>
                  <Input {...field} type="url" placeholder="https://…" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <PointRulesFields control={form.control} />

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving…"
              : props.mode === "create"
                ? "Create club"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => router.push(cancelHref)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
