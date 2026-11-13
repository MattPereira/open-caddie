import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Alert02Icon,
  AlertCircleIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        info: "border-blue-200 bg-blue-50 text-blue-900 *:data-[slot=alert-description]:text-blue-900/80 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50 dark:*:data-[slot=alert-description]:text-blue-50/80",
        warning:
          "border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-900/80 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50 dark:*:data-[slot=alert-description]:text-amber-50/80",
        error:
          "border-red-200 bg-red-50 text-red-900 *:data-[slot=alert-description]:text-red-900/80 dark:border-red-900 dark:bg-red-950 dark:text-red-50 dark:*:data-[slot=alert-description]:text-red-50/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const variantIcons: Record<string, IconSvgElement> = {
  info: InformationCircleIcon,
  warning: Alert02Icon,
  error: AlertCircleIcon,
}

function Alert({
  className,
  variant,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    icon?: IconSvgElement | null
  }) {
  const resolvedIcon =
    icon === null ? null : (icon ?? (variant ? variantIcons[variant] : undefined))

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {resolvedIcon ? <HugeiconsIcon icon={resolvedIcon} /> : null}
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
