import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

export function HeroActionButton({
  className,
  variant = "outline",
  size = "icon",
  ...props
}: ButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white dark:border-white/40 dark:bg-white/10 dark:hover:bg-white/20",
        className,
      )}
      {...props}
    />
  );
}
