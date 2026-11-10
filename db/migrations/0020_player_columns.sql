ALTER TABLE "club_members" RENAME COLUMN "user_id" TO "player_id";--> statement-breakpoint
ALTER TABLE "club_members" RENAME CONSTRAINT "club_members_club_id_user_id_pk" TO "club_members_club_id_player_id_pk";--> statement-breakpoint
ALTER TABLE "club_members" RENAME CONSTRAINT "club_members_user_id_user_id_fk" TO "club_members_player_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" RENAME COLUMN "created_by_user_id" TO "created_by_player_id";--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" RENAME COLUMN "last_edited_by_user_id" TO "last_edited_by_player_id";--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" RENAME CONSTRAINT "course_scorecard_imports_created_by_user_id_user_id_fk" TO "course_scorecard_imports_created_by_player_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "course_scorecard_imports" RENAME CONSTRAINT "course_scorecard_imports_last_edited_by_user_id_user_id_fk" TO "course_scorecard_imports_last_edited_by_player_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "created_by_user_id" TO "created_by_player_id";--> statement-breakpoint
ALTER TABLE "matches" RENAME CONSTRAINT "matches_created_by_user_id_user_id_fk" TO "matches_created_by_player_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "round_scorecard_uploads" RENAME COLUMN "uploaded_by_user_id" TO "uploaded_by_player_id";--> statement-breakpoint
ALTER TABLE "round_scorecard_uploads" RENAME CONSTRAINT "round_scorecard_uploads_uploaded_by_user_id_user_id_fk" TO "round_scorecard_uploads_uploaded_by_player_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "rounds" RENAME COLUMN "user_id" TO "player_id";--> statement-breakpoint
ALTER TABLE "rounds" RENAME CONSTRAINT "rounds_user_id_user_id_fk" TO "rounds_player_id_user_id_fk";--> statement-breakpoint
ALTER INDEX "rounds_tournament_user_unique" RENAME TO "rounds_tournament_player_unique";--> statement-breakpoint
ALTER INDEX "rounds_match_user_unique" RENAME TO "rounds_match_player_unique";--> statement-breakpoint
-- Renaming a base column leaves the view's output column name as it was.
ALTER VIEW "round_summaries" RENAME COLUMN "user_id" TO "player_id";
