import { eq, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  pgView,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const matchFormats = [
  "singles_match_play",
  "three_ball_match_play",
  "four_ball_match_play",
] as const;
export type MatchFormat = (typeof matchFormats)[number];

export const roundScorecardUploadStatuses = ["parsed", "failed"] as const;
export type RoundScorecardUploadStatus =
  (typeof roundScorecardUploadStatuses)[number];

export const courseScorecardImportStatuses = [
  "paused",
  "published",
  "stale",
  "cancelled",
] as const;
export type CourseScorecardImportStatus =
  (typeof courseScorecardImportStatuses)[number];

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

// Club-owned Season records (ADR 0004). Numbers are Club-relative and begin at
// 1. A Club's Current Season is its highest-numbered one rather than a stored
// flag, so uniqueness of (club_id, number) is what keeps it single. That the
// highest number only ever climbs rests on the app exposing no way to delete a
// Season; nothing below enforces it, so see ADR 0004 before adding one.
export const seasons = pgTable(
  "seasons",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
  },
  (s) => [
    uniqueIndex("seasons_club_number_unique").on(s.clubId, s.number),
    check("seasons_number_check", sql`${s.number} >= 1`),
  ],
);

// A Tournament's Club is reached through its Season (ADR 0004); it is
// deliberately not stored here.
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "restrict" }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "restrict" }),
  teeId: integer("tee_id")
    .notNull()
    .references(() => courseTees.id, { onDelete: "restrict" }),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  imgUrl: text("img_url"),
  scorecardImgUrl: text("scorecard_img_url"),
});

