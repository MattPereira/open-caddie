# Expand/contract

Three PRs, each its own production deploy, each safe to roll back to the one before:

1. **Expand.** Additive migration: add the new column with a default (or nullable), then backfill it from the old one in an idempotent custom migration (`UPDATE ... SET new = old WHERE new IS DISTINCT FROM old`). `schema.ts` holds both. The code writes both and reads the old one.
2. **Switch.** Re-run the backfill as a new custom migration first: it catches rows the pre-expand code wrote during expand's rollout. Reads move to the new column, and the TypeScript rename of keys and callers lands here. The old column leaves `schema.ts` and the code as the drop row of [Breaking statements](SKILL.md#breaking-statements) says.
3. **Contract.** That row's drop, under its `deploy-safe` reason and `squawk-ignore ban-drop-column`. Remaining transition code (claim fallbacks) goes too.

Each step's live-code check ([Implementing a change](SKILL.md#implementing-a-change), step 4) runs against the previous step's code.

## Rules

- **Rolling back from switch to expand reads the old column, which switch stopped writing.** Fine for a column written rarely. For one written often, split switch in two: reads move while writes still go to both, then the next PR stops writing the old column and removes it from `schema.ts`.
- **Session claims are schema too.** A signed-in user's JWT holds the claims written at sign-in, for the session's lifetime. Expand writes both claim names at sign-in. Switch backfills in the `jwt` callback on every call (`token.new ??= token.old`) and reads the new one. Contract removes the old claim and the backfill; a token idle since before switch loses the claim until its user signs in again.
