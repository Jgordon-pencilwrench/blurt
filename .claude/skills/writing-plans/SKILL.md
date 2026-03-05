---
name: writing-plans
description: Use when you have an approved design and need to break it into implementable tasks
---

# Writing Plans (Blurt project override)

This skill extends the superpowers `writing-plans` skill with Blurt-specific requirements.

## Plan file location

Write plan files to `docs/plans/`. This directory is gitignored — plan files are session-local and never committed.

```bash
mkdir -p docs/plans
# write plan to docs/plans/<feature-name>-plan.md
```

## Source of requirements

The GitHub Issue body is the source of business requirements (what to build and why). The plan file you produce is the technical how-to (how to build it). Do not duplicate business requirements in the plan — reference the issue number instead.

Start the plan file with:
```markdown
# Plan: <feature title>
Issue: #<N>
See issue for requirements and acceptance criteria.

---
```

## Everything else

All other behaviour (task granularity, file paths, code examples, verification steps, TDD emphasis) follows the standard superpowers `writing-plans` skill exactly.
