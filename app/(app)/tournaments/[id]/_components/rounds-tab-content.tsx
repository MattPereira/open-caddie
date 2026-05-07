import { TabsContent } from "@/components/ui/tabs";
import type { getTournamentById } from "@/db/queries/tournaments";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;

export function RoundsTabContent({
  rounds,
}: {
  rounds: Tournament["rounds"];
}) {
  return (
    <TabsContent value="rounds">
      <p className="text-sm text-muted-foreground">
        {rounds.length} round{rounds.length === 1 ? "" : "s"} recorded.
      </p>
    </TabsContent>
  );
}
