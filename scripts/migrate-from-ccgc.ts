import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import {
  clubs,
  users,
  courses,
  pars,
  handicaps,
  tournaments,
  strokes,
  putts,
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

async function main() {
  await source.connect();
  console.log("connected to source ccgc");

  console.log("\ntruncating target tables");
  await target.execute(sql`
    TRUNCATE TABLE
      greenies, putts, strokes, rounds, tournaments,
      handicaps, pars, courses, "user", clubs
    RESTART IDENTITY CASCADE
  `);

  console.log("seeding clubs");
  await target.insert(clubs).values([
    {
      handle: "ccgc",
      name: "Contra Costa Golf Club",
      logo: null,
      pointRules: CCGC_POINT_RULES,
    },
    { handle: "casual", name: "Casual Play", logo: null, pointRules: {} },
  ]);

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
  await target.insert(users).values(userRows);

  console.log("copying courses");
  const srcCourses = await source.query(`SELECT * FROM courses`);
  await target.insert(courses).values(
    srcCourses.rows.map((c) => ({
      handle: c.handle,
      name: c.name,
      rating: c.rating,
      slope: c.slope,
      imgUrl: c.img_url,
    })),
  );

  console.log("copying pars (deduped via DISTINCT ON)");
  const srcPars = await source.query(
    `SELECT DISTINCT ON (course_handle) * FROM pars ORDER BY course_handle`,
  );
  await target.insert(pars).values(
    srcPars.rows.map((p) => ({
      courseHandle: p.course_handle,
      hole1: p.hole1, hole2: p.hole2, hole3: p.hole3,
      hole4: p.hole4, hole5: p.hole5, hole6: p.hole6,
      hole7: p.hole7, hole8: p.hole8, hole9: p.hole9,
      hole10: p.hole10, hole11: p.hole11, hole12: p.hole12,
      hole13: p.hole13, hole14: p.hole14, hole15: p.hole15,
      hole16: p.hole16, hole17: p.hole17, hole18: p.hole18,
      total: p.total,
    })),
  );

  console.log("copying handicaps (deduped via DISTINCT ON)");
  const srcHcps = await source.query(
    `SELECT DISTINCT ON (course_handle) * FROM handicaps ORDER BY course_handle`,
  );
  await target.insert(handicaps).values(
    srcHcps.rows.map((h) => ({
      courseHandle: h.course_handle,
      hole1: h.hole1, hole2: h.hole2, hole3: h.hole3,
      hole4: h.hole4, hole5: h.hole5, hole6: h.hole6,
      hole7: h.hole7, hole8: h.hole8, hole9: h.hole9,
      hole10: h.hole10, hole11: h.hole11, hole12: h.hole12,
      hole13: h.hole13, hole14: h.hole14, hole15: h.hole15,
      hole16: h.hole16, hole17: h.hole17, hole18: h.hole18,
    })),
  );

  console.log("migrating tournaments");
  const srcTournaments = await source.query(
    `SELECT date, course_handle, tour_years FROM tournaments ORDER BY date`,
  );
  const tournamentIdByDate = new Map<string, number>();
  for (const t of srcTournaments.rows) {
    const [inserted] = await target
      .insert(tournaments)
      .values({
        clubHandle: "ccgc",
        date: t.date,
        courseHandle: t.course_handle,
        tourYears: t.tour_years,
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
      console.warn(
        `  skipping round ${r.id}: tid=${newTid} uid=${newUid}`,
      );
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

  console.log("copying strokes (deduped via DISTINCT ON)");
  const srcStrokes = await source.query(
    `SELECT DISTINCT ON (round_id) * FROM strokes ORDER BY round_id`,
  );
  await target.insert(strokes).values(
    srcStrokes.rows.map((s) => ({
      roundId: s.round_id,
      hole1: s.hole1, hole2: s.hole2, hole3: s.hole3,
      hole4: s.hole4, hole5: s.hole5, hole6: s.hole6,
      hole7: s.hole7, hole8: s.hole8, hole9: s.hole9,
      hole10: s.hole10, hole11: s.hole11, hole12: s.hole12,
      hole13: s.hole13, hole14: s.hole14, hole15: s.hole15,
      hole16: s.hole16, hole17: s.hole17, hole18: s.hole18,
    })),
  );

  console.log("copying putts (deduped via DISTINCT ON)");
  const srcPutts = await source.query(
    `SELECT DISTINCT ON (round_id) * FROM putts ORDER BY round_id`,
  );
  await target.insert(putts).values(
    srcPutts.rows.map((p) => ({
      roundId: p.round_id,
      hole1: p.hole1, hole2: p.hole2, hole3: p.hole3,
      hole4: p.hole4, hole5: p.hole5, hole6: p.hole6,
      hole7: p.hole7, hole8: p.hole8, hole9: p.hole9,
      hole10: p.hole10, hole11: p.hole11, hole12: p.hole12,
      hole13: p.hole13, hole14: p.hole14, hole15: p.hole15,
      hole16: p.hole16, hole17: p.hole17, hole18: p.hole18,
    })),
  );

  console.log("copying greenies");
  const srcGreenies = await source.query(`SELECT * FROM greenies`);
  await target.insert(greenies).values(
    srcGreenies.rows.map((g) => ({
      roundId: g.round_id,
      holeNumber: g.hole_number,
      feet: g.feet,
      inches: g.inches,
    })),
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
      (SELECT COUNT(*) FROM pars)::int         AS pars,
      (SELECT COUNT(*) FROM handicaps)::int    AS handicaps,
      (SELECT COUNT(*) FROM tournaments)::int  AS tournaments,
      (SELECT COUNT(*) FROM rounds)::int       AS rounds,
      (SELECT COUNT(*) FROM strokes)::int      AS strokes,
      (SELECT COUNT(*) FROM putts)::int        AS putts,
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
