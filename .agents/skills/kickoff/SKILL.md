---
name: kickoff
description: Kick off a work session: survey open issues, PRs, recent merges and worktrees, and decide with the human what to work on next. Use when they start a session or ask what to work on, what's next or what to prioritize.
---

# Kickoff

Survey what's going on, print sections for the human to pick from, propose a **plan**, act on the plan they approve, and hand off. GitHub, git and Orca are the sources of truth: rebuild the picture from them every run. Keep no list of your own: the picks leave their trace on GitHub as assignees and labels, and a later run reads them back.

Every issue or PR number you write, in any step, is a Markdown link to it: [#292](https://github.com/<owner>/<repo>/issues/292). Get `<owner>/<repo>` from `gh repo view --json nameWithOwner`; `/issues/<n>` redirects to `/pull/<n>` for PRs.

## 1. Survey

Pull only the fields below for everything. Read full bodies and comments only for the items you print in step 3; reading every body would fill your context before the decision starts. Run these in parallel from the repo:

```bash
gh issue list --state open --limit 200 --json number,title,labels,assignees,blockedBy,blocking --jq '.[] | {number, title, labels: [.labels[].name], assignees: [.assignees[].login], blockedBy: [.blockedBy.nodes[]? | select(.state == "OPEN") | .number], blocking: [.blocking.nodes[]? | select(.state == "OPEN") | .number]}'
gh pr list --state open --json number,title,author,headRefName,isDraft,reviewDecision,mergeable,statusCheckRollup,closingIssuesReferences
gh pr list --state merged --search "merged:>=<7 days ago, YYYY-MM-DD>" --limit 100 --json number,title,mergedAt,closingIssuesReferences
git worktree list --porcelain
orca worktree ps      # per worktree: Orca comment, each agent's last ask and last reply
```

For each worktree other than the main checkout, `git -C <path> status -sb` shows dirty files and unpushed commits.

Done when every open issue, open PR and worktree is in your picture with its state: blocked or startable, checks red or green, review pending or answered, pushed or not.

## 2. Rank

Rank candidates in this order. The human can override it.

1. **In-flight**: finish or unblock what's already started. A PR waiting on the human (agent draft, approval to merge, red checks, unanswered review comment); a merge that unblocks follow-ups; a worktree with unpushed work or no PR; an issue assigned to the human, which an earlier run's Start pick left behind.
2. **Live bugs**: issues labelled `live-bug-report` or `bug`.
3. **Leverage**: issues whose `blocking` list is longest.
4. **Momentum**: issues that continue or were unblocked by what merged in the last 7 days.
5. Everything else.

Leave out issues with an open blocker, and issues labelled `agent:in-progress` or assigned to someone else. Treat pending checks as passing.

## 3. Print the sections and the plan

Read the body and comments of each item before you print it: `gh issue view <n> --json number,title,body,labels,comments`, `gh pr view <n> --comments`.

Print four sections in this order, at most 5 items each, top pick first. Leave out empty sections. Each header carries what a pick does, so the human knows the consequence before replying:

| Section | ID | Holds | Header |
| --- | --- | --- | --- |
| **Review** | R | PRs waiting on the human: agent draft PRs, approvals waiting on a merge, red checks, unanswered review comments | `## Review: you review or merge` |
| **Start** | S | Issues for the human to implement: assigned to them, `ready-for-human`, `needs-a-human`, their own worktrees with no PR | `## Start: assigns you` |
| **Delegate** | D | Unblocked `ready-for-agent` issues | `## Delegate: labels agent:implement, a billed cloud run that opens a draft PR` |
| **Triage** | T | `needs-triage` or unlabelled issues, and open issues that look already done | `## Triage: applies the label or closes` |

Write each item on one line:

```
R1 [#299](…): skill that picks the next work · in-flight, merge when green
T1 [#297](…): cap CI dev server memory → ready-for-agent · unblocked by #295 today
T2 [#272](…): reviewer auto-merges step PRs → close · done by #275
```

The description is about 8 words, in your own words from the body, so the human knows the item without clicking. A Triage item names its proposal: a label from `docs/agents/triage-labels.md`, or `close` with the PR or issue that did the work. The reason is about 4 words, tied to a rank from step 2; when a merge from the last 7 days unblocked the item, the reason names it.

Below the sections, propose the plan: the top 1–2 items of each section, about 5 in all, in the order to work them, Review first.

```
Plan: R1, S1, S2, D1, T1
Reply yes to run it (starts 1 billed run), or edit it: "drop D1, add S3".
```

Ask a follow-up only for an edit you can't act on as given.

Done when the human has approved the plan, as proposed or edited.

## 4. Act on the plan

The approval is the go-ahead. Act on every item in the plan:

- **Review**: no action.
- **Start**: `gh issue edit <n> --add-assignee @me`, unless it's already assigned to them.
- **Delegate**: `gh issue edit <n> --add-label agent:implement`. This starts `.github/workflows/agent-implement.yml`, a billed cloud run, so label only the issues in the plan.
- **Triage**: apply the proposed label and remove `needs-triage`, or `gh issue close <n> --comment "Done by #<m>."`.

Then print the plan in the agreed order:

```markdown
## Next

1. [#299](…): skill that picks the next work (review)
2. [#292](…): local test flakes from shared test DB (start)

## Running on agents

- [#301](…): move seed scripts out of src
```

Triage items appear only if they were also picked to start or delegate.

Done when every item in the plan is acted on and printed.

## 5. Hand off

Offer the next step for the first item under Next: start a worktree for it, or run `grilling` on the issue if its scope is fuzzy.
