-- Switch of #95. Re-runs 0023 for rows pre-expand code wrote during expand's rollout.
UPDATE "user" SET "isPlatformAdmin" = "isAdmin" WHERE "isPlatformAdmin" IS DISTINCT FROM "isAdmin";
