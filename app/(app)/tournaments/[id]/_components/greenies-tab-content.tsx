import { GreenieCard } from "@/components/greenie-card";
import { TabsContent } from "@/components/ui/tabs";
import type { getTournamentById } from "@/db/queries/tournaments";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;

export function GreeniesTabContent({
  greenies,
}: {
  greenies: Tournament["greenies"];
}) {
  return (
    <TabsContent value="greenies">
      {greenies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No greenies have been recorded for this tournament.
        </p>
      ) : (
        <div className="gap-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {greenies.map((greenie) => (
            <GreenieCard
              key={`${greenie.roundId}-${greenie.hole}`}
              greenie={greenie}
            />
          ))}
        </div>
      )}
    </TabsContent>
  );
}
