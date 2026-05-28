import {
  createOpenCaddieOgImage,
  openGraphImageContentType,
  openGraphImageSize,
} from "@/lib/og-image";
import { getTournamentById } from "@/db/queries/tournaments";
import { formatDate } from "@/lib/utils";

type TournamentImageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export const alt = "Open Caddie tournament preview";
export const size = openGraphImageSize;
export const contentType = openGraphImageContentType;

export default async function Image({ params }: TournamentImageProps) {
  const tournament = await getTournamentFromParams(params);

  return createOpenCaddieOgImage({
    title: tournament?.clubName ?? "Tournament",
    subtitle: tournament?.courseName ?? "Tournament details on Open Caddie",
    kicker: tournament?.date ? formatDate(tournament.date, "short") : null,
    imageUrl: tournament?.courseImgUrl,
  });
}

async function getTournamentFromParams(params: TournamentImageProps["params"]) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return null;
  }

  return getTournamentById(tournamentId);
}
