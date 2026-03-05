Update the wiki page for the feature you are working on. Use this when you make an architectural decision, hit a notable constraint, or at session end.

The human will provide the issue number. If not provided, ask for it.

## Step 1: Derive the wiki page name

Fetch the issue title:
```bash
gh issue view <N> --json title -q .title
```

Convert to a slug: lowercase, replace spaces and special chars with hyphens, prefix with `Features-`.
Example: "B1 · Whisper quality flags + hallucination stripper" → `Features-B1-Whisper-Quality`

## Step 2: Prepare the update entry

Use this exact template. Keep each field to one line or a tight bullet list. Be terse — future sessions need to scan this quickly.

```markdown
## Session update — YYYY-MM-DD
**Branch:** <branch-name>
**Decisions made:**
- <one line per decision>
**Gotchas:**
- <one line per gotcha, or "none">
**Files changed:**
- `path/to/file.ts`
**For dependent sessions:**
- <anything the next session needs to know, or "none">
```

## Step 3: Write to wiki

Access the wiki (isolated per branch, clone once then reuse):
```bash
WIKI=/tmp/blurt-wiki-$(git branch --show-current)
[ -d "$WIKI/.git" ] || git clone https://github.com/Jgordon-pencilwrench/blurt.wiki.git "$WIKI"
cd "$WIKI" && git pull --rebase
```

Check if `Features-<slug>.md` exists. If not, create it with a header:
```markdown
# Feature: <issue title>
Issue: #<N>

---
```

Append the new session update entry to the bottom of the file.

```bash
cd "$WIKI" && git add -A && git commit -m "docs(wiki): update Features-<slug> — session notes for #<N>" && git push
```

## Step 4: Also post a comment on the issue

For decisions or significant findings, post the same summary as a comment on the GitHub Issue:
```bash
gh issue comment <N> --body "<brief summary of decision or finding>"
```

This ensures other parallel sessions see it immediately without needing to check the wiki.
