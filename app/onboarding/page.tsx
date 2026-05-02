import { auth, unstable_update } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "./slugify";

const MAX_USERNAME_LEN = 20;
const MAX_COLLISION_ATTEMPTS = 10;

const OnboardingSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
});

function buildUsername(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  const maxBase = MAX_USERNAME_LEN - suffix.length;
  return base.slice(0, maxBase).replace(/-+$/, "") + suffix;
}

async function submitOnboarding(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const parsed = OnboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });

  if (!parsed.success) {
    const params = new URLSearchParams({
      error: parsed.error.issues[0].message,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
    });
    redirect(`/onboarding?${params.toString()}`);
  }

  const { firstName, lastName } = parsed.data;
  const fullName = `${firstName} ${lastName}`;
  const baseSlug = slugify(firstName, lastName);

  let savedUsername: string | null = null;
  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
    const candidate = buildUsername(baseSlug, attempt);
    try {
      await db
        .update(users)
        .set({ username: candidate, firstName, lastName, name: fullName })
        .where(eq(users.id, session.user.id));
      savedUsername = candidate;
      break;
    } catch (e: unknown) {
      const code =
        (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
        (e as { code?: string })?.code;
      if (code !== "23505") throw e;
    }
  }

  if (!savedUsername) {
    redirect(
      `/onboarding?${new URLSearchParams({
        error: "Couldn't generate a unique handle from your name. Try a slight variation.",
        firstName,
        lastName,
      }).toString()}`,
    );
  }

  await unstable_update({
    user: { username: savedUsername, firstName, lastName, name: fullName },
  });

  redirect("/");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    firstName?: string;
    lastName?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const { error, firstName, lastName } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        action={submitOnboarding}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold">Complete your profile</h1>
        <p className="text-sm text-zinc-500">
          Signed in as <strong>{session.user.email}</strong>
        </p>
        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          First name
          <input
            type="text"
            name="firstName"
            defaultValue={firstName ?? ""}
            required
            maxLength={50}
            className="rounded border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Last name
          <input
            type="text"
            name="lastName"
            defaultValue={lastName ?? ""}
            required
            maxLength={50}
            className="rounded border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
