import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaCardImage } from "@/components/media-card";
import { formatDate } from "@/lib/utils";
import { StatTile } from "./stat-tile";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export type RoundCardRound = {
  date: Date | string;
  courseName: string | null;
  courseImgUrl: string | null;
  tournamentId?: number | null;
  tournamentSeason?: number | null;
  clubName?: string | null;
  totalStrokes: number | null;
  totalPutts: number | null;
};

export function RoundCard({
  round,
  href,
}: {
  round: RoundCardRound;
  href?: string;
}) {
  const courseName = round.courseName ?? "Course to be announced";

  const card = (
    <Card className="flex-row items-start gap-3 p-2 h-full">
      <MediaCardImage src={round.courseImgUrl} alt={courseName} />
      <div className="flex min-w-0 flex-1 flex-col justify-between h-full">
        <CardHeader className="px-0! gap-0! flex flex-row justify-between">
          <CardTitle className="truncate text-xs sm:text-base flex flex-col">
            {courseName}
            <span className="flex items-center gap-1 text-xs leading-snug text-muted-foreground">
              <HugeiconsIcon icon={Calendar03Icon} size={12} aria-hidden />
              <span className="truncate">
                {formatDate(round.date, "short")}
              </span>
            </span>
          </CardTitle>
          <div className="text-sm border rounded-md px-1 py-0.5 min-w-10 text-center">
            {round.totalStrokes}
          </div>
        </CardHeader>

        <div className="flex justify-end gap-1">
          <Badge variant="outline" className="font-light">
            {round.clubName}
          </Badge>
          <Badge variant="outline" className="font-light">
            {round.tournamentId ? `Season ${round.tournamentSeason}` : ""}
          </Badge>
        </div>
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
