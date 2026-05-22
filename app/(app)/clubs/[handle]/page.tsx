import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfBatIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";

import { ClubMembersBrowser } from "@/app/(app)/clubs/[handle]/_components/club-members-browser";
import { PointRulesSummary } from "@/app/(app)/clubs/[handle]/_components/point-rules-summary";
import { Badge } from "@/components/ui/badge";
import { getClubByHandle, getClubMembersByHandle } from "@/db/queries/clubs";
import { getCurrentUser } from "@/db/queries/users";
import { EditClubButton } from "../_components/edit-club-button";

type ClubPageProps = {
  params: Promise<{
    handle: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ClubPageProps): Promise<Metadata> {
  const club = await getClubFromParams(params);

  return {
    title: club?.name ?? "Club",
  };
}

export default async function ClubPage({ params }: ClubPageProps) {
  const club = await getClubFromParams(params);

  if (!club) notFound();

  const [currentUser, members] = await Promise.all([
    getCurrentUser(),
    getClubMembersByHandle(club.handle),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-normal">
            {club.name}
          </h1>
          {currentUser?.isAdmin ? <EditClubButton club={club} /> : null}
        </div>

        <div className="flex flex-col gap-6">
          <ClubLogo src={club.logo} alt={club.name} />
          <PointRulesSummary pointRules={club.pointRules} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-normal">
            <HugeiconsIcon icon={UserMultipleIcon} size={20} aria-hidden />
            Members
          </h2>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        <ClubMembersBrowser members={members} />
      </section>
    </main>
  );
}

async function getClubFromParams(params: ClubPageProps["params"]) {
  const { handle } = await params;

  return getClubByHandle(decodeURIComponent(handle));
}

function ClubLogo({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-lg border bg-background sm:h-64 lg:h-72">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain p-6"
          priority
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={GolfBatIcon} size={40} aria-hidden />
        </div>
      )}
    </div>
  );
}
