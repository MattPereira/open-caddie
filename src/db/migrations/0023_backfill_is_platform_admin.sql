-- Expand of #95. Idempotent; the switch re-runs it for rows written mid-rollout.
UPDATE "user" SET "isPlatformAdmin" = "isAdmin" WHERE "isPlatformAdmin" IS DISTINCT FROM "isAdmin";
