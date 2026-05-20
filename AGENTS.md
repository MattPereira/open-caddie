# Repository Guidelines

## Instructions

### Security Rules

- Do not commit secrets.
- Keep environment-specific values in local `.env` files or deployment settings.

### Next.js Rules

- Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

### Coding Conventions

- Write TypeScript and React with strict types enabled.
- Prefer writing concise code with fewer lines when possible while also preserving readability.
- Prefer named exports for shared helpers and colocate route-specific components under the route’s `_components/` directory.
- Prioritize building shared re-usable components as much as possible.
- Use `kebab-case` filenames for components and route helpers, and keep schema/action files named by purpose, such as `schema.ts` and `actions.ts`.
- Use shadcn components and tailwind to build and style all UI components.
- Prioritize mobile first designs without compromising the quality of tablet and desktop experiences.
- Use Hugeicons for icons.
- Use React Hook Form for forms
- Use Zod schemas for validation.

## Project Architecture

- Open Caddie is a Next.js App Router application.
- Route groups, pages, layouts, Server Actions, and route handlers live in `app/`, including the authenticated app under `app/(app)/` and auth under `app/api/auth/[...nextauth]/`
- Shared React components are in `components/`, with shadcn primitives in `components/ui/`
- Database schema and access code live in `db/`, with the canonical schema in `db/schema.ts` and query helpers in `db/queries/`
- Shared hooks, utilities, and types live in `hooks/`, `lib/`, and `types/`
- Static assets are in `public/` directory

## Database Schema Notes

- Clubs enable grouping of users and tournaments
- Season numbers on tournaments enable grouping tournaments within a club
- Tournaments enable grouping rounds
- Rounds have the option to be created with or without a tournament and carry their own course/date context

### Database Migration Rules

- Drizzle migrations are the source of truth for schema changes.
- For schema changes, update `db/schema.ts`, run `pnpm run db:generate`, inspect the generated SQL in `drizzle/`, then run `pnpm run db:migrate` only after confirming the SQL is intentional.
- Commit `db/schema.ts` changes and generated `drizzle/` migration files together.
- Do not use `drizzle-kit push` or add `db:push` scripts for normal schema changes; it bypasses migration history. If a direct push is ever used for an emergency or disposable prototype, call it out explicitly.
- The current migration history was baselined from an existing Neon database. Existing databases matching `drizzle/0000_magenta_argent.sql` need the matching row in `drizzle.__drizzle_migrations`; new empty databases can run migrations from scratch.

## CLI Commands

- `pnpm run dev`: start the local Next development server.
- `pnpm run build`: build the production app.
- `pnpm run start`: run the production build.
- `pnpm run lint`: run ESLint with Next core-web-vitals and TypeScript rules.
- `pnpm run typecheck`: generate Next types, then run `tsc --noEmit`.
- `pnpm run check`: run linting and typechecking together.
- `pnpm run db:generate`, `pnpm run db:migrate`, `pnpm run db:studio`: manage Drizzle migrations and inspect the database.

## Git Guidelines

- Keep commit messages concise and to the point.
