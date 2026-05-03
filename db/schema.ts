import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  decimal,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
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
  handle: text("handle").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  pointRules: jsonb("point_rules").notNull().default({}),
});

export const courses = pgTable("courses", {
  handle: text("handle").primaryKey(),
  name: text("name").notNull(),
  rating: decimal("rating").notNull(),
  slope: integer("slope").notNull(),
  imgUrl: text("img_url"),
});

export const pars = pgTable("pars", {
  courseHandle: text("course_handle")
    .notNull()
    .references(() => courses.handle, { onDelete: "cascade" }),
  hole1: integer("hole1").notNull(),
  hole2: integer("hole2").notNull(),
  hole3: integer("hole3").notNull(),
  hole4: integer("hole4").notNull(),
  hole5: integer("hole5").notNull(),
  hole6: integer("hole6").notNull(),
  hole7: integer("hole7").notNull(),
  hole8: integer("hole8").notNull(),
  hole9: integer("hole9").notNull(),
  hole10: integer("hole10").notNull(),
  hole11: integer("hole11").notNull(),
  hole12: integer("hole12").notNull(),
  hole13: integer("hole13").notNull(),
  hole14: integer("hole14").notNull(),
  hole15: integer("hole15").notNull(),
  hole16: integer("hole16").notNull(),
  hole17: integer("hole17").notNull(),
  hole18: integer("hole18").notNull(),
  total: integer("total").notNull(),
});

export const handicaps = pgTable("handicaps", {
  courseHandle: text("course_handle")
    .notNull()
    .references(() => courses.handle, { onDelete: "cascade" }),
  hole1: integer("hole1").notNull(),
  hole2: integer("hole2").notNull(),
  hole3: integer("hole3").notNull(),
  hole4: integer("hole4").notNull(),
  hole5: integer("hole5").notNull(),
  hole6: integer("hole6").notNull(),
  hole7: integer("hole7").notNull(),
  hole8: integer("hole8").notNull(),
  hole9: integer("hole9").notNull(),
  hole10: integer("hole10").notNull(),
  hole11: integer("hole11").notNull(),
  hole12: integer("hole12").notNull(),
  hole13: integer("hole13").notNull(),
  hole14: integer("hole14").notNull(),
  hole15: integer("hole15").notNull(),
  hole16: integer("hole16").notNull(),
  hole17: integer("hole17").notNull(),
  hole18: integer("hole18").notNull(),
});

export const tournaments = pgTable(
  "tournaments",
  {
    id: serial("id").primaryKey(),
    clubHandle: text("club_handle")
      .notNull()
      .references(() => clubs.handle, { onDelete: "cascade" }),
    date: date("date", { mode: "date" }).notNull(),
    courseHandle: text("course_handle").references(() => courses.handle),
    tourYears: varchar("tour_years", { length: 7 }).notNull(),
  },
  (t) => [
    uniqueIndex("tournaments_club_date_unique")
      .on(t.clubHandle, t.date)
      .where(sql`${t.clubHandle} <> 'casual'`),
  ],
);

export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});

export const greenies = pgTable("greenies", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  holeNumber: integer("hole_number").notNull(),
  feet: integer("feet").notNull(),
  inches: integer("inches").notNull(),
});

export const strokes = pgTable("strokes", {
  roundId: integer("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  hole1: integer("hole1"),
  hole2: integer("hole2"),
  hole3: integer("hole3"),
  hole4: integer("hole4"),
  hole5: integer("hole5"),
  hole6: integer("hole6"),
  hole7: integer("hole7"),
  hole8: integer("hole8"),
  hole9: integer("hole9"),
  hole10: integer("hole10"),
  hole11: integer("hole11"),
  hole12: integer("hole12"),
  hole13: integer("hole13"),
  hole14: integer("hole14"),
  hole15: integer("hole15"),
  hole16: integer("hole16"),
  hole17: integer("hole17"),
  hole18: integer("hole18"),
});

export const putts = pgTable("putts", {
  roundId: integer("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  hole1: integer("hole1"),
  hole2: integer("hole2"),
  hole3: integer("hole3"),
  hole4: integer("hole4"),
  hole5: integer("hole5"),
  hole6: integer("hole6"),
  hole7: integer("hole7"),
  hole8: integer("hole8"),
  hole9: integer("hole9"),
  hole10: integer("hole10"),
  hole11: integer("hole11"),
  hole12: integer("hole12"),
  hole13: integer("hole13"),
  hole14: integer("hole14"),
  hole15: integer("hole15"),
  hole16: integer("hole16"),
  hole17: integer("hole17"),
  hole18: integer("hole18"),
});
