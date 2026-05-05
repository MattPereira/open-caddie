import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import {
  clubs,
  users,
  courses,
  courseHoles,
  seasons,
  tournaments,
  roundScores,
  greenies,
} from "../db/schema";

const CCGC_URL = process.env.CCGC_DATABASE_URL;
const TARGET_URL = process.env.DATABASE_URL;

if (!CCGC_URL) throw new Error("CCGC_DATABASE_URL is not set");
if (!TARGET_URL) throw new Error("DATABASE_URL is not set");

const target = drizzle(TARGET_URL);

// Strip PG* env vars so node-postgres doesn't fall back to Neon credentials
// when the source URL leaves host/user/password unspecified.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("PG") || key.startsWith("POSTGRES_")) {
    delete process.env[key];
  }
}

// node-postgres defaults empty host → TCP localhost (which requires a password
// on most Linux installs). Force the Unix socket path so it uses peer auth,
// matching psql's behavior.
const source = new Client({
  host: "/var/run/postgresql",
  database: "ccgc",
});

const CCGC_POINT_RULES = {
  participation: 3,
  pars: 1,
  birdies: 2,
  eagles: 4,
  aces: 10,
  strokes: { positions: [25, 20, 15, 10, 5] },
  putts: { positions: [6, 4, 2] },
  greenies: {
    tiers: [
      { maxFt: 2, pts: 4 },
      { maxFt: 10, pts: 3 },
      { maxFt: 20, pts: 2 },
      { maxFt: null, pts: 1 },
    ],
  },
};

const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const CCGC_CLUB_ID = 1;
const CASUAL_CLUB_ID = 2;
type LegacyCourseHoleRow = { course_handle: string } & Record<
  `hole${number}`,
  number
>;
type LegacyRoundScoreRow = { round_id: number } & Record<
  `hole${number}`,
  number | null
>;

async function insertInBatches<T>(
  rows: T[],
  batchSize: number,
  insertBatch: (batch: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    await insertBatch(rows.slice(i, i + batchSize));
  }
}

