"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ImageUploadField } from "@/components/image-upload-field";
import { getInitials } from "@/components/player-card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SheetDeleteConfirm,
  SheetDiscardConfirm,
  SheetFooterActions,
} from "@/components/sheet-actions";
import { Switch } from "@/components/ui/switch";
import { createUser, deleteUser, updateUser } from "../actions";
import { UserFormSchema, type UserFormValues } from "../schema";

export type AdminUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  isAdmin: boolean;
};

type UserSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: AdminUser;
  canManageUsers?: boolean;
  onSaved?: () => void;
  onDeleted?: () => void;
};

const emptyDefaults: UserFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  username: "",
  image: "",
  isAdmin: false,
};

function toFormValues(user?: AdminUser): UserFormValues {
  if (!user) return emptyDefaults;
  return {
    email: user.email ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    username: user.username ?? "",
    image: user.image ?? "",
    isAdmin: user.isAdmin,
  };
}

export function UserSheet({
  open,
  onOpenChange,
  mode,
  user,
  canManageUsers = true,
  onSaved,
  onDeleted,
}: UserSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(UserFormSchema),
    defaultValues: toFormValues(user),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const isDirty = form.formState.isDirty;
  const showAdminControls = mode === "create" || canManageUsers;
  const showDelete = mode === "edit" && canManageUsers && user;

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(user));
    }
  }, [open, user, form]);

  const closeSheet = () => {
    form.clearErrors("root.server");
    setDeleteError(null);
    setConfirmingDelete(false);
    setConfirmingDiscard(false);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setConfirmingDiscard(false);
      onOpenChange(true);
      return;
    }

    if (isDirty) {
      setConfirmingDiscard(true);
      setConfirmingDelete(false);
      return;
    }

    closeSheet();
  };

  const onDelete = () => {
    if (!user) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteUser(user.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setConfirmingDelete(false);
      closeSheet();
      onDeleted?.();
    });
  };

  const onSubmit = (values: UserFormValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createUser(values)
          : await updateUser({ ...values, id: user!.id });

      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      closeSheet();
      onSaved?.();
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "Add player" : "Edit player"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Create a new player. A magic-link sign-in email will be sent to them."
              : "Update this player's account details."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col"
          >
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex flex-col gap-4">
                {serverError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </p>
                ) : null}

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          maxLength={254}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input type="text" maxLength={50} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input type="text" maxLength={50} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input type="text" maxLength={50} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {mode === "edit" && user ? (
                  <FormField
                    control={form.control}
                    name="image"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile image</FormLabel>
                        <FormControl>
                          <ImageUploadField
                            value={field.value || null}
                            onChange={(url) => field.onChange(url ?? "")}
                            pathPrefix={`users/${user.id}`}
                            fallback={getInitials(user)}
                            onUploadingChange={setIsUploading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    You can upload a profile picture after the account is
                    created.
                  </p>
                )}

                {showAdminControls ? (
                  <FormField
                    control={form.control}
                    name="isAdmin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Admin</FormLabel>
                          <FormDescription>
                            Access to admin console
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            </div>

            <SheetFooter>
              {confirmingDiscard ? (
                <SheetDiscardConfirm
                  isPending={isPending}
                  onKeepEditingAction={() => setConfirmingDiscard(false)}
                  onDiscardAction={() => {
                    form.reset(toFormValues(user));
                    closeSheet();
                  }}
                />
              ) : confirmingDelete && showDelete ? (
                <SheetDeleteConfirm
                  title="Delete this user?"
                  description="This permanently deletes the user account."
                  confirmLabel="Hold to delete user"
                  isDeleting={isDeleting}
                  error={deleteError}
                  onConfirmAction={onDelete}
                  onCancelAction={() => {
                    setConfirmingDelete(false);
                    setDeleteError(null);
                  }}
                />
              ) : (
                <SheetFooterActions
                  isPending={isPending}
                  saveDisabled={isUploading}
                  saveLabel={mode === "create" ? "Create" : "Save"}
                  savingLabel="Saving…"
                  onDeleteAction={
                    showDelete
                      ? () => {
                          setDeleteError(null);
                          setConfirmingDelete(true);
                        }
                      : undefined
                  }
                  deleteAriaLabel="Delete user"
                />
              )}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
