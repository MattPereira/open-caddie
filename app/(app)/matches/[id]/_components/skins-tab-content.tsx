import { SkinsContent } from "@/components/features/scores/skins-content";
import type { HandicapHole, NetScoringRound } from "@/lib/rounds/reads";
import { TabsContent } from "@/components/ui/tabs";

export function SkinsTabContent({
  rounds,
  holes,
}: {
  rounds: NetScoringRound[];
  holes: HandicapHole[];
}) {
  return (
    <TabsContent value="skins" className="flex flex-col gap-5 ">
      <SkinsContent rounds={rounds} holes={holes} />
    </TabsContent>
  );
}
