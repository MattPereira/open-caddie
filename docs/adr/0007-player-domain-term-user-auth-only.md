---
status: accepted
date: 2026-11-09
---

# Player is the domain term; User is reserved for sign-in

Every person in Open Caddie is a Player, including people who have never signed in. "User" refers only to a Player's sign-in identity: the Auth.js `user`, `account`, `session` and verification-token tables, plus session and magic-link code. Golf tables reference the person through `player_id`-style columns that point at the Auth.js `user` table's id. The person lives in that table because Auth.js requires it, not because the domain calls them a User.

## Considered Options

Renaming the Auth.js `user` table, and its `userId` references in `account` and `session`, to `player` was rejected because it requires custom adapter table mappings that fight Auth.js conventions, for no domain benefit. Using User everywhere was rejected: Player Index, Playing Handicap and the Players UI already say Player, so code and screens would disagree permanently, and Players who never sign in would be "Users" who never use the app. A separate User concept for non-playing people (organizers, spectators) is not planned. If one ever appears, it gets its own term rather than widening User.

## Consequences

- A golf table holding a `player_id` that references `"user".id` is deliberate.
- Admin is a trait of the Player even though it is stored on the Auth.js `user` row.
- Code resolves the session to a Player at the boundary (`getCurrentPlayer`). Code past that boundary says Player.

## Lint guard

`local/player-domain-term` (`eslint-rules/player-domain-term.mjs`) fails on any declared identifier or JSX prop with a "user" word in its name. Accessing a third-party property (`session.user`, `process.env.DATABASE_USER`) is not flagged; only declaring one is. Allowed:

- Sign-in files, exempted in `eslint.config.mjs`: `auth.ts`, `auth.types.d.ts`, `lib/auth/**`, `app/(app)/login/**`, `app/api/auth/**`.
- The Auth.js tables in `db/schema.ts`: `users`, and the `account` and `session` tables' `userId` columns, inside a disable block.
- `users`, the Drizzle export of the Auth.js `user` table, used by domain queries.
- `username`, the Player's handle. It's one word, so it never matches.
- Third-party icon components (`User*Icon`).
- The profile image Blob `users/` prefix. It's a string, so it never matches.
- The LLM "user" message role (`*UserPrompt`, `USER_PROMPT`).
- `userAgent` (robots.txt).
- Inline disables for third-party shapes that have to be declared: Auth.js `unstable_update({ user })` in onboarding, and the Postgres role `user` in `db/index.ts`.

The rule lives in a file imported by `eslint.config.mjs`, so ESLint's cache doesn't see edits to it. Delete `.eslintcache` after changing the rule.
