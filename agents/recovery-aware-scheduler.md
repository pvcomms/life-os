# recovery-aware-scheduler

**Schedule**: 06:45 IST daily
**Task ID**: `recovery-aware-scheduler`
**MCPs**: whoop, google-calendar, todoist, notion

## Purpose

Pull Whoop recovery, then rebalance today across GCal + Todoist by zone. Runs after `whoop-recovery-check` (06:30) and before `morning-brief` (07:30). Stays in autonomous-mode bounds: drafts only, no outbound cancellations.

## Zones

- **Red (<40%)**
  - GCal today → flag non-critical meetings (internal recurring, low-priority syncs, ≥30min blocks).
  - Draft decline/reschedule replies into a Todoist "meeting drafts" project. Do NOT send or cancel anything that would notify attendees.
  - Push Todoist tasks tagged `deep-work`/`ship`/`build` due today → tomorrow. Leave recovery/admin tasks.
  - Create P1 Todoist: "Red recovery protocol — hydrate, protein, early sleep, ≤1 deep block."
- **Yellow (40–66%)**
  - Calendar untouched.
  - Elevate one Todoist pacing reminder: "Yellow zone — one deep block max, pace."
- **Green (>66%)**
  - Scan today's GCal for the longest free block in 09:00–13:00 IST.
  - If ≥90min gap: create calendar event `Deep Work — [top Todoist task]` in that block.
  - Surface top `deep-work` Todoist task: set priority 1 + due today.

All zones log one line to Notion Claude Sessions (`2a972407-306a-450d-9351-330f62e90d95`) tagged `productivity`.

## Guardrails

- Never send outbound calendar invites, cancellations, or emails — drafts only.
- Critical meetings (pitch/investor/customer/Keep) are never touched regardless of zone.
- If Whoop API fails, log the failure to Notion and exit; never act on stale recovery data.
