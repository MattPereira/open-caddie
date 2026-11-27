---
name: kickoff
description: Kick off a work session: survey open issues, PRs, recent merges and worktrees, and decide with the human what to work on next. Use when they start a session or ask what to work on, what's next or what to prioritize.
---

# Kickoff

Survey what's going on, sort it into three **lanes**, propose a **plan**, act on the plan the human approves, hand off, then supervise the Local Workers. GitHub, git and Orca are the sources of truth: rebuild the picture from them every run. Keep no list of your own: every pick leaves its trace as an assignee or a label, and a later run reads it back.

Every issue or PR number you write, in any step, is a Markdown link to it: [#292](https://github.com/<owner>/<repo>/issues/292). Get `<owner>/<repo>` from `gh repo view --json nameWithOwner`; `/issues/<n>` redirects to `/pull/<n>` for PRs.

## Lanes

Each lane is named for who does the work.

- **Human Required** (H): the human acts. They review or merge a PR, or start a session they drive in an Orca worktree. Trace: an assignee.
- **Remote Factory** (R): a GitHub Actions run started by a label, on a billed cloud runner. A run never waits for the human: it ends with a draft PR or a labelled issue. The default lane for agent work. Trace: `agent:implement` or `agent:explore`, then `agent:in-progress`.
- **Local Workers** (L): an Orca worker on the human's machine, started and supervised by this session. A worker can `ask` mid-task, so call it a _worker_, the human-in-the-loop counterpart to a factory run. Pick it when the work needs the human's machine (local Postgres, Orca, a prod copy, a machine-only bug) or their input along the way. Trace: `local-worker`, plus the worker's Orca worktree.

**Housekeeping** (K) holds triage calls you can make from the issue body alone: a label, or `close` with the PR or issue that did the work. Triage that needs the code checked goes to Remote Factory as `agent:explore`. Triage that needs the human's judgement (product, policy, a data migration) goes to Human Required.

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

Match every `local-worker` issue to its worker's worktree: the worktree whose name starts with `<n>-` or whose Orca comment names `#<n>`. Its state is the first that holds: **done** when an open PR closes the issue (remove the label; the PR is a Human Required item), **running** when the worktree has a live agent, **gone** otherwise.

Done when every open issue, open PR and worktree is in your picture with its state: blocked or startable, checks red or green, review pending or answered, pushed or not, worker done, running or gone.

## 2. Rank

Rank candidates in this order. The human can override it.

1. **In-flight**: finish or unblock what's already started. A PR waiting on the human (agent draft, a Local Worker's ready PR, approval to merge, red checks, unanswered review comment); a merge that unblocks follow-ups; a worktree with unpushed work or no PR; an issue assigned to the human, which an earlier run's pick left behind; a `local-worker` issue whose worker is gone.
2. **Live bugs**: issues labelled `live-bug-report` or `bug`.
3. **Leverage**: issues whose `blocking` list is longest.
4. **Momentum**: issues that continue or were unblocked by what merged in the last 7 days.
5. Everything else.

Leave out issues with an open blocker, issues labelled `agent:in-progress`, `local-worker` issues whose worker is running, and issues assigned to someone else. Treat pending checks as passing.

## 3. Print the lanes and the plan

Read the body and comments of each item before you print it: `gh issue view <n> --json number,title,body,labels,comments`, `gh pr view <n> --comments`.

Print the three lanes in this order, at most 5 items each, top pick first, then the Housekeeping line. Leave out an empty lane. Each header carries what a pick does, so the human knows the consequence before replying:

| Lane | Holds | Header |
| --- | --- | --- |
| **Human Required** | PRs waiting on the human; issues assigned to them, `ready-for-human` or `needs-a-human`; their own worktrees with no PR; triage that needs their judgement; workers that are gone | `## Human Required: you act; a start assigns you` |
| **Remote Factory** | unblocked `ready-for-agent` issues; triage that needs the code checked | `## Remote Factory: labels agent:implement or agent:explore, a billed cloud run` |
| **Local Workers** | unblocked `ready-for-agent` issues that need the human's machine or input along the way | `## Local Workers: labels local-worker, starts an Orca worker this session supervises` |

