import { SkinsContent } from "@/components/features/scores/skins-content";
import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-table";
import { TabsContent } from "@/components/ui/tabs";

export function SkinsTabContent({
  rounds,
}: {
  rounds: RoundScoresTableRound[];
}) {
  return (
    <TabsContent value="skins" className="flex flex-col gap-5 ">
      <SkinsContent rounds={rounds} />
    </TabsContent>
  );
}
