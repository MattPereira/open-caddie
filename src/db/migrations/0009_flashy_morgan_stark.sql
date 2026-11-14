ALTER TABLE "course_scorecard_imports" DROP CONSTRAINT "course_scorecard_imports_status_check";--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" ADD CONSTRAINT "course_scorecard_imports_status_check" CHECK ("course_scorecard_imports"."status" in ('paused', 'published', 'stale', 'cancelled'));
