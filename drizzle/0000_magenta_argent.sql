CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "club_members" (
	"club_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "club_members_club_id_user_id_pk" PRIMARY KEY("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"point_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "clubs_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "course_holes" (
	"course_id" integer NOT NULL,
	"hole" integer NOT NULL,
	"par" integer NOT NULL,
	"handicap" integer NOT NULL,
	CONSTRAINT "course_holes_course_id_hole_pk" PRIMARY KEY("course_id","hole"),
	CONSTRAINT "course_holes_hole_check" CHECK ("course_holes"."hole" between 1 and 18),
	CONSTRAINT "course_holes_par_check" CHECK ("course_holes"."par" between 2 and 7),
	CONSTRAINT "course_holes_handicap_check" CHECK ("course_holes"."handicap" between 1 and 18)
);
--> statement-breakpoint
CREATE TABLE "course_tees" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"rating" numeric NOT NULL,
	"slope" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "course_tees_rating_check" CHECK ("course_tees"."rating" > 0),
	CONSTRAINT "course_tees_slope_check" CHECK ("course_tees"."slope" between 55 and 155)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"img_url" text,
	"scorecard_img_url" text,
	CONSTRAINT "courses_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "greenies" (
	"round_id" integer NOT NULL,
	"hole" integer NOT NULL,
	"feet" integer NOT NULL,
	"inches" integer NOT NULL,
	CONSTRAINT "greenies_round_id_hole_pk" PRIMARY KEY("round_id","hole"),
	CONSTRAINT "greenies_hole_check" CHECK ("greenies"."hole" between 1 and 18),
	CONSTRAINT "greenies_feet_check" CHECK ("greenies"."feet" >= 0),
	CONSTRAINT "greenies_inches_check" CHECK ("greenies"."inches" between 0 and 11)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by_user_id" text NOT NULL,
	"course_id" integer NOT NULL,
	"date" date NOT NULL,
	"starts_at" time NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_scores" (
	"round_id" integer NOT NULL,
	"hole" integer NOT NULL,
	"strokes" integer,
	"putts" integer,
	CONSTRAINT "round_scores_round_id_hole_pk" PRIMARY KEY("round_id","hole"),
	CONSTRAINT "round_scores_hole_check" CHECK ("round_scores"."hole" between 1 and 18),
	CONSTRAINT "round_scores_strokes_check" CHECK ("round_scores"."strokes" >= 1),
	CONSTRAINT "round_scores_putts_check" CHECK ("round_scores"."putts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer,
	"match_id" integer,
	"user_id" text NOT NULL,
	"course_id" integer NOT NULL,
	"tee_id" integer NOT NULL,
	"date" date NOT NULL,
	"handicap_index_override" numeric(4, 1),
	CONSTRAINT "rounds_single_event_check" CHECK (not ("rounds"."tournament_id" is not null and "rounds"."match_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tee_yardages" (
	"tee_id" integer NOT NULL,
	"hole" integer NOT NULL,
	"yards" integer NOT NULL,
	CONSTRAINT "tee_yardages_tee_id_hole_pk" PRIMARY KEY("tee_id","hole"),
	CONSTRAINT "tee_yardages_hole_check" CHECK ("tee_yardages"."hole" between 1 and 18),
	CONSTRAINT "tee_yardages_yards_check" CHECK ("tee_yardages"."yards" > 0)
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"date" date NOT NULL,
	"starts_at" time NOT NULL,
	"season" integer,
	"course_id" integer NOT NULL,
	"tee_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"username" text,
	"firstName" text,
	"lastName" text,
	"isAdmin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_holes" ADD CONSTRAINT "course_holes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_tees" ADD CONSTRAINT "course_tees_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "greenies" ADD CONSTRAINT "greenies_round_score_fk" FOREIGN KEY ("round_id","hole") REFERENCES "public"."round_scores"("round_id","hole") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scores" ADD CONSTRAINT "round_scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tee_id_course_tees_id_fk" FOREIGN KEY ("tee_id") REFERENCES "public"."course_tees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tee_yardages" ADD CONSTRAINT "tee_yardages_tee_id_course_tees_id_fk" FOREIGN KEY ("tee_id") REFERENCES "public"."course_tees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_tee_id_course_tees_id_fk" FOREIGN KEY ("tee_id") REFERENCES "public"."course_tees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_tees_course_name_unique" ON "course_tees" USING btree ("course_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_tournament_user_unique" ON "rounds" USING btree ("tournament_id","user_id") WHERE "rounds"."tournament_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_match_user_unique" ON "rounds" USING btree ("match_id","user_id") WHERE "rounds"."match_id" IS NOT NULL;--> statement-breakpoint
CREATE VIEW "public"."round_summaries" AS (select "rounds"."id", "rounds"."tournament_id", "rounds"."match_id", "tournaments"."club_id", "rounds"."user_id", "rounds"."course_id", "rounds"."date", "rounds"."handicap_index_override", "course_tees"."rating", "course_tees"."slope", count("round_scores"."strokes") as "recorded_strokes_count", count("round_scores"."putts") as "recorded_putts_count", coalesce(sum("round_scores"."strokes"), 0)::int as "total_strokes", coalesce(sum("round_scores"."putts"), 0)::int as "total_putts", count("round_scores"."strokes") = 18 as "is_complete", case when count("round_scores"."strokes") = 18 then ((113.0 / "course_tees"."slope") * (sum("round_scores"."strokes") - "course_tees"."rating"))::double precision else null end as "score_differential" from "rounds" inner join "course_tees" on "rounds"."tee_id" = "course_tees"."id" left join "tournaments" on "rounds"."tournament_id" = "tournaments"."id" left join "round_scores" on "rounds"."id" = "round_scores"."round_id" group by "rounds"."id", "rounds"."tournament_id", "rounds"."match_id", "tournaments"."club_id", "rounds"."user_id", "rounds"."course_id", "rounds"."date", "rounds"."handicap_index_override", "course_tees"."rating", "course_tees"."slope");