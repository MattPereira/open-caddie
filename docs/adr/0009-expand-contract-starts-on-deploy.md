---
status: accepted
date: 2026-11-25
---

# Expand/contract steps start on deploy; no merge gate

Each expand/contract step must ship in its own production deploy, after the previous step's deploy succeeded. We enforce that at the start, not the merge: `expand-contract.yml` starts a step only once every blocker's merged PR is in the production commit's history, so its PR can't exist earlier. This replaces #264's design, which started a step as soon as its blocker merged and held its PR with a required `Previous step deployed` status. That gate needed a run on every PR (`pull_request_target`) and reacted to `deployment_status`, which can't be narrowed to Production, so every PR's checks carried two expand/contract runs, and auto-merging steps needed a third workflow to keep their branches up to date.

## Considered Options

- **Start on merge, gate the merge** (#264). Overlaps the next step's implementation with the previous step's deploy, and hard-blocks an early merge whoever makes it. Rejected for the noise and the three workflows above, to save a few minutes per step.
- **`deployment_status` as the start trigger.** Reacts to every deploy, including dashboard redeploys. Rejected: every preview deploy adds a skipped run to its PR's checks. The start runs on push to main and polls for that commit's Production deploy instead.
- **GitHub auto-merge for a clean step.** Never updates a branch, and `protect main` requires branches up to date; merge queue is unavailable on a user-owned repo. The review job merges directly instead: update from main, wait for the required checks, merge, up to 3 attempts in 30 minutes.

## Consequences

- No required check guards the order. A human who starts or merges a step early is caught only by a backstop in CI's `Merge gate` job, which runs the PR's own copy of the check and doesn't re-run on deploy.
- Deploys not triggered by a push (a dashboard redeploy), or slower than 30 minutes, start nothing until the next push to main or a dispatch of `expand-contract.yml`.
- A Vercel instant rollback records no GitHub deployment: after rolling a step back, hold the next step by hand.
- The merge must be by FACTORY_PAT: a push to main by GITHUB_TOKEN starts no workflow, so the next step would never start.
