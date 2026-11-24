# Migration wiring

- The build passes `DATABASE_URL_UNPOOLED` in as `DATABASE_URL`, because drizzle-kit can fail over the pooler. Keep it out of `drizzle.config.ts` as a fallback: that file also loads `.env.local`, where `vercel env pull` writes a Neon unpooled URL that would win over the local database and migrate Neon.
- Only env var scoping protects prod. Prod's URLs are set by hand and scoped to Production; nothing else stops a preview build migrating prod.
- Neon's Vercel integration injects each preview's URLs. Without them, the preview build fails.
- Nothing locks against concurrent migrations: two production builds close together fail loudly on the second.
