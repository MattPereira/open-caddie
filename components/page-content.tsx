import { cn } from "@/lib/utils";

export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-8",
        className,
      )}
    >
      {children}
    </main>
  );
}
