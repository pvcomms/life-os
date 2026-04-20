# life-os

Autonomous life OS for Param Vaswani. Eight Claude agents running on scheduled-tasks, orchestrating the full stack: Whoop, Todoist, Notion, Google Calendar, Gmail, Vercel, GitHub.

## Agents

| Agent                    | Schedule       | Purpose                                                                                  |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------- |
| whoop-recovery-check     | 06:30 daily    | Whoop pull → if Red, reschedule deep work in Todoist                                     |
| recovery-aware-scheduler | 06:45 daily    | Whoop + GCal + Todoist → draft meeting decline replies on red, block focus time on green |
| morning-brief            | 07:30 daily    | Whoop + Calendar + Gmail + Todoist top-3 → Notion daily page                             |
| focus-kickoff            | 09:30 Mon–Fri  | Inbox triage + pick today's #1 shippable task                                            |
| keep-monitor             | 10am/1pm/4pm   | Keep settler + Vercel infra health check, alert on failures                              |
| friday-lessons           | 17:00 Fri      | Extract weekly lessons → append weekly_lessons.md → commit                               |
| monthly-synthesis        | Last Sun/month | 600-word synthesis essay → PR on this repo                                               |
| evening-postmortem       | 20:00 daily    | What shipped, what slipped, tomorrow's top-3                                             |

## Stack

- **Biometrics**: Whoop MCP (paramxclaudedev/whoop-mcp)
- **Tasks**: Todoist MCP
- **Knowledge**: Notion (command center: 343b6913e6b8810d98b1f1f8c11f7ab9)
- **Calendar/Email**: Google Calendar + Gmail
- **Infrastructure**: Vercel MCP (paramxclaudedev/vercel-mcp)
- **Runtime**: Claude Code scheduled-tasks

## Essays

Monthly synthesis drafts land in `essays/` as PRs. Review before publishing to Substack.

## Live runtime

Non-linear agents (currently `morning-brief`, `friday-lessons`) run via `runtime/planner.py`. Each agent decomposes a top-level goal into a sub-goal tree and falls back per-leaf on failure instead of crashing the run. Decision trees persist to `logs/<run-id>.json`; a rolling event stream writes to `logs/stream.jsonl`.

```bash
# run an agent now
bin/life-os run morning-brief
bin/life-os run morning-brief --fail whoop --fail gmail   # rehearse degradation
bin/life-os run friday-lessons                            # dry-run by default

# follow the live stream (color by agent)
bin/life-os tail
bin/life-os tail --agent morning-brief --kinds node_end,run_end

# launch the web dashboard — SSE, 200-line window, reconnects on error
bin/life-os dash            # http://127.0.0.1:8787
```

The dashboard is warm monochrome, Fraunces + JetBrains Mono, one-color-per-agent dots, entry motion on every event.