// Lifecycle data is relational so active-target constraints remain enforceable;
// the versioned review document deliberately stays behind the import module.
export const courseScorecardImports = pgTable(
  "course_scorecard_imports",
  {
    id: text("id").primaryKey(),
    targetKind: text("target_kind").$type<"new" | "existing">().notNull(),
    reservedHandle: text("reserved_handle"),
    courseId: integer("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),
    stagedScorecardImageHandle: text("staged_scorecard_image_handle").notNull(),
    stagedCourseImageHandle: text("staged_course_image_handle"),
    stagedImageDeletionHandles: jsonb("staged_image_deletion_handles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text("status").$type<CourseScorecardImportStatus>().notNull(),
    revision: integer("revision").notNull().default(0),
    document: jsonb("document").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lastEditedByUserId: text("last_edited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { mode: "date" }),
  },
  (importRow) => [
    uniqueIndex("course_scorecard_imports_active_new_handle_unique")
      .on(importRow.reservedHandle)
      .where(sql`${importRow.status} = 'paused' and ${importRow.targetKind} = 'new'`),
    uniqueIndex("course_scorecard_imports_active_course_unique")
      .on(importRow.courseId)
      .where(sql`${importRow.status} = 'paused' and ${importRow.targetKind} = 'existing'`),
    uniqueIndex("course_scorecard_imports_new_target_image_unique")
      .on(importRow.reservedHandle, importRow.stagedScorecardImageHandle)
      .where(sql`${importRow.status} in ('paused', 'published') and ${importRow.targetKind} = 'new'`),
    uniqueIndex("course_scorecard_imports_existing_target_image_unique")
      .on(importRow.courseId, importRow.stagedScorecardImageHandle)
      .where(sql`${importRow.status} in ('paused', 'published') and ${importRow.targetKind} = 'existing'`),
    check(
      "course_scorecard_imports_target_check",
      sql`(${importRow.targetKind} = 'new' and ${importRow.reservedHandle} is not null and ${importRow.courseId} is null) or (${importRow.targetKind} = 'existing' and ${importRow.courseId} is not null and ${importRow.reservedHandle} is null)`,
    ),
    check(
      "course_scorecard_imports_status_check",
      sql`${importRow.status} in ('paused', 'published', 'stale', 'cancelled')`,
    ),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    date: date("date", { mode: "date" }).notNull(),
    format: text("format")
      .$type<MatchFormat>()
      .notNull()
      .default("singles_match_play"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (m) => [
    check(
      "matches_format_check",
      sql`${m.format} in ('singles_match_play', 'three_ball_match_play', 'four_ball_match_play')`,
    ),
  ],
);

export const matchTeams = pgTable("match_teams", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const courseTees = pgTable(
  "course_tees",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    rating: decimal("rating").notNull(),
    slope: integer("slope").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("course_tees_id_course_unique").on(t.id, t.courseId),
    uniqueIndex("course_tees_course_name_unique").on(t.courseId, t.name),
    check("course_tees_rating_check", sql`${t.rating} > 0`),
    check("course_tees_slope_check", sql`${t.slope} between 55 and 155`),
  ],
);

export const teeYardages = pgTable(
  "tee_yardages",
  {
    teeId: integer("tee_id")
      .notNull()
      .references(() => courseTees.id, { onDelete: "cascade" }),
    hole: integer("hole").notNull(),
    yards: integer("yards").notNull(),
  },
  (ty) => [
    primaryKey({ columns: [ty.teeId, ty.hole] }),
    check("tee_yardages_hole_check", sql`${ty.hole} between 1 and 18`),
    check("tee_yardages_yards_check", sql`${ty.yards} > 0`),
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

// Scrambles deliberately use a parallel event/team/score model (ADR 0005),
// keeping their scores outside Rounds, Seasons, standings, and handicaps.
export const scrambles = pgTable(
  "scrambles",
  {
    id: serial("id").primaryKey(),
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    date: date("date", { mode: "date" }).notNull(),
    startTime: time("start_time").notNull(),
    timezone: text("timezone").notNull(),
    courseId: integer("course_id").notNull(),
    teeId: integer("tee_id").notNull(),
  },
  (scramble) => [
    foreignKey({
      columns: [scramble.teeId, scramble.courseId],
      foreignColumns: [courseTees.id, courseTees.courseId],
      name: "scrambles_tee_course_fk",
    }).onDelete("restrict"),
    check(
      "scrambles_handle_check",
      sql`${scramble.handle} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const scrambleTeams = pgTable(
  "scramble_teams",
  {
    id: serial("id").primaryKey(),
    scrambleId: integer("scramble_id")
      .notNull()
      .references(() => scrambles.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    startingHole: integer("starting_hole").notNull(),
  },
  (team) => [
    uniqueIndex("scramble_teams_scramble_name_unique").on(
      team.scrambleId,
      sql`lower(${team.name})`,
    ),
    check(
      "scramble_teams_starting_hole_check",
      sql`${team.startingHole} between 1 and 18`,
    ),
  ],
);

export const scrambleTeamMembers = pgTable("scramble_team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => scrambleTeams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const scrambleTeamScores = pgTable(
  "scramble_team_scores",
  {
    teamId: integer("team_id")
      .notNull()
      .references(() => scrambleTeams.id, { onDelete: "cascade" }),
    hole: integer("hole").notNull(),
    strokes: integer("strokes").notNull(),
  },
  (score) => [
    primaryKey({ columns: [score.teamId, score.hole] }),
    check(
      "scramble_team_scores_hole_check",
      sql`${score.hole} between 1 and 18`,
    ),
    check(
      "scramble_team_scores_strokes_check",
      sql`${score.strokes} >= 1`,
    ),
  ],
);

export const rounds = pgTable(
  "rounds",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").references(() => tournaments.id, {
      onDelete: "restrict",
    }),
    matchId: integer("match_id").references(() => matches.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    teeId: integer("tee_id")
      .notNull()
      .references(() => courseTees.id, { onDelete: "restrict" }),
    date: date("date", { mode: "date" }).notNull(),
    playerIndexOverride: decimal("player_index_override", {
      precision: 4,
      scale: 1,
    }),
  },
  (r) => [
    uniqueIndex("rounds_tournament_user_unique")
      .on(r.tournamentId, r.userId)
      .where(sql`${r.tournamentId} IS NOT NULL`),
    uniqueIndex("rounds_match_user_unique")
      .on(r.matchId, r.userId)
      .where(sql`${r.matchId} IS NOT NULL`),
    check(
      "rounds_single_event_check",
      sql`not (${r.tournamentId} is not null and ${r.matchId} is not null)`,
    ),
  ],
);

export const matchTeamMembers = pgTable(
  "match_team_members",
  {
    matchTeamId: integer("match_team_id")
      .notNull()
      .references(() => matchTeams.id, { onDelete: "cascade" }),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
  },
  (mtm) => [
    primaryKey({ columns: [mtm.matchTeamId, mtm.roundId] }),
    uniqueIndex("match_team_members_round_unique").on(mtm.roundId),
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

export const roundScorecardUploads = pgTable(
  "round_scorecard_uploads",
  {
    id: serial("id").primaryKey(),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tournamentId: integer("tournament_id").references(() => tournaments.id, {
      onDelete: "restrict",
    }),
    matchId: integer("match_id").references(() => matches.id, {
      onDelete: "restrict",
    }),
    imageUrl: text("image_url").notNull(),
    additionalContext: text("additional_context"),
    status: text("status").$type<RoundScorecardUploadStatus>().notNull(),
    parsed: jsonb("parsed"),
    sumCheckIssues: jsonb("sum_check_issues").$type<string[]>().notNull().default([]),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (upload) => [
    check(
      "round_scorecard_uploads_status_check",
      sql`${upload.status} in ('parsed', 'failed')`,
    ),
    check(
      "round_scorecard_uploads_single_event_check",
      sql`not (${upload.tournamentId} is not null and ${upload.matchId} is not null)`,
    ),
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

export const roundSummaries = pgView("round_summaries").as((qb) =>
  qb
    .select({
      roundId: rounds.id,
      tournamentId: rounds.tournamentId,
      matchId: rounds.matchId,
      clubId: seasons.clubId,
      userId: rounds.userId,
      courseId: rounds.courseId,
      date: rounds.date,
      playerIndexOverride: rounds.playerIndexOverride,
      courseRating: courseTees.rating,
      courseSlope: courseTees.slope,
      recordedStrokesCount:
        sql<number>`count(${roundScores.strokes})`
          .mapWith(Number)
          .as("recorded_strokes_count"),
      recordedPuttsCount:
        sql<number>`count(${roundScores.putts})`
          .mapWith(Number)
          .as("recorded_putts_count"),
      totalStrokes:
        sql<number>`coalesce(sum(${roundScores.strokes}), 0)::int`.mapWith(
          Number,
        ).as("total_strokes"),
      totalPutts:
        sql<number>`coalesce(sum(${roundScores.putts}), 0)::int`.mapWith(
          Number,
        ).as("total_putts"),
      isComplete: sql<boolean>`count(${roundScores.strokes}) = 18`.as(
        "is_complete",
      ),
      scoreDifferential:
        sql<number | null>`case when count(${roundScores.strokes}) = 18 then ((113.0 / ${courseTees.slope}) * (sum(${roundScores.strokes}) - ${courseTees.rating}))::double precision else null end`.mapWith(
          (value) => (value == null ? null : Number(value)),
        ).as("score_differential"),
    })
    .from(rounds)
    .innerJoin(courseTees, eq(rounds.teeId, courseTees.id))
    .leftJoin(tournaments, eq(rounds.tournamentId, tournaments.id))
    .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .leftJoin(roundScores, eq(rounds.id, roundScores.roundId))
    .groupBy(
      rounds.id,
      rounds.tournamentId,
      rounds.matchId,
      seasons.clubId,
      rounds.userId,
      rounds.courseId,
      rounds.date,
      rounds.playerIndexOverride,
      courseTees.rating,
      courseTees.slope,
    ),
);