async function main() {
  await source.connect();
  console.log("connected to source ccgc");

  console.log("\ntruncating target tables");
  await target.execute(sql`
    TRUNCATE TABLE
      greenies, round_scores, rounds, tournaments, seasons,
      course_holes, courses, "account", "session", "verificationToken",
      "user", clubs
    RESTART IDENTITY CASCADE
  `);

  console.log("seeding clubs");
  await target.insert(clubs).values([
    {
      id: CCGC_CLUB_ID,
      handle: "ccgc",
      name: "Contra Costa Golf Club",
      logo: null,
      pointRules: CCGC_POINT_RULES,
    },
    {
      id: CASUAL_CLUB_ID,
      handle: "casual",
      name: "Casual Play",
      logo: null,
      pointRules: {},
    },
  ]);
  await target.execute(
    sql`SELECT setval('clubs_id_seq', COALESCE((SELECT MAX(id) FROM clubs), 1))`,
  );

  console.log("migrating users");
  const srcUsers = await source.query(
    `SELECT username, email, first_name, last_name, is_admin FROM users`,
  );
  const userIdByUsername = new Map<string, string>();
  const userRows = srcUsers.rows.map((u) => {
    const id = crypto.randomUUID();
    userIdByUsername.set(u.username, id);
    const name =
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null;
    return {
      id,
      username: u.username,
      email: u.email,
      name,
      image: null,
      emailVerified: null,
      firstName: u.first_name,
      lastName: u.last_name,
      isAdmin: u.is_admin,
    };
  });
  await insertInBatches(userRows, 250, (batch) =>
    target.insert(users).values(batch),
  );

  console.log("copying courses");
  const srcCourses = await source.query(`SELECT * FROM courses`);
  const insertedCourses = await target
    .insert(courses)
    .values(
      srcCourses.rows.map((c) => ({
        handle: c.handle,
        name: c.name,
        rating: c.rating,
        slope: c.slope,
        imgUrl: c.img_url,
      })),
    )
    .returning({ id: courses.id, handle: courses.handle });
  const courseIdByHandle = new Map(
    insertedCourses.map((c) => [c.handle, c.id]),
  );

  console.log("copying course holes (deduped via DISTINCT ON)");
  const srcPars = await source.query<LegacyCourseHoleRow>(
    `SELECT DISTINCT ON (course_handle) * FROM pars ORDER BY course_handle`,
  );
  const srcHcps = await source.query<LegacyCourseHoleRow>(
    `SELECT DISTINCT ON (course_handle) * FROM handicaps ORDER BY course_handle`,
  );
  const hcpByCourse = new Map(srcHcps.rows.map((h) => [h.course_handle, h]));
  const courseHoleRows = srcPars.rows.flatMap((p) => {
    const h = hcpByCourse.get(p.course_handle);
    const courseId = courseIdByHandle.get(p.course_handle);
    if (!h || !courseId) {
      console.warn(
        `  skipping course holes for ${p.course_handle}: courseId=${courseId} handicaps=${Boolean(h)}`,
      );
      return [];
    }

    return Array.from({ length: 18 }, (_, index) => {
      const holeNumber = index + 1;
      const holeKey = `hole${holeNumber}` as `hole${number}`;
      return {
        courseId,
        holeNumber,
        par: p[holeKey],
        handicap: h[holeKey],
      };
    });
  });
  if (courseHoleRows.length > 0) {
    await insertInBatches(courseHoleRows, 250, (batch) =>
      target.insert(courseHoles).values(batch),
    );
  }

  console.log("migrating seasons (grouped from legacy tour_years)");
  const srcSeasonGroups = await source.query<{
    tour_years: string;
    start_date: Date;
    end_date: Date;
  }>(
    `SELECT
       tour_years,
       MIN(date) AS start_date,
       MAX(date) AS end_date
     FROM tournaments
     GROUP BY tour_years
     ORDER BY MIN(date)`,
  );
  const seasonRows = srcSeasonGroups.rows.map((s, i) => ({
    clubId: CCGC_CLUB_ID,
    number: i + 1,
    name: s.tour_years,
    startDate: s.start_date,
    endDate: s.end_date,
  }));
  await target.insert(seasons).values(seasonRows);
  console.log(`  ${seasonRows.length} seasons inserted`);

  console.log("migrating tournaments");
  const srcTournaments = await source.query(
    `SELECT date, course_handle FROM tournaments ORDER BY date`,
  );
  const tournamentIdByDate = new Map<string, number>();
  for (const t of srcTournaments.rows) {
    const [inserted] = await target
      .insert(tournaments)
      .values({
        clubId: CCGC_CLUB_ID,
        date: t.date,
        courseId: courseIdByHandle.get(t.course_handle) ?? null,
      })
      .returning({ id: tournaments.id });
    tournamentIdByDate.set(dateKey(t.date), inserted.id);
  }

  console.log("migrating rounds (preserving legacy ids)");
  const srcRounds = await source.query(
    `SELECT id, tournament_date, username FROM rounds ORDER BY id`,
  );
  let roundsInserted = 0;
  for (const r of srcRounds.rows) {
    const newTid = tournamentIdByDate.get(dateKey(r.tournament_date));
    const newUid = userIdByUsername.get(r.username);
    if (!newTid || !newUid) {
      console.warn(`  skipping round ${r.id}: tid=${newTid} uid=${newUid}`);
      continue;
    }
    await target.execute(sql`
      INSERT INTO rounds (id, tournament_id, user_id)
      VALUES (${r.id}, ${newTid}, ${newUid})
    `);
    roundsInserted++;
  }
  await target.execute(
    sql`SELECT setval('rounds_id_seq', COALESCE((SELECT MAX(id) FROM rounds), 1))`,
  );
  console.log(`  ${roundsInserted} rounds inserted`);

  console.log("copying round scores (deduped via DISTINCT ON)");
  const srcStrokes = await source.query<LegacyRoundScoreRow>(
    `SELECT DISTINCT ON (round_id) * FROM strokes ORDER BY round_id`,
  );
  const srcPutts = await source.query<LegacyRoundScoreRow>(
    `SELECT DISTINCT ON (round_id) * FROM putts ORDER BY round_id`,
  );
  const puttsByRound = new Map(srcPutts.rows.map((p) => [p.round_id, p]));
  const roundScoreRows = srcStrokes.rows.flatMap((s) => {
    const p = puttsByRound.get(s.round_id);
    if (!p) {
      console.warn(`  skipping round scores for ${s.round_id}: no putts`);
      return [];
    }

    return Array.from({ length: 18 }, (_, index) => {
      const holeNumber = index + 1;
      const holeKey = `hole${holeNumber}` as `hole${number}`;
      return {
        roundId: s.round_id,
        holeNumber,
        strokes: s[holeKey],
        putts: p[holeKey],
      };
    });
  });
  if (roundScoreRows.length > 0) {
    await insertInBatches(roundScoreRows, 250, (batch) =>
      target.insert(roundScores).values(batch),
    );
  }

  console.log("copying greenies");
  const srcGreenies = await source.query(`SELECT * FROM greenies`);
  const greenieRows = srcGreenies.rows.map((g) => ({
    roundId: g.round_id,
    holeNumber: g.hole_number,
    feet: g.feet,
    inches: g.inches,
  }));
  await insertInBatches(greenieRows, 250, (batch) =>
    target.insert(greenies).values(batch),
  );
  await target.execute(
    sql`SELECT setval('greenies_id_seq', COALESCE((SELECT MAX(id) FROM greenies), 1))`,
  );

  console.log("\ntarget row counts:");
  const counts = await target.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM clubs)::int        AS clubs,
      (SELECT COUNT(*) FROM "user")::int       AS users,
      (SELECT COUNT(*) FROM courses)::int      AS courses,
      (SELECT COUNT(*) FROM course_holes)::int AS course_holes,
      (SELECT COUNT(*) FROM seasons)::int      AS seasons,
      (SELECT COUNT(*) FROM tournaments)::int  AS tournaments,
      (SELECT COUNT(*) FROM rounds)::int       AS rounds,
      (SELECT COUNT(*) FROM round_scores)::int AS round_scores,
      (SELECT COUNT(*) FROM greenies)::int     AS greenies
  `);
  console.table(counts.rows ?? counts);

  await source.end();
  console.log("\ndone");
}

main().catch(async (e) => {
  console.error("migration failed:", e);
  await source.end().catch(() => {});
  process.exit(1);
});
