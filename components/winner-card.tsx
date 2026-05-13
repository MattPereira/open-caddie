import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WinnerCard({
  playerName,
  initials,
  image,
  nameAlign = "center",
  details,
  children,
}: {
  playerName: string;
  initials: string;
  image: string | null;
  nameAlign?: "top" | "center";
  details?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className="gap-0 py-1.5!">
      <CardContent className="flex items-start gap-2 px-1.5!">
        <Avatar className="size-16 rounded-lg">
          {image ? <AvatarImage src={image} alt={playerName} /> : null}
          <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "flex h-full w-full justify-between gap-3",
            nameAlign === "top" ? "items-start" : "items-center",
          )}
        >
          <div className="min-w-0 flex-1 flex flex-col">
            <div className="truncate text-base">{playerName}</div>
            {details ? (
              <div className="truncate text-xs text-muted-foreground">
                {details}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col h-full justify-end">
            <div className="flex flex-row items-end gap-2">{children}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
