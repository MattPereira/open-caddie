import { TabsContent } from "@/components/ui/tabs";

export function WinnersTabContent() {
  return (
    <TabsContent value="winners">
      <p className="text-sm text-muted-foreground">
        Winners have not been calculated yet.
      </p>
    </TabsContent>
  );
}
