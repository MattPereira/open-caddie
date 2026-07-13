"use client";

import { useEffect, type ComponentProps } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

type UrlTabsProps = Omit<
  ComponentProps<typeof Tabs>,
  "defaultValue" | "onValueChange" | "value"
> & {
  defaultValue: string;
  paramName?: string;
  values: readonly string[];
};

export function UrlTabs({
  defaultValue,
  paramName = "tab",
  values,
  ...props
}: UrlTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedValue = getSelectedValue(
    searchParams.get(paramName),
    values,
    defaultValue,
  );

  useEffect(() => {
    if (searchParams.get(paramName) === selectedValue) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, selectedValue);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }, [paramName, pathname, searchParams, selectedValue]);

  function handleValueChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, nextValue);

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }

  return (
    <Tabs
      value={selectedValue}
      onValueChange={handleValueChange}
      {...props}
    />
  );
}

function getSelectedValue(
  value: string | null,
  values: readonly string[],
  defaultValue: string,
) {
  return value && values.includes(value) ? value : defaultValue;
}
