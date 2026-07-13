import { displayName } from "@/lib/players/player-name";
import { ResponsiveTable, TableFrame } from "@/components/shared/responsive-table";
import {
  StandingsDesktopRowGroup,
  type DesktopStanding,
} from "@/components/features/standings/standings-desktop-row";
import {
  StandingsMobileRow,
  type MobileStanding,
} from "@/components/features/standings/standings-mobile-row";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SeasonStandings } from "@/lib/clubs/standings/queries";
import { cn } from "@/lib/utils";

type Standing = SeasonStandings["players"][number];
export type PointKey =
  | "participation"
  | "strokes"
  | "putts"
  | "greenies"
  | "pars"
  | "birdies"
  | "eagles"
  | "aces";

export type PointSummaryColumn = {
  key: PointKey;
  label: string;
  desktopClassName?: string;
};

const pointColumns: PointSummaryColumn[] = [
  { key: "participation", label: "PLY", desktopClassName: "w-14" },
  { key: "strokes", label: "STR", desktopClassName: "w-14" },
  { key: "putts", label: "PUT", desktopClassName: "w-14" },
  { key: "greenies", label: "GRN", desktopClassName: "w-14" },
  { key: "pars", label: "PAR", desktopClassName: "w-14" },
  { key: "birdies", label: "BRD", desktopClassName: "w-14" },
  { key: "eagles", label: "EGL", desktopClassName: "w-14" },
  { key: "aces", label: "ACE", desktopClassName: "w-14" },
];

export function StandingsTable({
  standings,
}: {
  standings: SeasonStandings;
}) {
  if (standings.players.length === 0) {
    return (
      <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
        No players have points for this season yet.
      </p>
    );
  }

  return (
    <ResponsiveTable
      desktop={<DesktopStandingsTable players={standings.players} />}
      mobile={<MobileStandingsList players={standings.players} />}
    />
  );
}

function DesktopStandingsTable({ players }: { players: Standing[] }) {
  return (
    <TableFrame>
      <Table className="w-max">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">POS</TableHead>
            <TableHead className="sticky left-0 z-10 min-w-40 bg-card">
              NAME
            </TableHead>
            {pointColumns.map((column) => (
              <TableHead
                key={column.key}
                className={cn("text-center", column.desktopClassName)}
              >
                {column.label}
              </TableHead>
            ))}
            <TableHead className="w-16 text-center">TOT</TableHead>
          </TableRow>
        </TableHeader>
        {players.map((standing) => (
          <StandingsDesktopRowGroup
            key={standing.userId}
            standing={toDesktopStanding(standing)}
            pointColumns={pointColumns}
          />
        ))}
      </Table>
    </TableFrame>
  );
}

function MobileStandingsList({ players }: { players: Standing[] }) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl ring-1 ring-border">
      {players.map((standing) => (
        <StandingsMobileRow
          key={standing.userId}
          standing={toMobileStanding(standing)}
          pointColumns={pointColumns}
        />
      ))}
    </div>
  );
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function toDesktopStanding(standing: Standing): DesktopStanding {
  return {
    userId: standing.userId,
    playerName: displayName(standing.user),
    position: standing.position,
    points: standing.points,
    countedRounds: standing.roundBreakdown
      .filter((round) => round.counted)
      .map((round) => ({
        roundId: round.roundId,
        dateLabel: formatShortDate(round.date),
        courseName: round.courseName,
        points: round.points,
      })),
  };
}

function toMobileStanding(standing: Standing): MobileStanding {
  return {
    userId: standing.userId,
    user: standing.user,
    roundsPlayed: standing.roundsPlayed,
    droppedRounds: standing.droppedRounds,
    points: standing.points,
    countedRounds: standing.roundBreakdown
      .filter((round) => round.counted)
      .map((round) => ({
        roundId: round.roundId,
        dateLabel: formatShortDate(round.date),
        courseName: round.courseName,
        points: round.points,
      })),
  };
}
