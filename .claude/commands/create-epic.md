Read the product-owner breakdown from this conversation (or ask the human to paste it if not visible).

Then execute the following steps. Do not ask for confirmation — proceed through all steps.

## Step 1: Determine type

Check if the breakdown says TYPE: Simple or TYPE: Epic.

## Step 2: Create issue(s)

**If Simple:** Create a single GitHub Issue:
```bash
gh issue create \
  --title "<TITLE>" \
  --label "<appropriate group label>,priority-<high|medium|low>" \
  --body "<formatted body with Overview, Acceptance Criteria, Files Likely Touched, Parallelism, Blocked by>"
```

**If Epic:**

First, create the parent issue (use the highest priority among its stories):
```bash
gh issue create \
  --title "Epic: <TITLE>" \
  --label "<group label>,priority-<high|medium|low>" \
  --body "<Overview, story list as bullet references, parallelism notes, link to wiki page>"
```
Note the parent issue number (call it PARENT_N).

Then create each story as a child issue with its own priority:
```bash
gh issue create \
  --title "<story title>" \
  --label "<group label>,priority-<high|medium|low>" \
  --body "<description, acceptance criteria, files, parallelism, Blocked by: #N if applicable>"
```

After creating all child issues, attach them as sub-issues using each child's REST API numeric id:
```bash
child_id=$(gh api /repos/Jgordon-pencilwrench/blurt/issues/<child_number> --jq '.id')
gh api --method POST /repos/Jgordon-pencilwrench/blurt/issues/<PARENT_N>/sub_issues \
  -F sub_issue_id=$child_id
```

## Step 3: Create wiki epic page (epics only)

Generate a slug from the title (lowercase, hyphens). Clone the wiki, create `Epics-<slug>.md`:

```bash
cd /tmp && rm -rf blurt-wiki && git clone https://github.com/Jgordon-pencilwrench/blurt.wiki.git blurt-wiki
```

Write `Epics-<slug>.md` with:
- Epic overview
- Story table (issue number, title, status: Not started)
- Parallelism notes
- "Session Notes: Updated by implementation sessions via /update-wiki"

```bash
cd /tmp/blurt-wiki && git add -A && \
git commit -m "docs(wiki): add epic page for <title>" && git push
```

Update `Epics-README.md` to add a row to the Current Epics table.

## Step 4: Report

List all created issue URLs and the wiki page URL (if epic).
