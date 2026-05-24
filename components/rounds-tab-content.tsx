import type { ReactNode } from "react";

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
  actions,
}: {
  currentUser: { id: string; isAdmin: boolean } | null;
  emptyMessage: string;
  rounds: RoundScoresTableRound[];
  actions?: ReactNode;
}) {
  return (
    <TabsContent value="rounds" className="flex flex-col gap-3">
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
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
