import {
  createOpenCaddieOgImage,
  openGraphImageContentType,
  openGraphImageSize,
} from "@/app/og-image";
import { getMatchById } from "@/db/queries/matches";
import { matchFormatLabel } from "@/lib/matches";
import { formatDate } from "@/lib/dates";

type MatchImageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export const alt = "Open Caddie match preview";
export const size = openGraphImageSize;
export const contentType = openGraphImageContentType;

export default async function Image({ params }: MatchImageProps) {
  const match = await getMatchFromParams(params);
  const format = matchFormatLabel(match?.format);

  return createOpenCaddieOgImage({
    title: format ?? "Match Play",
    subtitle: match?.courseName ?? "Match details on Open Caddie",
    kicker: match?.date ? formatDate(match.date, "short") : null,
    imageUrl: match?.courseImgUrl,
  });
}

async function getMatchFromParams(params: MatchImageProps["params"]) {
  const { id } = await params;
  const matchId = Number(id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return null;
  }

  return getMatchById(matchId);
}
