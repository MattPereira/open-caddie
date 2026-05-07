import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  username: text("username").unique(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  isAdmin: boolean("isAdmin").notNull().default(false),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  logo: text("logo"),
  pointRules: jsonb("point_rules").notNull().default({}),
});

export const clubMembers = pgTable(
  "club_members",
  {
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
  },
  (cm) => [primaryKey({ columns: [cm.clubId, cm.userId] })],
);

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "restrict" }),
  date: date("date", { mode: "date" }).notNull(),
  startsAt: time("starts_at").notNull(),
  season: integer("season"),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "restrict" }),
});

export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    rating: decimal("rating").notNull(),
    slope: integer("slope").notNull(),
    imgUrl: text("img_url"),
  },
  (c) => [
    check("courses_rating_check", sql`${c.rating} > 0`),
    check("courses_slope_check", sql`${c.slope} between 55 and 155`),
  ],
);

export const courseHoles = pgTable(
  "course_holes",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    hole: integer("hole").notNull(),
    par: integer("par").notNull(),
    handicap: integer("handicap").notNull(),
  },
  (ch) => [
    primaryKey({ columns: [ch.courseId, ch.hole] }),
    check("course_holes_hole_check", sql`${ch.hole} between 1 and 18`),
    check("course_holes_par_check", sql`${ch.par} between 2 and 7`),
    check("course_holes_handicap_check", sql`${ch.handicap} between 1 and 18`),
  ],
);

export const rounds = pgTable(
  "rounds",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").references(() => tournaments.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    date: date("date", { mode: "date" }).notNull(),
  },
  (r) => [
    uniqueIndex("rounds_tournament_user_unique")
      .on(r.tournamentId, r.userId)
      .where(sql`${r.tournamentId} IS NOT NULL`),
  ],
);

export const roundScores = pgTable(
  "round_scores",
  {
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    hole: integer("hole").notNull(),
    strokes: integer("strokes"),
    putts: integer("putts"),
  },
  (rs) => [
    primaryKey({ columns: [rs.roundId, rs.hole] }),
    check("round_scores_hole_check", sql`${rs.hole} between 1 and 18`),
    check("round_scores_strokes_check", sql`${rs.strokes} >= 1`),
    check("round_scores_putts_check", sql`${rs.putts} >= 0`),
  ],
);

export const greenies = pgTable(
  "greenies",
  {
    roundId: integer("round_id").notNull(),
    hole: integer("hole").notNull(),
    feet: integer("feet").notNull(),
    inches: integer("inches").notNull(),
  },
  (g) => [
    primaryKey({ columns: [g.roundId, g.hole] }),
    foreignKey({
      columns: [g.roundId, g.hole],
      foreignColumns: [roundScores.roundId, roundScores.hole],
      name: "greenies_round_score_fk",
    }).onDelete("cascade"),
    check("greenies_hole_check", sql`${g.hole} between 1 and 18`),
    check("greenies_feet_check", sql`${g.feet} >= 0`),
    check("greenies_inches_check", sql`${g.inches} between 0 and 11`),
  ],
);
