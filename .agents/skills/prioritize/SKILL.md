---
name: prioritize
description: Decide with the human what to work on next, from open issues, PRs, recent merges and worktrees, and record it as the day's agenda. Use when they ask what to work on, what's next, what to prioritize, or how the agenda is going.
---

# Prioritize

Survey what's going on, print sections for the human to pick from, act on their picks, and record them as an **agenda**: a GitHub issue labelled `agenda` that lists the work in the order agreed. GitHub, git and Orca are the sources of truth: rebuild the picture from them every run. The agenda issue is the only list you keep, and it lives on GitHub.

Every issue or PR number you write, in any step, is a Markdown link to it: [#292](https://github.com/<owner>/<repo>/issues/292). Get `<owner>/<repo>` from `gh repo view --json nameWithOwner`; `/issues/<n>` redirects to `/pull/<n>` for PRs.

## 1. Check the agenda

```bash
gh issue list --label agenda --state open --json number,title,body,createdAt
```

If none is open, go to step 2.

If one is open, read the state of every issue and PR it links and report its progress in three groups: done (closed or merged), in-flight (a PR, worktree or `agent:in-progress`), untouched. The human edits the agenda by hand between runs, so the linked states are the truth and the checkboxes may lag. Then offer:

- **(a) Continue**: run steps 2–3 for new urgent items only (red checks, an answered review, a new bug) and append the ones the human picks. Recommend this when the agenda is from today.
- **(b) Fresh agenda**: close the open one, carry its unfinished items into the new one, and run every step.

Done when the human has picked (a) or (b).

## 2. Survey

Pull only the fields below for everything. Read full bodies and comments only for the items you print in step 4; reading every body would fill your context before the decision starts. Run these in parallel from the repo:

```bash
gh issue list --state open --limit 200 --search "-label:agenda" --json number,title,labels,assignees,blockedBy,blocking --jq '.[] | {number, title, labels: [.labels[].name], assignees: [.assignees[].login], blockedBy: [.blockedBy.nodes[]? | select(.state == "OPEN") | .number], blocking: [.blocking.nodes[]? | select(.state == "OPEN") | .number]}'
gh pr list --state open --json number,title,author,headRefName,isDraft,reviewDecision,mergeable,statusCheckRollup,closingIssuesReferences
gh pr list --state merged --search "merged:>=<7 days ago, YYYY-MM-DD>" --limit 100 --json number,title,mergedAt,closingIssuesReferences
git worktree list --porcelain
orca worktree ps      # per worktree: Orca comment, each agent's last ask and last reply
```

For each worktree other than the main checkout, `git -C <path> status -sb` shows dirty files and unpushed commits.

Done when every open issue, open PR and worktree is in your picture with its state: blocked or startable, checks red or green, review pending or answered, pushed or not.

## 3. Rank

Rank candidates in this order. The human can override it.

1. **In-flight**: finish or unblock what's already started. A PR with red checks, an unanswered review comment, or an approval waiting on a merge; a merge that unblocks follow-ups; a worktree with unpushed work or no PR.
2. **Live bugs**: issues labelled `live-bug-report` or `bug`.
3. **Leverage**: issues whose `blocking` list is longest.
4. **Momentum**: issues that continue what merged in the last 7 days.
5. Everything else.

Leave out issues with an open blocker, and issues labelled `agent:in-progress` or assigned to someone else.

## 4. Print the sections

Read the body and comments of each item before you print it: `gh issue view <n> --json number,title,body,labels,comments`, `gh pr view <n> --comments`.

Print four sections in this order, at most 3 items each, top pick first. End a section with "+N more" when candidates are left over, and show them if the human asks. Leave out empty sections.

| Section | ID | Holds |
| --- | --- | --- |
| **Review** | R | PRs waiting on the human: agent draft PRs, approvals waiting on a merge, red checks, unanswered review comments |
| **Start** | S | Issues for the human to implement: `ready-for-human`, `needs-a-human`, their own worktrees with no PR |
| **Delegate** | D | Unblocked `ready-for-agent` issues to label `agent:implement` |
| **Triage** | T | `needs-triage` or unlabelled issues, each with the label you propose from `docs/agents/triage-labels.md` |

Write each item on one line:

```
R1 [#299](…): skill that picks the next work · in-flight, checks pending
```

The description is about 8 words, in your own words from the body, so the human knows the item without clicking. The reason is about 4 words, tied to a rank from step 3.

Below the sections, one line on what merged in the last 7 days, so the human sees the momentum.

End by asking for picks on one line, e.g. `R1, S1, D1 D3, T1`. Ask a follow-up only for a pick you can't act on as given.

Done when the human has replied with picks.

## 5. Act on the picks

The reply is the approval. Act on every pick:

- **Start**: `gh issue edit <n> --add-assignee @me`.
- **Delegate**: `gh issue edit <n> --add-label agent:implement`. This starts `.github/workflows/agent-implement.yml`, a billed cloud run that opens a draft PR, so label only the issues picked.
- **Triage**: apply the proposed label and remove `needs-triage`.
- **Review**: no action; it goes on the agenda.

Then write the agenda. Create the label first if `gh label list --search agenda` finds none: `gh label create agenda --description "The human's agreed work order"`. For a fresh agenda, open an issue titled `Agenda YYYY-MM-DD`, labelled `agenda` and assigned to `@me`. For (a) Continue, append to the open one with `gh issue edit`.

```markdown
## Next

1. [ ] [#299](…): skill that picks the next work (review)
2. [ ] [#292](…): local test flakes from shared test DB (start)

## Running on agents

- [ ] [#301](…): move seed scripts out of src
```

Number the human's items in the agreed order, Review picks first. Triage picks appear only if they were also picked to start or delegate.

Done when every pick is acted on and the agenda issue lists them all. Report the agenda's link.

## 6. Hand off

Offer the next step for the first agenda item: start a worktree for it, or run `grilling` on the issue if its scope is fuzzy.
