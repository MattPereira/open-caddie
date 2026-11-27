---
name: prioritize
description: Decide with the human what to work on next, from open issues, PRs, recent merges and worktrees. Use when they ask what to work on, what's next, or what to prioritize.
---

# Prioritize

Survey what's going on, propose a shortlist, then decide with the human in conversation. GitHub, git and Orca are the sources of truth: rebuild the picture from them every run and keep no priority list of your own.

## 1. Survey

Pull only the fields below for everything. Read full bodies and comments only for the shortlist in step 3; reading every body would fill your context before the conversation starts. Run these in parallel from the repo:

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

Rank candidates in this order. The human can override it in the conversation.

1. **In-flight**: finish or unblock what's already started. A PR with red checks, an unanswered review comment, or an approval waiting on a merge; a merge that unblocks follow-ups; a worktree with unpushed work or no PR.
2. **Live bugs**: issues labelled `live-bug-report` or `bug`.
3. **Leverage**: issues whose `blocking` list is longest.
4. **Momentum**: issues that continue what merged in the last 7 days.
5. Everything else.

Skip issues with an open blocker, and issues labelled `agent:in-progress` or assigned to someone else.

## 3. Shortlist

Read the body and comments of each candidate before you put it on the list: `gh issue view <n> --json number,title,body,labels,comments`, `gh pr view <n> --comments`.

Report two lists, tersely. Refer to each item by its title with its number in the link.

- **For you**: about 3 items that need the human's judgement (`ready-for-human`, `needs-a-human`, in-flight PRs, untriaged issues), each with a one-line reason tied to the ranking above. Put your top pick first.
- **For an agent**: unblocked `ready-for-agent` issues. Ask once whether to label them `agent:implement`. That label starts `.github/workflows/agent-implement.yml`, a billed cloud run that opens a draft PR, so apply it only to the issues the human says yes to.

Below the lists, one line on what merged recently, so the human sees the momentum.

## 4. Decide

Invoke the `grilling` skill to settle the pick with the human: challenge the top pick, surface trade-offs between candidates, and ask anything the ranking couldn't answer.

When the conversation shows an issue's triage label is wrong or missing, propose the label from `docs/agents/triage-labels.md` and apply it after the human agrees. Triage is a side effect: keep the decision moving.

Done when the human has named what they'll work on next.

## 5. Hand off

1. Assign the pick: `gh issue edit <n> --add-assignee @me`. For a PR, it's already theirs.
2. Offer the next step that fits: start a worktree for it, or run `grilling` on the issue itself if its scope is fuzzy.
