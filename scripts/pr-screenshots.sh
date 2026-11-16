#!/usr/bin/env bash
# Upload screenshots to the orphan `pr-screenshots` branch and print markdown
# image lines for a PR body. See docs/agents/agent-browser.md.
#
# Usage: scripts/pr-screenshots.sh screenshots/home-light.png [...]
set -euo pipefail

BRANCH="pr-screenshots"

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <file>..." >&2
  exit 1
fi

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
folder=$(git branch --show-current)
: "${folder:?Not on a branch}"

ensure_branch() {
  if gh api "repos/$repo/git/ref/heads/$BRANCH" >/dev/null 2>&1; then
    return
  fi
  echo "Creating orphan branch $BRANCH" >&2
  local tree commit
  tree=$(gh api "repos/$repo/git/trees" \
    -f 'tree[][path]=README.md' -f 'tree[][mode]=100644' -f 'tree[][type]=blob' \
    -f 'tree[][content]=Screenshots embedded in PR bodies. Never merge this branch.' \
    --jq .sha)
  # An empty parents array makes this a root commit, so the branch shares no history with main.
  commit=$(jq -n --arg tree "$tree" '{message: "Start pr-screenshots", tree: $tree, parents: []}' |
    gh api "repos/$repo/git/commits" --input - --jq .sha)
  gh api "repos/$repo/git/refs" -f "ref=refs/heads/$BRANCH" -f "sha=$commit" >/dev/null
}

upload() {
  local file=$1 path existing_sha commit_sha
  path="$folder/$(basename "$file")"
  existing_sha=$(gh api "repos/$repo/contents/$path?ref=$BRANCH" --jq .sha 2>/dev/null || true)

  # Content goes through stdin; a base64 image is too long for a command-line argument.
  commit_sha=$(base64 -w0 "$file" |
    jq -Rn --arg msg "Add $path" --arg branch "$BRANCH" --arg sha "$existing_sha" \
      '{message: $msg, branch: $branch, content: input} + (if $sha == "" then {} else {sha: $sha} end)' |
    gh api -X PUT "repos/$repo/contents/$path" --input - --jq .commit.sha)

  # Pinned to the commit, so a later re-upload cannot change what a reviewer saw.
  printf '![%s](https://raw.githubusercontent.com/%s/%s/%s)\n' \
    "$(basename "${file%.*}")" "$repo" "$commit_sha" "$path"
}

ensure_branch
for file in "$@"; do
  [[ -f "$file" ]] || { echo "Not a file: $file" >&2; exit 1; }
  upload "$file"
done
