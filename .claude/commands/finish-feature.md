Finish the current feature branch: create the PR, close the issue, and do a final wiki update.

The human will provide the issue number. If not provided, ask for it.

This command wraps `superpowers:finishing-a-development-branch` with project-specific requirements. Follow the steps below exactly.

## Step 1: Verify tests pass

Run the project test suite:
```bash
npm test
```

If tests fail, stop. Report failures. Do not proceed until they pass.

## Step 2: Final wiki update

Run `/update-wiki <N>` with status: `pr-open` and a summary of what was built.

## Step 3: Push and create PR

```bash
git push -u origin $(git branch --show-current)
```

Create the PR. The body MUST include `Closes #<N>` so the issue auto-closes on merge:

```bash
gh pr create \
  --title "<concise title matching the issue>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>

## Test plan
- [ ] <verification step>

Closes #<N>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Do not use Option 1 (local merge) from `finishing-a-development-branch` on this project. PRs only.**

## Step 4: Post closing comment on the issue

```bash
gh issue comment <N> --body "PR opened: <PR URL>. Closes on merge."
```

## Step 5: Clean up worktree

```bash
# Get current worktree path
worktree_path=$(git worktree list | grep $(git branch --show-current) | awk '{print $1}')

# Switch to main repo first
cd /Users/johngordon/work/blurt

# Remove the worktree
git worktree remove "$worktree_path"
```

## Step 6: Report

Output:
```
PR created: <URL>
Issue #<N> will auto-close when PR merges.
Worktree removed.
Branch <name> still exists on remote — delete after merge or let GitHub do it.
```
