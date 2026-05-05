"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { signIn } from "@/auth";
import { db } from "@/db";
import {
  clubs,
  courseHoles,
  courses,
  greenies,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/db/queries/users";
import {
  ClubCreateSchema,
  ClubUpdateSchema,
  CourseCreateSchema,
  CourseUpdateSchema,
  SeasonCreateSchema,
  SeasonUpdateSchema,
  TournamentCreateSchema,
  TournamentUpdateSchema,
  UserCreateSchema,
  UserUpdateSchema,
  type ClubCreateValues,
  type ClubUpdateValues,
  type CourseCreateValues,
  type CourseUpdateValues,
  type SeasonCreateValues,
  type SeasonUpdateValues,
  type TournamentCreateValues,
  type TournamentUpdateValues,
  type UserCreateValues,
  type UserUpdateValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("Forbidden");
  }
  return me;
}

function emptyToNull(s: string) {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function buildName(firstName: string | null, lastName: string | null) {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full.length > 0 ? full : null;
}

async function getClubIdByHandle(handle: string) {
  const [club] = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.handle, handle))
    .limit(1);
  return club?.id ?? null;
}

async function getCourseIdByHandle(handle: string | null) {
  if (!handle) return null;
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);
  return course?.id ?? null;
}

export async function createUser(
  values: UserCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = UserCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase();
  const firstName = emptyToNull(parsed.data.firstName);
  const lastName = emptyToNull(parsed.data.lastName);
  const username = emptyToNull(parsed.data.username);
  const image = parsed.data.image.length > 0 ? parsed.data.image : null;
  const { isAdmin } = parsed.data;

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailTaken) {
    return { ok: false, error: "That email is already in use." };
  }

  if (username) {
    const [usernameTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (usernameTaken) {
      return { ok: false, error: "That username is already in use." };
    }
  }

  try {
    await db.insert(users).values({
      email,
      firstName,
      lastName,
      username,
      image,
      isAdmin,
      name: buildName(firstName, lastName),
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "Email or username already in use." };
    }
    throw e;
  }

  await signIn("resend", { email, redirect: false, redirectTo: "/" });

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUser(
  values: UserUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = UserUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, isAdmin } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const firstName = emptyToNull(parsed.data.firstName);
  const lastName = emptyToNull(parsed.data.lastName);
  const username = emptyToNull(parsed.data.username);
  const image = parsed.data.image.length > 0 ? parsed.data.image : null;

  const [current] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "User not found." };
  }

  const emailChanged = current.email?.toLowerCase() !== email;

  if (emailChanged) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, id)))
      .limit(1);
    if (taken) {
      return { ok: false, error: "That email is already in use." };
    }
  }

  if (username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username), ne(users.id, id)))
      .limit(1);
    if (taken) {
      return { ok: false, error: "That username is already in use." };
    }
  }

  try {
    await db
      .update(users)
      .set({
        email,
        firstName,
        lastName,
        username,
        image,
        isAdmin,
        name: buildName(firstName, lastName),
        ...(emailChanged ? { emailVerified: null } : {}),
      })
      .where(eq(users.id, id));
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "Email or username already in use." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requireAdmin();

  if (me.id === id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.userId, id));

  const [{ value: greenieCount }] = await db
    .select({ value: count() })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .where(eq(rounds.userId, id));

  if (roundCount > 0 || greenieCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: user has ${roundCount} round(s) and ${greenieCount} greenie(s).`,
    };
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createTournament(
  values: TournamentCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TournamentCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { clubHandle } = parsed.data;
  const date = parseDateOnly(parsed.data.date);
  const courseHandle = emptyToNull(parsed.data.courseHandle);
  const clubId = await getClubIdByHandle(clubHandle);
  const courseId = await getCourseIdByHandle(courseHandle);

  if (!clubId || (courseHandle && !courseId)) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  try {
    await db.insert(tournaments).values({
      clubId,
      date,
      courseId,
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return {
        ok: false,
        error: "A tournament for this club already exists on that date.",
      };
    }
    if (code === "23503") {
      return { ok: false, error: "Selected club or course does not exist." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateTournament(
  values: TournamentUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TournamentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, clubHandle } = parsed.data;
  const date = parseDateOnly(parsed.data.date);
  const courseHandle = emptyToNull(parsed.data.courseHandle);
  const clubId = await getClubIdByHandle(clubHandle);
  const courseId = await getCourseIdByHandle(courseHandle);

  if (!clubId || (courseHandle && !courseId)) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  const [current] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Tournament not found." };
  }

  try {
    await db
      .update(tournaments)
      .set({ clubId, date, courseId })
      .where(eq(tournaments.id, id));
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return {
        ok: false,
        error: "A tournament for this club already exists on that date.",
      };
    }
    if (code === "23503") {
      return { ok: false, error: "Selected club or course does not exist." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function createSeason(
  values: SeasonCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = SeasonCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { clubHandle, number } = parsed.data;
  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);
  const clubId = await getClubIdByHandle(clubHandle);

  if (!clubId) {
    return { ok: false, error: "Selected club does not exist." };
  }

  try {
    await db.insert(seasons).values({
      clubId,
      number,
      startDate,
      endDate,
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return {
        ok: false,
        error: "A season with that number already exists for this club.",
      };
    }
    if (code === "23503") {
      return { ok: false, error: "Selected club does not exist." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateSeason(
  values: SeasonUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = SeasonUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, clubHandle, number } = parsed.data;
  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);
  const clubId = await getClubIdByHandle(clubHandle);

  if (!clubId) {
    return { ok: false, error: "Selected club does not exist." };
  }

  const [current] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Season not found." };
  }

  try {
    await db
      .update(seasons)
      .set({ clubId, number, startDate, endDate })
      .where(eq(seasons.id, id));
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return {
        ok: false,
        error: "A season with that number already exists for this club.",
      };
    }
    if (code === "23503") {
      return { ok: false, error: "Selected club does not exist." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteSeason(id: number): Promise<ActionResult> {
  await requireAdmin();

  await db.delete(seasons).where(eq(seasons.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

export async function createClub(
  values: ClubCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = ClubCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { handle, name, pointRules } = parsed.data;
  const logo = parsed.data.logo.length > 0 ? parsed.data.logo : null;

  try {
    await db.insert(clubs).values({ handle, name, logo, pointRules });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "A club with that handle already exists." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateClub(
  values: ClubUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = ClubUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { handle, name, pointRules } = parsed.data;
  const logo = parsed.data.logo.length > 0 ? parsed.data.logo : null;

  const [current] = await db
    .select({ handle: clubs.handle })
    .from(clubs)
    .where(eq(clubs.handle, handle))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Club not found." };
  }

  await db
    .update(clubs)
    .set({ name, logo, pointRules })
    .where(eq(clubs.handle, handle));

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteTournament(id: number): Promise<ActionResult> {
  await requireAdmin();

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.tournamentId, id));

  if (roundCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: tournament has ${roundCount} round(s).`,
    };
  }

  await db.delete(tournaments).where(eq(tournaments.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

export async function createCourse(
  values: CourseCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = CourseCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { handle, name, rating, slope, holes } = parsed.data;
  const imgUrl = parsed.data.imgUrl.length > 0 ? parsed.data.imgUrl : null;

  try {
    await db.transaction(async (tx) => {
      const [course] = await tx
        .insert(courses)
        .values({ handle, name, rating, slope, imgUrl })
        .returning({ id: courses.id });

      await tx.insert(courseHoles).values(
        holes.map((hole) => ({
          courseId: course.id,
          hole: hole.hole,
          par: hole.par,
          handicap: hole.handicap,
        })),
      );
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "A course with that handle already exists." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateCourse(
  values: CourseUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = CourseUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, handle, name, rating, slope, holes } = parsed.data;
  const imgUrl = parsed.data.imgUrl.length > 0 ? parsed.data.imgUrl : null;

  const [current] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Course not found." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(courses)
        .set({ handle, name, rating, slope, imgUrl })
        .where(eq(courses.id, id));

      await tx.delete(courseHoles).where(eq(courseHoles.courseId, id));
      await tx.insert(courseHoles).values(
        holes.map((hole) => ({
          courseId: id,
          hole: hole.hole,
          par: hole.par,
          handicap: hole.handicap,
        })),
      );
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "A course with that handle already exists." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteCourse(id: number): Promise<ActionResult> {
  await requireAdmin();

  const [{ value: tournamentCount }] = await db
    .select({ value: count() })
    .from(tournaments)
    .where(eq(tournaments.courseId, id));

  if (tournamentCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: course is assigned to ${tournamentCount} tournament(s).`,
    };
  }

  await db.delete(courses).where(eq(courses.id, id));
  revalidatePath("/admin");
  return { ok: true };
}
