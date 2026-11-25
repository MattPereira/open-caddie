-- deploy-safe: contract of #95, switch deployed
-- squawk-ignore ban-drop-column
ALTER TABLE "user" DROP COLUMN IF EXISTS "isAdmin";
