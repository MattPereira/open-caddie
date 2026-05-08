import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function InfoAlert({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50">
      <HugeiconsIcon icon={InformationCircleIcon} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-blue-900/80 dark:text-blue-50/80">
        {children}
      </AlertDescription>
    </Alert>
  );
}
