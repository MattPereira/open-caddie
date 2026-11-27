---
name: where-was-i
description: Resume or park in-flight work across PRs, issues, and worktrees. Use when picking up where the human left off, or when they're leaving mid-work.
---

# Where was I

In-flight work lives in three places: GitHub (PRs, issues, blocking edges), git (worktrees, branches), and Orca (one comment per worktree). Those are the sources of truth. You rebuild the state from them every time and never keep a separate copy.

Two branches:

- **Resume**: the human is back and wants to know what's in flight. Go to [Resume](#resume).
- **Park**: the human is leaving mid-work. Go to [Park](#park).

## Resume

### 1. Gather

Run these in parallel from the repo's main checkout:

```bash
gh pr list --author @me --json number,title,url,headRefName,isDraft,reviewDecision,mergeable,closingIssuesReferences,statusCheckRollup
gh issue list --assignee @me --state open --json number,title,url,labels
git worktree list --porcelain
orca worktree ps      # per worktree: Orca comment, each agent's last ask and last reply
```

Then, for each worktree:

```bash
git -C <path> status -sb             # dirty files; ahead/behind its upstream ("no upstream" = never pushed)
git -C <path> log --oneline origin/main..HEAD
```

For each issue an open PR closes, find the follow-ups that wait on it. These are the open issues it blocks:

```bash
gh issue view <closed-issue> --json blocking --jq '.blocking.nodes[] | select(.state == "OPEN")'
```

Also catch blocking that someone only wrote as text. Search open issues whose body mentions each PR or closed issue: `gh issue list --state open --search "<n> in:body"`.

### 2. Group into threads

A **thread** is one effort: its PRs, the issues they close, the follow-ups those block, and the worktrees where the work happens. Join on the PR's branch matching the worktree's branch, on `closingIssuesReferences`, and on the blocking edges.

Each thread's state comes from its facts:

- PR: checks, review decision, mergeable, and whether there's a comment you haven't answered (`gh pr view <n> --comments`)
- Follow-up: blocked, or ready to start
- Worktree: dirty, unpushed, or no PR yet
- Intent: the Orca comment and the agents' last ask and reply. This is what the human had in mind and couldn't write anywhere else.

Work that belongs to no thread is **stray**: a worktree with unpushed commits or no PR, a dirty worktree, an assigned issue with nothing in flight. Stray work is the work most likely to be forgotten.

Done when every open PR, every worktree except the main checkout, and every assigned issue sits in exactly one thread or in the stray list.

### 3. Report

Be terse. Refer to each PR or issue by its title, with its number inside the link. Order:

1. **Threads**: for each, one line per item with its state.
2. **Stray**: each item and what to decide about it: push and open a PR, finish it, or delete the worktree.
3. **Next actions**: a numbered list in dependency order. A merge that unblocks a follow-up comes before the follow-up.

### 4. Offer fixes

List the fixes you found and ask before making any of them. Each one is a write to GitHub or git:

- Turn a text-only "blocked by" into a native edge: `gh issue edit <follow-up> --add-blocked-by <blocker>`.
- Link a worktree to its PR or issue: `orca worktree set --worktree path:<path> --pr <n>` or `--issue <n>`.

## Park

The human is about to leave. Capture what only exists in their head. GitHub and git already hold the rest.

1. Pick the worktrees with in-flight work: dirty, unpushed, or with an open PR that has a pending next step.
2. For each, set a one-line Orca comment that starts with `next:` and names the next concrete action:

   ```bash
   orca worktree set --worktree path:<path> --comment "next: answer review on #295, then start #297"
   ```

   Draft each line from what this session knows. The human corrects the drafts in one reply before you write them. Overwrite the old comment. It only holds what's next.

3. Report any unpushed commits and ask whether to push them. Work that's only on this machine is lost if the machine is.

Done when every in-flight worktree has a `next:` comment the human has approved.
