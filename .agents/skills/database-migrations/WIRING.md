# Migration wiring

- The build passes `DATABASE_URL_UNPOOLED` in as `DATABASE_URL`, because drizzle-kit can fail over the pooler. Keep it out of `drizzle.config.ts` as a fallback: that file loads `.env.local`, whose unpooled URL would win and migrate the wrong database.
- Only env var scoping protects prod. Prod's URLs are set by hand and scoped to Production; nothing else stops a preview build migrating prod.
- Neon's Vercel integration injects each preview's URLs. Without them, the preview build fails.
- Nothing locks against concurrent migrations: two production builds close together fail loudly on the second.
