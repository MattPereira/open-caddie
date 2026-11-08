import { SkinsContent } from "@/components/features/scores/skins-content";
import type { SkinsHole, SkinsRound } from "@/components/features/scores/skins";
import { TabsContent } from "@/components/ui/tabs";

export function SkinsTabContent({
  rounds,
  holes,
}: {
  rounds: SkinsRound[];
  holes: SkinsHole[];
}) {
  return (
    <TabsContent value="skins" className="flex flex-col gap-5 ">
      <SkinsContent rounds={rounds} holes={holes} />
    </TabsContent>
  );
}
