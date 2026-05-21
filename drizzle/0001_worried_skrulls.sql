CREATE TABLE "match_team_members" (
	"match_team_id" integer NOT NULL,
	"round_id" integer NOT NULL,
	CONSTRAINT "match_team_members_match_team_id_round_id_pk" PRIMARY KEY("match_team_id","round_id")
);
--> statement-breakpoint
CREATE TABLE "match_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "format" text DEFAULT 'singles_match_play' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_team_members" ADD CONSTRAINT "match_team_members_match_team_id_match_teams_id_fk" FOREIGN KEY ("match_team_id") REFERENCES "public"."match_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_members" ADD CONSTRAINT "match_team_members_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_teams" ADD CONSTRAINT "match_teams_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_team_members_round_unique" ON "match_team_members" USING btree ("round_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_format_check" CHECK ("matches"."format" in ('singles_match_play', 'four_ball_match_play'));