CREATE TABLE "scramble_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scramble_team_scores" (
	"team_id" integer NOT NULL,
	"hole" integer NOT NULL,
	"strokes" integer NOT NULL,
	CONSTRAINT "scramble_team_scores_team_id_hole_pk" PRIMARY KEY("team_id","hole"),
	CONSTRAINT "scramble_team_scores_hole_check" CHECK ("scramble_team_scores"."hole" between 1 and 18),
	CONSTRAINT "scramble_team_scores_strokes_check" CHECK ("scramble_team_scores"."strokes" >= 1)
);
--> statement-breakpoint
CREATE TABLE "scramble_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"scramble_id" integer NOT NULL,
	"name" text NOT NULL,
	"starting_hole" integer NOT NULL,
	CONSTRAINT "scramble_teams_starting_hole_check" CHECK ("scramble_teams"."starting_hole" between 1 and 18)
);
--> statement-breakpoint
CREATE TABLE "scrambles" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"timezone" text NOT NULL,
	"course_id" integer NOT NULL,
	"tee_id" integer NOT NULL,
	CONSTRAINT "scrambles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "scramble_team_members" ADD CONSTRAINT "scramble_team_members_team_id_scramble_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."scramble_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scramble_team_scores" ADD CONSTRAINT "scramble_team_scores_team_id_scramble_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."scramble_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scramble_teams" ADD CONSTRAINT "scramble_teams_scramble_id_scrambles_id_fk" FOREIGN KEY ("scramble_id") REFERENCES "public"."scrambles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_tees_id_course_unique" ON "course_tees" USING btree ("id","course_id");--> statement-breakpoint
ALTER TABLE "scrambles" ADD CONSTRAINT "scrambles_tee_course_fk" FOREIGN KEY ("tee_id","course_id") REFERENCES "public"."course_tees"("id","course_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scramble_teams_scramble_name_unique" ON "scramble_teams" USING btree ("scramble_id",lower("name"));
