ALTER TABLE "scramble_team_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scramble_team_scores" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scramble_teams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scrambles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "scramble_team_members" CASCADE;--> statement-breakpoint
DROP TABLE "scramble_team_scores" CASCADE;--> statement-breakpoint
DROP TABLE "scramble_teams" CASCADE;--> statement-breakpoint
DROP TABLE "scrambles" CASCADE;--> statement-breakpoint
DROP INDEX "course_tees_id_course_unique";