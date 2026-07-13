import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { appPageIcons } from "@/components/layout/app-nav-items";
import { PageContent } from "@/components/layout/page-content";
import { PageHeading } from "@/components/layout/page-heading";
import { getClubByHandle } from "@/db/queries/clubs";
import { ClubForm } from "../../_components/club-form";

type EditClubPageProps = {
  params: Promise<{ handle: string }>;
};

export const metadata: Metadata = { title: "Edit Club" };

export default async function EditClubPage({ params }: EditClubPageProps) {
  const { handle } = await params;
  const club = await getClubByHandle(decodeURIComponent(handle));

  if (!club) notFound();

  return (
    <PageContent>
      <PageHeading icon={appPageIcons.clubs}>Edit club</PageHeading>
      <ClubForm mode="edit" club={club} />
    </PageContent>
  );
}
