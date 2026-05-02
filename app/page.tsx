import { auth, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">open-caddie</h1>
      {session?.user ? (
        <>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-lg">
              {session.user.firstName} {session.user.lastName}
            </p>
            <p className="text-sm text-zinc-500">@{session.user.username}</p>
            <p className="text-sm text-zinc-500">{session.user.email}</p>
            {session.user.isAdmin ? (
              <span className="mt-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                admin
              </span>
            ) : null}
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
            >
              Sign out
            </button>
          </form>
        </>
      ) : (
        <p className="text-lg">Not signed in.</p>
      )}
    </main>
  );
}
