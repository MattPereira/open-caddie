"use client";

import { useEffect, useTransition } from "react";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type ClubSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  club?: AdminClub;
};

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

const emptyDefaults: ClubFormValues = {
  handle: "",
  name: "",
  logo: "",
  pointRules: defaultPointRules,
};

function toFormValues(c?: AdminClub): ClubFormValues {
  if (!c) return emptyDefaults;
  return {
    handle: c.handle,
    name: c.name,
    logo: c.logo ?? "",
    pointRules: c.pointRules,
  };
}

export function ClubSheet({
  open,
  onOpenChange,
  mode,
  club,
}: ClubSheetProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ClubFormValues>({
    resolver: zodResolver(ClubFormSchema),
    defaultValues: toFormValues(club),
  });
  const serverError = form.formState.errors.root?.server?.message;

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(club));
    }
  }, [open, club, form]);

  const onSubmit = (values: ClubFormValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClub(values)
          : await updateClub(values);

      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle>
            {mode === "create" ? "Add club" : "Edit club"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Create a new club and configure its scoring rules."
              : "Update this club's name, logo, and scoring rules."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex flex-col gap-4">
                {serverError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </p>
                ) : null}

                <FormField
                  control={form.control}
                  name="handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Handle</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly={mode === "edit"}
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
                        <Input
                          {...field}
                          type="url"
                          placeholder="https://…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <PointRulesFields control={form.control} />
              </div>
            </div>

            <SheetFooter className="shrink-0">
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving…"
                  : mode === "create"
                    ? "Create club"
                    : "Save changes"}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </SheetClose>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
