ALTER TABLE "course_scorecard_imports" ADD COLUMN "staged_image_deletion_handles" jsonb DEFAULT '[]'::jsonb NOT NULL;
