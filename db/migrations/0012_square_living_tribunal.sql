CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"number" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "seasons_number_check" CHECK ("seasons"."number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_club_number_unique" ON "seasons" USING btree ("club_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_club_current_unique" ON "seasons" USING btree ("club_id") WHERE "seasons"."is_current";--> statement-breakpoint
-- Backfill Club-owned Season records from existing (club_id, season) tournament
-- groupings. Mirrors computeSeasonBackfill in lib/clubs/seasons/backfill.ts:
-- one Season per distinct pair, each Club's highest number becomes current.
INSERT INTO "seasons" ("club_id", "number", "is_current")
SELECT
	pairs."club_id",
	pairs."season",
	pairs."season" = MAX(pairs."season") OVER (PARTITION BY pairs."club_id")
FROM (
	SELECT DISTINCT "club_id", "season"
	FROM "tournaments"
	WHERE "season" IS NOT NULL
) AS pairs;