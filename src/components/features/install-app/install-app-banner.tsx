"use client";

import { SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useInstallBanner } from "./use-install-banner";

export function InstallAppBanner() {
  const { mode, install, markInstalledOnIos } = useInstallBanner();

  if (mode === "hidden") return null;

  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <HugeiconsIcon icon={SmartPhone01Icon} className="size-5" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Install Open Caddie</ItemTitle>
        <ItemDescription>
          Add it to your home screen for one-tap scoring on the course.
        </ItemDescription>
      </ItemContent>
      <ItemActions className="w-full justify-end">
        {mode === "prompt" ? (
          <Button size="sm" onClick={install}>
            Install
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={markInstalledOnIos}>
              Already installed
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm">Install</Button>
              </PopoverTrigger>
              <PopoverContent align="end">
                <PopoverHeader>
                  <PopoverTitle>Add to Home Screen</PopoverTitle>
                  <PopoverDescription>
                    1. Tap the Share button in the browser toolbar.
                    <br />
                    2. Scroll down and tap Add to Home Screen.
                    <br />
                    3. Tap Add.
                  </PopoverDescription>
                </PopoverHeader>
              </PopoverContent>
            </Popover>
          </>
        )}
      </ItemActions>
    </Item>
  );
}
