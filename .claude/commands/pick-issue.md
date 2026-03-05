List open GitHub Issues that are available to work on — unblocked and not already claimed.

## Step 1: Get all open issues

```bash
gh issue list --state open --json number,title,labels,body --limit 50
```

## Step 2: Filter

Remove any issue that:
- Has the `in-progress` label (already claimed by another session)
- Has a body containing `Blocked by: #N` where issue #N is still open

To check if a dependency is resolved:
```bash
gh issue view <N> --json state -q .state
# must be "CLOSED" to proceed
```

## Step 3: Display

Show the remaining issues grouped by label, in this format:

```
Available issues:

GROUP A — Prompts & LLM Quality
  #5  A2 · Lower LLM temperature + add output preamble stripper

GROUP B — Transcription Quality  
  #8  B3 · VAD silence stripping before Whisper
  #9  B4 · Per-mode vocabulary → Whisper initial prompt
  #10 B5 · Multiple Whisper model sizes + per-mode model selection

...

Epic parent issues (for browsing stories):
  #21 Epic: Transcription Quality (Group B)
  ...
```

Also note anything currently in-progress so the human has the full picture.
