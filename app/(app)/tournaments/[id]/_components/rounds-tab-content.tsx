import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { getTournamentById } from "@/db/queries/tournaments";
import { RoundScoresTable } from "./round-scores-table";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;

export function RoundsTabContent({
  currentUser,
  rounds,
}: {
  currentUser: { id: string; isAdmin: boolean } | null;
  rounds: Tournament["rounds"];
}) {
  return (
    <TabsContent value="rounds" className="flex flex-col gap-3">
      {rounds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No rounds have been recorded for this tournament.
            </p>
          </CardContent>
        </Card>
      ) : (
        <RoundScoresTable currentUser={currentUser} rounds={rounds} />
      )}
    </TabsContent>
  );
}
