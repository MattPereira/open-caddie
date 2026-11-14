ALTER TABLE "tournaments" ADD COLUMN "season_id" integer;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "seasons" ("club_id", "number", "is_current")
SELECT DISTINCT "t"."club_id", 1, true
FROM "tournaments" AS "t"
WHERE NOT EXISTS (
  SELECT 1 FROM "seasons" AS "existing" WHERE "existing"."club_id" = "t"."club_id"
);--> statement-breakpoint
UPDATE "tournaments" AS "t"
SET "season_id" = "s"."id"
FROM "seasons" AS "s"
WHERE "s"."club_id" = "t"."club_id"
  AND "s"."number" = "t"."season";--> statement-breakpoint
UPDATE "tournaments" AS "t"
SET "season_id" = "s"."id",
    "season" = "s"."number"
FROM "seasons" AS "s"
WHERE "s"."club_id" = "t"."club_id"
  AND "s"."is_current"
  AND "t"."season_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "season_id" SET NOT NULL;
