"use client";

import {
  Cancel01Icon,
  PlusSignIcon,
  SquareArrowUp02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useInstallBanner } from "./use-install-banner";

const IOS_STEPS = [
  { icon: SquareArrowUp02Icon, text: "Tap Share in the browser toolbar" },
  { icon: PlusSignIcon, text: "Choose Add to Home Screen" },
  { icon: Tick02Icon, text: "Tap Add, top right" },
];

export function InstallAppBanner() {
  const { mode, install, dismiss } = useInstallBanner();

  if (mode === "hidden") return null;

  return (
    <Alert
      variant="default"
      icon={null}
      // Alert reserves right padding for its action on every row; only the
      // title row needs it, so the Install button can span the full width.
      className="has-data-[slot=alert-action]:pr-2.5"
    >
      <AlertTitle className="pr-8">Install mobile app</AlertTitle>
      <AlertDescription>
        For full screen experience with push notifications and offline mode
      </AlertDescription>
      <AlertAction className="top-1">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      </AlertAction>
      <div className="col-span-full mt-2">
        {mode === "prompt" ? (
          <Button size="lg" className="w-full" onClick={install}>
            Install
          </Button>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="lg" className="w-full">
                Install
              </Button>
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-3">
              <PopoverHeader>
                <PopoverTitle>Add to Home Screen</PopoverTitle>
              </PopoverHeader>
              <ol className="flex flex-col gap-3">
                {IOS_STEPS.map((step, index) => (
                  <li key={step.text} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <HugeiconsIcon icon={step.icon} className="size-5" />
                    </span>
                    <span className="text-sm">
                      <span className="mr-1 font-semibold">{index + 1}.</span>
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Already installed
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </Alert>
  );
}
