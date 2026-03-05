Analyze the open GitHub Issues and recommend the best one to work on next. Think — don't just list.

## Step 1: Gather the landscape

```bash
# All open issues with labels and body
gh issue list --state open --json number,title,labels,body --limit 50

# What's currently in-progress
gh issue list --label in-progress --json number,title,body
```

## Step 2: Filter out unavailable issues

Remove any issue that:
- Has the `in-progress` label (already claimed)
- Has a body containing `Blocked by: #N` where issue #N is not yet closed

To verify a dependency:
```bash
gh issue view <N> --json state -q .state
# must be "CLOSED"
```

## Step 3: Reason about what to pick

Do not just sort by priority label and pick the top result. Think through these dimensions and weigh them together:

**Priority signal** (`priority-high`, `priority-medium`, `priority-low` labels)
The priority label is a strong input but not a hard rule. Note it and factor it in.

**Dependency multiplier**
Does completing this issue unlock other issues? Check issue bodies for `Blocked by: #N` references pointing *to* this issue. An issue that unblocks two high-priority follow-ons is more valuable than a high-priority standalone.

**File overlap with in-progress sessions**
Check what files the in-progress sessions are touching (look at their issue bodies). Avoid picking an issue that touches the same core files — it will create merge conflicts and slow both sessions down.

**Parallelism fit**
Does the candidate issue say `Safe to run in parallel: yes`? Is it in a group that's already running? Prefer issues that are safely isolated from active work.

**Relative effort vs. value**
A medium-priority issue that's small and isolated may be better right now than a high-priority issue that's large and touches shared files.

## Step 4: Present your recommendation

Do not just list everything available. Lead with your recommendation, then show your reasoning.

Format:

```
Currently in-progress: #6 (B1), #7 (B2), #5 (A2)

My recommendation: #<N> — <title>

Reasoning:
- Priority: <high/medium/low>
- Unlocks: <list of issues this unblocks, or "nothing immediately">
- File overlap with in-progress: <none / describe any>
- Parallelism: <safe / concern>
- Why now: <1-2 sentences on why this beats the other candidates>

Other candidates considered:
- #<N> <title> — <one-line reason not recommended>
- #<N> <title> — <one-line reason not recommended>
```

Then ask: "Shall I proceed with #<N>, or would you like to choose differently?"
