import {
  Add01Icon,
  Edit03Icon,
  Mic01Icon,
  ChampionIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function Home() {
  const session = await auth();
  const firstName = session?.user?.firstName;

  return (
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-10">
      <section className="flex w-full max-w-3xl flex-col items-center gap-8">
        <h1 className="text-center text-xl font-medium tracking-normal text-foreground sm:text-3xl">
          {firstName ? `Good morning, ${firstName}` : "Good morning"}
        </h1>

        <div className="flex w-full flex-col items-center gap-5">
          <div className="flex h-14 w-full items-center gap-2 rounded-full border border-input bg-muted/70 px-3 shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add"
              className="shrink-0 rounded-full"
            >
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            </Button>
            <Input
              type="text"
              placeholder="Ask anything"
              aria-label="Ask anything"
              className="h-full flex-1 border-0 bg-transparent px-1 text-base shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-lg"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-lg"
              aria-label="Voice input"
              className="shrink-0 rounded-full bg-background text-foreground shadow-sm hover:bg-background/90"
            >
              <HugeiconsIcon icon={Mic01Icon} data-icon="inline-start" />
            </Button>
          </div>

          <div className="flex w-full flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
              Input scores
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <HugeiconsIcon icon={ChampionIcon} data-icon="inline-start" />
              See scoreboard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <HugeiconsIcon icon={UserCircleIcon} data-icon="inline-start" />
              View profile
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