Write each item on one line, with its action after the description: `review`, `merge`, `fix`, `start` or `triage` in Human Required, `implement` or `explore` in Remote Factory. A Local Workers item's reason says why it can't run in the cloud.

```
H1 [#299](…): skill that picks the next work · merge, green and approved
H2 [#292](…): local test flakes from shared test DB · start, assigned to you
R1 [#301](…): move seed scripts out of src · implement, follow-up from #296
L1 [#300](…): untangle agent-browser doc by environment · needs local Orca to check
```

The description is about 8 words, in your own words from the body, so the human knows the item without clicking. The reason is about 4 words, tied to a rank from step 2; when a merge from the last 7 days unblocked the item, the reason names it.

Put Housekeeping on one line, each call with its proposal (a label from `docs/agents/triage-labels.md`, or `close`) and reason:

```
Housekeeping: K1 [#215](…) close, done by #294 · K2 [#143](…) → ready-for-human, needs a backfill decision
```

When workers are running, add one line for them. Their mail goes to the session that started them:

```
Local Workers running: [#300](…), [#301](…)
```

Below them, propose the plan: the top 1–2 items of each lane, about 5 in all, in the order to work them, Human Required first, plus every Housekeeping call.

```
Plan: H1, H2, R1, L1, K1, K2
Reply yes to run it (starts 1 billed run and 1 local worker), or edit it: "drop R1, add H3", "move R1 to local", "L1 on codex".
```

Ask a follow-up only for an edit you can't act on as given.

Done when the human has approved the plan, as proposed or edited.

## 4. Act on the plan

The approval is the go-ahead. Act on every item in the plan:

- **Human Required**: a `start` gets `gh issue edit <n> --add-assignee @me`, unless it's already assigned to them. Every other action is theirs.
- **Remote Factory**: `gh issue edit <n> --add-label agent:implement`, or `agent:explore` for triage. Each label starts a billed cloud run, so label only the issues in the plan.
- **Local Workers**: before the first one, load the version-matched guide with `orca skills get orchestration`. Then `gh issue edit <n> --add-label local-worker`, and start the worker from the main checkout:

  ```bash
  orca orchestration worker-start --spec "Use the local-worker skill on <issue_url>." --worktree new-child --name <n>-<slug> --base-branch origin/main --comment "#<n> local-worker" --agent claude --json
  ```

  `--agent codex` when the human asked for it. Keep each receipt's dispatch ID for step 6. The PR gets no `agent:review`: the worker's skill runs `code-review` itself.
- **Housekeeping**: apply the label and remove `needs-triage`, or `gh issue close <n> --comment "Done by #<m>."`.

Then print the plan in the agreed order:

```markdown
## Next

1. [#299](…): skill that picks the next work (merge)
2. [#292](…): local test flakes from shared test DB (start)

## Remote Factory

- [#301](…): move seed scripts out of src

## Local Workers

- [#300](…): untangle agent-browser doc by environment
```

Done when every item in the plan is acted on and printed.

## 5. Hand off

Offer the next step for the first item under Next: start a worktree for it, or run `grilling` on the issue if its scope is fuzzy. The human works on it there, which leaves this session free to supervise.

## 6. Supervise the Local Workers

Skip this step when the plan started no worker. Otherwise this session is the coordinator. Wait for worker mail in the background, so the human can still talk to you:

```bash
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json
```

Each check returns a batch and marks it handled. Handle every message in it, then wait again; a timeout with no mail means wait again too:

- **question**: answer it from the issue, the docs or the code when you can. Otherwise put it to the human word for word, with your recommended answer, and reply with theirs.
- **worker_done**: `gh issue edit <n> --remove-label local-worker`, then `orca orchestration worker-release --dispatch <dispatchId>` unless the human is watching its chat. Tell the human its outcome and PR link.
- **escalation**: follow the orchestration guide's recovery for its stop reason, and tell the human.

Done when every worker you started has sent `worker_done` or been stopped, and you have reported each one: outcome, PR, open blockers. A worker that outlives this session gets picked up by the next kickoff through its label.
