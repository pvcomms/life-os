# morning-brief

**Schedule**: 07:30 IST daily  
**Task ID**: `morning-brief`  
**MCPs**: whoop, google-calendar, gmail, todoist, notion

## Purpose

Consolidated morning brief: Whoop zone + today's calendar + overnight Gmail highlights + Todoist top-3. Creates a Notion daily page titled `[Weekday, Mon DD] — [score]% [zone]`.

## Execution (non-linear)

Runs via `runtime/agents/morning_brief.py`. Goal → sub-goals → leaves, each leaf has a fallback so a single upstream failure degrades rather than crashes:

```
produce today's brief
  pull-signals
    whoop      → cached last-good
    calendar   → empty day
    gmail      → skip
    todoist    → stale top-3
  synthesize
    compose-markdown
    write-notion-page → stash locally
```

Decision tree lands in `logs/<run-id>.json`. Live events stream to `logs/stream.jsonl` (consumed by the dashboard / `life-os tail`).

Run ad-hoc: `python -m runtime.agents.morning_brief` (add `--fail whoop` to rehearse degradation).
