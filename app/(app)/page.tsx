import { Edit03Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { LoginPageForm } from "./_components/login-page-form";

export default async function Home() {
  const session = await auth();
  const firstName = session?.user?.firstName;

  if (!session?.user) {
    return <LoginPageForm />;
  }

  return (
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-10">
      <section className="flex w-full max-w-3xl flex-col items-center gap-8">
        <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
          {firstName ? `Good morning, ${firstName}` : "Good morning"}
        </h1>

        <div className="flex w-full flex-col items-center gap-5">
          <div className="flex w-full justify-center gap-3">
            <Button type="button" variant="outline" size="lg">
              <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
              Input scores
            </Button>
            <Button type="button" variant="outline" size="lg">
              <HugeiconsIcon icon={UserCircleIcon} data-icon="inline-start" />
              View profile
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
