CREATE TABLE "round_scorecard_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"tournament_id" integer,
	"match_id" integer,
	"image_url" text NOT NULL,
	"additional_context" text,
	"status" text NOT NULL,
	"parsed" jsonb,
	"sum_check_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "round_scorecard_uploads_status_check" CHECK ("round_scorecard_uploads"."status" in ('parsed', 'failed')),
	CONSTRAINT "round_scorecard_uploads_single_event_check" CHECK (not ("round_scorecard_uploads"."tournament_id" is not null and "round_scorecard_uploads"."match_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "round_scorecard_uploads" ADD CONSTRAINT "round_scorecard_uploads_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scorecard_uploads" ADD CONSTRAINT "round_scorecard_uploads_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_scorecard_uploads" ADD CONSTRAINT "round_scorecard_uploads_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;