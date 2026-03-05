# Blurt — Project Instructions

## Where things live

| What | Where |
|------|-------|
| Features, status, requirements | GitHub Issues |
| Architectural decisions, session findings | GitHub Wiki |
| Plan files (temporary, session-local) | `docs/plans/` — gitignored, never committed |
| Code | This repo |

For the full workflow guide (idea → issues → implementation → PR), see the [GitHub Wiki](https://github.com/Jgordon-pencilwrench/blurt/wiki).

## When implementing a feature (human-initiated only)

These steps apply when the human asks you to implement a feature or pick up an issue. Do not initiate this automatically.

1. **Read** the [Architecture/Decisions](https://github.com/Jgordon-pencilwrench/blurt/wiki/Architecture-Decisions) wiki page before touching any code.
2. **Claim your issue** — the human will give you an issue number, or ask you to pick from an epic. Run `/claim-issue N` to claim it, read its context, and check what else is `in-progress`.
3. **Implement** using the superpowers workflow (brainstorm → plan → subagent-driven-development).
4. **Document findings** as you go — run `/update-wiki N` when you make an architectural decision or hit a notable constraint.
5. **Finish** by running `/finish-feature N` — this creates the PR with `Closes #N` and does a final wiki update.

## Branch strategy

Always work in a worktree on a feature branch. Finish with a PR — no local merges. The issue auto-closes when the PR merges.

## Plan files

`writing-plans` should write plan files to `docs/plans/`. They are gitignored and only live for the duration of the session. The GH issue body is the source of business requirements; the plan file is the technical how-to.
