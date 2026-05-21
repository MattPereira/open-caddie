import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  RoundScoresTable,
  type RoundScoresTableRound,
} from "@/components/round-scores-table";

export function RoundsTabContent({
  currentUser,
  emptyMessage,
  rounds,
}: {
  currentUser: { id: string; isAdmin: boolean } | null;
  emptyMessage: string;
  rounds: RoundScoresTableRound[];
}) {
  return (
    <TabsContent value="rounds" className="flex flex-col gap-3">
      {rounds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <RoundScoresTable currentUser={currentUser} rounds={rounds} />
      )}
    </TabsContent>
  );
}
