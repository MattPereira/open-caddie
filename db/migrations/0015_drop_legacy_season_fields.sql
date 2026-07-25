-- Verify every Tournament reaches its Club and Season number through its Season
-- record before the legacy columns holding those values are dropped (#22). A
-- mismatch means the duplicated columns drifted, and dropping them would discard
-- the disagreement silently, so fail the migration instead.
DO $$
DECLARE
  mismatched integer;
BEGIN
  SELECT count(*) INTO mismatched
  FROM tournaments t
  JOIN seasons s ON s.id = t.season_id
  WHERE t.club_id IS DISTINCT FROM s.club_id
     OR (t.season IS NOT NULL AND t.season IS DISTINCT FROM s.number);

  IF mismatched > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop legacy Tournament Club/season columns: % Tournament(s) disagree with their Season',
      mismatched;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_club_id_clubs_id_fk";
--> statement-breakpoint
DROP INDEX "seasons_club_current_unique";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "is_current";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "club_id";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "season";