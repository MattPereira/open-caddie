import {
  GreenieCard,
  type GreenieCardGreenie,
} from "@/components/domain/greenie-card";
import { TabsContent } from "@/components/ui/tabs";

export function GreeniesTabContent({
  emptyMessage,
  greenies,
}: {
  emptyMessage: string;
  greenies: GreenieCardGreenie[];
}) {
  return (
    <TabsContent value="greenies">
      {greenies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {greenies.map((greenie, index) => (
            <GreenieCard
              key={`${greenie.hole}-${greenie.feet}-${greenie.inches}-${index}`}
              greenie={greenie}
            />
          ))}
        </div>
      )}
    </TabsContent>
  );
}
