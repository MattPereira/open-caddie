import type { ReactNode } from "react";

import { GreenieCard } from "@/components/domain/greenie-card";
import { WinnerCard } from "@/components/domain/winner-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/dates";
import {
  getClosestGreeniesByCourseId,
  getFewestPuttsRoundsByCourseId,
  getLowestRoundsByCourseId,
} from "@/lib/courses/queries";
import { displayName, getInitials } from "@/lib/players/player-name";

type CourseRecordsProps = {
  courseId: number;
  // "sections" stacks every record list for the course page; "tabs" shows one
  // list at a time, and a longer one, for the course records dialog.
  variant?: "sections" | "tabs";
};

// Sized by its container rather than the viewport, so the same lists fit both
// the course page and the narrow course records dialog.
export async function CourseRecords({
  courseId,
  variant = "sections",
}: CourseRecordsProps) {
  const limit = variant === "tabs" ? 5 : 3;
  const [lowestRounds, fewestPuttsRounds, closestGreenies] = await Promise.all([
    getLowestRoundsByCourseId(courseId, limit),
    getFewestPuttsRoundsByCourseId(courseId, limit),
    getClosestGreeniesByCourseId(courseId),
  ]);

  const rounds =
    lowestRounds.length > 0 ? (
      <RecordsGrid>
        {lowestRounds.map((round) => (
          <WinnerCard
            key={round.roundId}
            playerName={displayName(round)}
            initials={getInitials(round)}
            image={round.image}
            secondary={formatDate(round.date, "short")}
            primaryLabel="Strokes"
            primaryValue={round.totalStrokes}
          />
        ))}
      </RecordsGrid>
    ) : (
      <EmptyRecords>No complete rounds on this course yet.</EmptyRecords>
    );

  const putts =
    fewestPuttsRounds.length > 0 ? (
      <RecordsGrid>
        {fewestPuttsRounds.map((round) => (
          <WinnerCard
            key={round.roundId}
            playerName={displayName(round)}
            initials={getInitials(round)}
            image={round.image}
            secondary={formatDate(round.date, "short")}
            primaryLabel="Putts"
            primaryValue={round.totalPutts}
          />
        ))}
      </RecordsGrid>
    ) : (
      <EmptyRecords>
        No rounds with full putt data on this course yet.
      </EmptyRecords>
    );

  const greenies =
    closestGreenies.length > 0 ? (
      <RecordsGrid>
        {closestGreenies.map((greenie) => (
          <GreenieCard
            key={`greenie-${greenie.hole}`}
            greenie={greenie}
            details={formatDate(greenie.roundDate, "short")}
          />
        ))}
      </RecordsGrid>
    ) : (
      <EmptyRecords>No greenies recorded on this course yet.</EmptyRecords>
    );

  if (variant === "tabs") {
    return (
      <Tabs defaultValue="rounds" className="@container gap-3">
        {/* Pinned so the tabs stay reachable while a long list scrolls. */}
        <TabsList className="sticky top-0 z-10 h-10! w-full p-1">
          <TabsTrigger value="rounds" className="flex-1 text-base">
            Rounds
          </TabsTrigger>
          <TabsTrigger value="putts" className="flex-1 text-base">
            Putts
          </TabsTrigger>
          <TabsTrigger value="greenies" className="flex-1 text-base">
            Greenies
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rounds">{rounds}</TabsContent>
        <TabsContent value="putts">{putts}</TabsContent>
        <TabsContent value="greenies">{greenies}</TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Best Rounds</h3>
        {rounds}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Fewest Putts</h3>
        {putts}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Closest Greenies</h3>
        {greenies}
      </div>
    </div>
  );
}

function RecordsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">{children}</div>
  );
}

function EmptyRecords({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
