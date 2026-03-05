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

These steps apply when the human asks you to implement a feature. Do not initiate this automatically.

1. **Select the issue** — the human will give you an issue number, or ask you to pick from an epic. If picking, run `/pick-issue` to find the next unblocked, unclaimed issue. Present your selection with a brief summary of what it involves and ask the human to confirm before proceeding.
2. **Claim it** — once the human approves, run `/claim-issue N`. This loads the issue body and any linked wiki pages (epics, prior session notes).
3. **Implement** using the superpowers workflow (brainstorm → plan → subagent-driven-development).
4. **Document findings** as you go — run `/update-wiki N` when you make an architectural decision or hit a notable constraint. Also post a comment on the issue for immediate visibility to other sessions.
5. **Finish** when the human asks — run `/finish-feature N`. It handles tests, wiki update, PR creation, and issue comment.

## Wiki reference

The [GitHub Wiki](https://github.com/Jgordon-pencilwrench/blurt/wiki) contains:
- **Architecture Decisions** — constraints and design choices (sub-pages per topic). Fetch the relevant sub-page if your work touches that area.
- **Epics-\*** — epic overview pages, linked from epic issue bodies
- **Features-\*** — session notes from prior work on a feature, linked from issue bodies

Load wiki pages on demand when relevant — don't load them upfront.

## Branch strategy

Always work in a worktree on a feature branch. Finish with a PR — no local merges. The issue auto-closes when the PR merges.

## Plan files

`writing-plans` should write plan files to `docs/plans/`. They are gitignored and only live for the duration of the session. The GH issue body is the source of business requirements; the plan file is the technical how-to.
