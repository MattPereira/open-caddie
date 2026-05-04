import { redirect } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/db/queries/users";
import { ProfileForm } from "./profile-form";

function getInitials(first?: string | null, last?: string | null) {
  const f = first?.trim()?.[0];
  const l = last?.trim()?.[0];
  const initials = `${f ?? ""}${l ?? ""}`.toUpperCase();
  return initials || "?";
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <main className="flex flex-1 flex-col items-center p-4 sm:p-8">
      <Card className="w-full max-w-xl">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <CardTitle>Edit Profile</CardTitle>
          <Avatar className="size-20">
            {user.image ? (
              <AvatarImage src={user.image} alt="Profile image" />
            ) : null}
            <AvatarFallback className="text-lg">
              {getInitials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              firstName: user.firstName ?? "",
              lastName: user.lastName ?? "",
              email: user.email ?? "",
              image: user.image ?? "",
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
