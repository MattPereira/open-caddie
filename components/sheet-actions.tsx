"use client";

import { type ReactNode } from "react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { HoldToConfirmButton } from "@/components/hold-to-confirm-button";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";

type SheetFooterActionsProps = {
  isPending?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  saveDisabled?: boolean;
  onDeleteAction?: () => void;
  deleteAriaLabel?: string;
};

export function SheetFooterActions({
  isPending,
  saveLabel = "Save",
  savingLabel = "Saving...",
  saveDisabled,
  onDeleteAction,
  deleteAriaLabel = "Delete",
}: SheetFooterActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {onDeleteAction ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={isPending}
          onClick={onDeleteAction}
          aria-label={deleteAriaLabel}
        >
          <HugeiconsIcon icon={Delete02Icon} aria-hidden />
        </Button>
      ) : null}
      <SheetClose asChild>
        <Button
          type="button"
          variant="outline"
          size="xl"
          disabled={isPending}
          className="ml-auto"
        >
          Cancel
        </Button>
      </SheetClose>
      <Button
        type="submit"
        size="xl"
        className="w-22"
        disabled={isPending || saveDisabled}
      >
        {isPending ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}

type SheetDeleteConfirmProps = {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  onConfirmAction: () => void;
  onCancelAction: () => void;
  isDeleting?: boolean;
  error?: string | null;
};

export function SheetDeleteConfirm({
  title,
  description,
  confirmLabel,
  onConfirmAction,
  onCancelAction,
  isDeleting,
  error,
}: SheetDeleteConfirmProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium">
        {title}
        {description ? (
          <div className="text-sm font-normal text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="xl"
          disabled={isDeleting}
          onClick={onCancelAction}
        >
          Cancel
        </Button>
        <HoldToConfirmButton
          onConfirmAction={onConfirmAction}
          disabled={isDeleting}
          idleLabel={isDeleting ? "Deleting…" : confirmLabel}
        />
      </div>
    </div>
  );
}

type SheetDiscardConfirmProps = {
  onKeepEditingAction: () => void;
  onDiscardAction: () => void;
  isPending?: boolean;
  title?: ReactNode;
  description?: ReactNode;
};

export function SheetDiscardConfirm({
  onKeepEditingAction,
  onDiscardAction,
  isPending,
  title = "You have unsaved changes!",
  description = "Choose how to proceed:",
}: SheetDiscardConfirmProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium">
        {title}
        {description ? (
          <div className="text-sm font-normal text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xl"
            className="flex-1"
            onClick={onKeepEditingAction}
          >
            Keep editing
          </Button>
          <Button
            type="submit"
            size="xl"
            className="flex-1"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDiscardAction}
        >
          Discard changes
        </Button>
      </div>
    </div>
  );
}
