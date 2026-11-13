import type { Metadata } from "next";

import { appPageIcons } from "@/components/layout/app-nav-items";
import { PageContent } from "@/components/layout/page-content";
import { PageHeading } from "@/components/layout/page-heading";
import { ClubForm } from "../_components/club-form";

export const metadata: Metadata = { title: "Add Club" };

export default function NewClubPage() {
  return (
    <PageContent>
      <PageHeading icon={appPageIcons.clubs}>Add club</PageHeading>
      <ClubForm mode="create" />
    </PageContent>
  );
}
