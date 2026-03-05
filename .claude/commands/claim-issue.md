Claim a GitHub Issue and load its context as your working brief.

This command is typically called by the agent after presenting the selected issue to the human and receiving approval. The issue number comes from that selection — either specified by the human or chosen via `/pick-issue`.

## Step 1: Get current branch

```bash
git branch --show-current
```

## Step 2: Claim the issue

```bash
# Add in-progress label
gh issue edit <N> --add-label in-progress

# Comment to signal ownership
gh issue comment <N> --body "Claimed on branch \`$(git branch --show-current)\`"
```

## Step 3: Load context

Fetch and display the full issue:
```bash
gh issue view <N> --json number,title,body,labels,comments
```

Check if the issue body references a wiki page (look for `Epics-` or `Features-` links). If so, fetch that page:
```bash
WIKI=/tmp/blurt-wiki-$(git branch --show-current)
[ -d "$WIKI/.git" ] || git clone https://github.com/Jgordon-pencilwrench/blurt.wiki.git "$WIKI"
cd "$WIKI" && git pull --rebase
# then read the relevant page file from $WIKI
```

## Step 4: Check what else is running

```bash
gh issue list --label in-progress --json number,title
```

Show the human what other sessions are currently active.

## Step 5: Confirm

Output a summary:
```
Claimed issue #<N>: <title>
Branch: <branch-name>
In-progress alongside: <list or "nothing else">

Working brief:
<issue body>

<wiki page content if found>
```
