"use client";

import { Suspense, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CourseRecordsDialog({
  courseName,
  trigger,
  children,
}: {
  courseName?: string | null;
  trigger: ReactNode;
  // The records themselves, rendered on the server so the dialog needs no
  // fetch of its own when opened.
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="h-[min(40rem,calc(100svh-3rem))] max-w-[calc(100%-1.5rem)] grid-rows-[auto_minmax(0,1fr)] p-5 *:data-[slot=dialog-close]:top-5 *:data-[slot=dialog-close]:right-4 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="text-lg leading-7">
            {courseName ? `${courseName} records` : "Course records"}
          </DialogTitle>
        </DialogHeader>
        <div className="-mx-5 overflow-y-auto px-5">
          <Suspense
            fallback={
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading records…
              </p>
            }
          >
            {children}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}
