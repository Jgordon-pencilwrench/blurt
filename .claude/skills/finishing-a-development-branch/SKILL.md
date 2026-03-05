---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch (Blurt project override)

This skill extends the superpowers `finishing-a-development-branch` skill with Blurt-specific requirements.

## Project rule: PRs only

**Option 1 (merge locally) is disabled for this project.** Always use Option 2 (Push and create PR).

Reason: multiple parallel sessions merge to `main` — PRs serialize integration and prevent conflicts.

## Use /finish-feature instead

On this project, use the `/finish-feature N` command rather than invoking this skill directly. It handles all the steps including:
- Final wiki update
- `Closes #N` in the PR description (required — issue must auto-close on merge)
- Worktree cleanup
- Closing comment on the issue

## If invoked directly (not via /finish-feature)

Follow the standard `superpowers:finishing-a-development-branch` skill but:
1. Skip Option 1 entirely — present only Options 2, 3, 4
2. When creating the PR, ensure the body contains `Closes #<issue-number>`
3. After PR is created, run `/update-wiki <N>` with status: pr-open
4. Post a comment on the issue: "PR opened: <URL>. Closes on merge."

## Everything else

All other behaviour (test verification, PR body format, worktree cleanup for Options 2 and 4) follows the standard superpowers skill exactly.
