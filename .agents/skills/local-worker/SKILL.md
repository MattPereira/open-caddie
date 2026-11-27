---
name: local-worker
description: Build one GitHub issue end to end as a Local Worker, from the issue to a ready PR. Use when a dispatch spec says to use the local-worker skill on an issue.
---

# Local Worker

You are a Local Worker: an Orca worker that kickoff started on one issue, in your own worktree on the human's machine. Your coordinator is the kickoff session; your preamble says how to reach it. The deliverable is a ready PR that closes the issue, with every check green.

When the issue leaves a decision open, `ask` your coordinator and wait for the answer rather than picking one yourself. The coordinator answers or asks the human.

## 1. Read the issue

`gh issue view <n> --json number,title,body,comments`, and state its title. Check that you're in your own worktree, on a branch made for this issue from `origin/main`, never the main checkout: `git status -sb`.

Done when you can say what "done" means for this issue in its own words, usually its "Done when" section.

## 2. Build it

Build test-first: call the Skill tool with `mattpocock-skills:tdd` at the seams the issue names. Run `pnpm typecheck` and the single test file you're changing as you go.

When you need the app running, follow the `local-dev` skill: `pnpm dev:agent` gives this worktree its own server. Stop it with `pnpm dev:agent stop` when you're done checking.

Done when the issue's "Done when" holds.

## 3. Verify and review

Run the verification checks in AGENTS.md, in order. Then call the Skill tool with `code-review` on your branch against `origin/main`, fix everything it raises, and run the checks again.

Done when every check passes on the final commit and the review has nothing left open.

## 4. Open the PR

Commit, push the branch, and open a ready PR (not a draft): write the body with the `pr` skill, and mark it as closing the issue (`Closes #<n>`). Then wait for CI with `gh pr checks <pr> --watch`, and fix what goes red.

Done when the PR is open, ready, and CI is green.

## 5. Report

Send `worker_done` exactly as your preamble says: `--outcome succeeded` with the PR link in `--body`. If you stopped short, send `--outcome failed` with what's done and what's left. Leave the `local-worker` label to your coordinator.
