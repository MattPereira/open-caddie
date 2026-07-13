CREATE TABLE "course_scorecard_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"target_kind" text NOT NULL,
	"reserved_handle" text,
	"course_id" integer,
	"staged_scorecard_image_handle" text NOT NULL,
	"staged_course_image_handle" text,
	"status" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"document" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"last_edited_by_user_id" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "course_scorecard_imports_target_check" CHECK (("course_scorecard_imports"."target_kind" = 'new' and "course_scorecard_imports"."reserved_handle" is not null and "course_scorecard_imports"."course_id" is null) or ("course_scorecard_imports"."target_kind" = 'existing' and "course_scorecard_imports"."course_id" is not null and "course_scorecard_imports"."reserved_handle" is null)),
	CONSTRAINT "course_scorecard_imports_status_check" CHECK ("course_scorecard_imports"."status" in ('paused', 'published', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" ADD CONSTRAINT "course_scorecard_imports_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" ADD CONSTRAINT "course_scorecard_imports_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" ADD CONSTRAINT "course_scorecard_imports_last_edited_by_user_id_user_id_fk" FOREIGN KEY ("last_edited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_scorecard_imports_active_new_handle_unique" ON "course_scorecard_imports" USING btree ("reserved_handle") WHERE "course_scorecard_imports"."status" = 'paused' and "course_scorecard_imports"."target_kind" = 'new';--> statement-breakpoint
CREATE UNIQUE INDEX "course_scorecard_imports_active_course_unique" ON "course_scorecard_imports" USING btree ("course_id") WHERE "course_scorecard_imports"."status" = 'paused' and "course_scorecard_imports"."target_kind" = 'existing';--> statement-breakpoint
CREATE UNIQUE INDEX "course_scorecard_imports_target_image_unique" ON "course_scorecard_imports" USING btree ("reserved_handle","course_id","staged_scorecard_image_handle");