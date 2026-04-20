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
