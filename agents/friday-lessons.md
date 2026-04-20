# friday-lessons

**Schedule**: 17:00 IST Fridays  
**Task ID**: `friday-lessons`  
**MCPs**: notion, todoist, whoop

## Purpose

Extract 3–5 weekly lessons from Notion sessions + completed Todoist tasks + Whoop data. Append to `~/Library/Mobile Documents/com~apple~CloudDocs/weekly_lessons.md` and commit.

## Execution (non-linear)

Runs via `runtime/agents/friday_lessons.py` with the planner from `runtime/planner.py`.

```
extract weekly lessons
  gather
    notion-sessions → local cache
    todoist-done    → last-week snapshot
    whoop-week      → skip biometrics
  extract-lessons   → terse single-bullet fallback
  persist
    append-file     → stash in logs/unwritten-lessons/
    git-commit      → stage-only
```

Default is dry-run (writes to `logs/cache/dryrun-weekly-*.md`). Pass `--write` when the scheduled task invokes it live.
