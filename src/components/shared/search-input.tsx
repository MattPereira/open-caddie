"use client";

import * as React from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "type"
> & {
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
};

export function SearchInput({
  className,
  onValueChange,
  wrapperClassName,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <HugeiconsIcon icon={Search01Icon} size={16} aria-hidden />
      </span>
      <Input
        {...props}
        type="search"
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("rounded-lg pl-9", className)}
      />
    </div>
  );
}
