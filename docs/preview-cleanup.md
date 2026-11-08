# Neon preview cleanup

The `Cleanup Neon preview branch` workflow uses Neon's recommended
`neondatabase/delete-branch-action@v3` on PR close, including merges. It deletes
`preview/<git-branch>` directly. Fork PRs are skipped.

## Setup

In GitHub, open **Settings → Secrets and variables → Actions**:

1. Under **Secrets**, add repository secret `NEON_API_KEY`. Create the key in
   Neon **Account settings → API keys**, with access to this project.
2. Under **Variables**, add repository variable `NEON_PROJECT_ID` with value
   `silent-firefly-34138233` (the project ID from the Neon console URL).
3. Merge `.github/workflows/cleanup-previews.yml` into `main`.

`VERCEL_TOKEN` is no longer needed for this workflow. Remove it if nothing else
uses it; revoke the Vercel token too if it was created only for cleanup.

After the next PR closes or merges, check **Actions → Cleanup Neon preview
branch** and confirm the branch disappears in Neon. Vercel deployments remain,
but their database connection stops working after branch deletion.

Keep the Neon–Vercel integration connected so new previews get database branches.

Reference: [Neon's recommended PR-close workflow](https://neon.com/docs/guides/vercel-branch-cleanup#github-action-on-pr-close-recommended).
