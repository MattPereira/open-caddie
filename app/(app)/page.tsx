import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div>Good morning, {session?.user?.firstName}</div>
    </main>
  );
}
