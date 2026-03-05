# Blurt — Project Instructions

## Shared knowledge

`docs/architecture.md` is the shared record of architectural decisions and constraints. Read it before starting work, and run `git log --oneline docs/architecture.md` to see how recently it was updated.

GitHub Issues are the live source of truth for feature status. Because parallel sessions branch from the same `main` and can't see each other's file changes until a PR merges, issues are the only way to see what's actually in flight right now.

## Session lifecycle

*Only follow this when you've been asked to implement a backlog feature. For general tasks, ignore this section.*

**At session start:**
1. Read `docs/architecture.md` in full.
2. Run `gh issue list --label in-progress` to see what other sessions are working on.
3. Find your feature's issue and comment "Starting work on branch `<branch-name>`" then add the `in-progress` label: `gh issue edit <N> --add-label in-progress`.

**During work:**
- When you make an architectural decision, discover a constraint, or hit a mistake worth avoiding: add a dated entry to `docs/architecture.md`, commit it alongside your code, and post a comment on your issue summarising the finding.

**Before creating your PR:**
- Post a comment on your issue with any gotchas or schema changes that would affect dependent sessions.
- Include `Closes #<N>` in the PR description — the issue auto-closes when the PR merges.

## Branch strategy

Always work in a worktree on a feature branch. Finish with a PR (Option 2 in `finishing-a-development-branch`), not a local merge — this serializes integration and keeps `main` clean.
