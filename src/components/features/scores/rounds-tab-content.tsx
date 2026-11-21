import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  RoundScoresTable,
  type EditableTableRound,
  type RoundsEditAccess,
} from "@/components/features/scores/round-scores-table";
import type { EditableCourse } from "@/components/features/scores/round-scores-sheet";

export function RoundsTabContent({
  editAccess,
  emptyMessage,
  rounds,
  course,
  actions,
  children,
  viewerRoundId,
}: {
  editAccess: RoundsEditAccess | null;
  emptyMessage: string;
  rounds: EditableTableRound[];
  course: EditableCourse;
  actions?: ReactNode;
  children?: ReactNode;
  viewerRoundId?: number;
}) {
  return (
    <TabsContent value="rounds" className="flex flex-col gap-5">
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      {rounds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <RoundScoresTable
          editAccess={editAccess}
          rounds={rounds}
          course={course}
          viewerRoundId={viewerRoundId}
        />
      )}
      {children}
    </TabsContent>
  );
}
