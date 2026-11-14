-- Everything dropped below is derivable from a Tournament's Season, so verify
-- the derivation actually reproduces what the columns hold before discarding
-- them (#22). Drift would otherwise disappear silently.
--
-- Tournament Club and Season number: every Tournament must reach a Season, and
-- that Season must agree with the legacy columns. A legacy season number left
-- NULL is not drift -- there is no value to preserve -- so only non-NULL ones
-- are compared. The left join is deliberate: an inner join would hide exactly
-- the Tournaments that fail to reach a Season.
DO $$
DECLARE
  invalid integer;
BEGIN
  SELECT count(*) INTO invalid
  FROM tournaments t
  LEFT JOIN seasons s ON s.id = t.season_id
  WHERE s.id IS NULL
     OR t.club_id IS DISTINCT FROM s.club_id
     OR (t.season IS NOT NULL AND t.season IS DISTINCT FROM s.number);

  IF invalid > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop legacy Tournament Club/season columns: % Tournament(s) lack valid Season membership or disagree with their Season',
      invalid;
  END IF;
END $$;
--> statement-breakpoint
-- Season currency: a Club's Current Season becomes its highest-numbered Season,
-- so every Club currently flagged must already be flagged on that Season. A Club
-- flagged elsewhere would have its default Season silently repointed.
DO $$
DECLARE
  repointed integer;
BEGIN
  SELECT count(*) INTO repointed
  FROM seasons s
  WHERE s.is_current
    AND s.number <> (SELECT max(s2.number) FROM seasons s2 WHERE s2.club_id = s.club_id);

  IF repointed > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop seasons.is_current: % Club(s) flag a Season that is not their highest-numbered one',
      repointed;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_club_id_clubs_id_fk";
--> statement-breakpoint
DROP INDEX "seasons_club_current_unique";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "is_current";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "season";