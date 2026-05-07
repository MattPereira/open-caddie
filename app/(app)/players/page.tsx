import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Players",
};

export default function PlayersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-normal">Players</h1>
    </main>
  );
}
