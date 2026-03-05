# Blurt — Project Instructions

## Shared knowledge

`docs/architecture.md` is the shared record of architectural decisions and constraints across all sessions. Read it before starting work. When you make an architectural decision, discover a constraint, or encounter a mistake worth avoiding, add a dated entry there and commit it on your branch so it lands in `main` when your PR merges.

`docs/feature-backlog.md` is the master plan. Sessions are organized by group — check the parallelism section at the bottom to understand which groups are safe to run simultaneously and which have dependencies.

## Branch strategy

Always work in a worktree on a feature branch. Finish with a PR (Option 2 in `finishing-a-development-branch`), not a local merge — this serializes integration and keeps `main` clean.
