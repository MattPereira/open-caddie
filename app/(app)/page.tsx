import { auth } from "@/auth";
import { HomeActions } from "./_components/home-actions";
import { InputScoresFlowLoader } from "./_components/input-scores-flow-loader";
import { LoginPageForm } from "./_components/login-page-form";

type HomePageProps = {
  searchParams: Promise<{ action?: string; error?: string; email?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();
  const { action, error, email } = await searchParams;

  if (!session?.user?.id)
    return (
      <LoginPageForm
        hasAuthError={error !== undefined}
        rejectedEmail={email}
      />
    );

  const userId = session.user.id;
  const showScoringFlow = action === "new";

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center p-5">
      {showScoringFlow ? (
        <InputScoresFlowLoader userId={userId} />
      ) : (
        <section className="flex w-full max-w-3xl flex-col items-center gap-8">
          <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
            {session.user.firstName && `Swing away, ${session.user.firstName}`}
          </h1>
          <HomeActions userId={userId} />
        </section>
      )}
    </main>
  );
}
