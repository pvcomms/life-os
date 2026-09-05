# night-porter

**Schedule**: 23:50 IST daily  
**Task ID**: `1150pm-memory-consolidate`  
**MCPs**: notion-rest (curl)

---

**Notion access (headless-safe):** No Notion connector exists in scheduled runs. All Notion reads/writes go through the REST API:

1. `source ~/.config/notion.env` (provides NOTION_API_KEY). If the file is missing, abort and write one line to ~/Code/life-os/logs/ explaining why — never fail silently.
2. Read `~/Code/life-os/hq/anchors.json` for every page/database/block ID (keys documented inside it). Never hardcode IDs.
3. Calls: `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2025-09-03" -H "Content-Type: application/json"`. Query databases via their `data_source_id` (in anchors.json), not database_id. Page/block writes use the regular pages/blocks endpoints.
4. The "Today callout" on The Pass is replaced wholesale: list its children, delete each, append the new set. Never append without deleting (clutter is a system failure).
5. Whoop data via the local whoop MCP if available, else the cached JSON at ~/Code/life-os/logs/cache/whoop_last_good.json.

---

## Purpose

The building at midnight: sweep, file, count, lights off. Replaces memory-consolidate's filing duties — memory dedup stays as the first task, then the Rail and Library get their nightly housekeeping. This agent never surfaces anything to Param: no badges, no nags, no callout writes. If it isn't sure where something goes, it leaves it where it is.

## Duty 1 — memory consolidation (kept from the current task, runs first)

Across all of today's chats and interactions: merge duplicate memory entries, update stale project facts, capture new learnings, optimize the index in MEMORY.md, prune unused entries, flag connections between memories. `~/.claude/memory/` is canonical; run the memory-management pass non-interactively.

## Duty 2 — Rail and Library filing

1. **File Inbox non-actions**: query `rail_data_source_id` for Lane = `Inbox`. Cards that are clearly knowledge rather than action (a link, a quote, a concept, a reference — no verb, no next physical action) → create a Library row with the right Kind (Doc/Reference/Idea/Someday/Queue) carrying Area/Project/Source where inferable, then archive the Rail card (PATCH the page with `"in_trash": true`). **Anything uncertain stays in Inbox untouched — no badge, no nag.** coherence-prep will propose it properly tomorrow at 15:15.
2. **Archive stale Done**: cards with Lane = `Done` and last_edited more than 48h ago. Before archiving each, confirm a Wins row exists (`wins_data_source_id`, What = card title); if none does, create it (Kind = `Shipped`, Date = the card's last-edited date, Project = card's Project) — a win is never lost to housekeeping — then archive the card.
3. **Expire Not-doing**: cards with Lane = `Not doing` untouched for more than 7 days → create a Library row Kind = `Someday` (title + Project + Why preserved in the row), then archive the Rail card. Saying no twice is the system working.

## Duty 3 — decay counters

The Back office page (`back_office_page_id`) holds a JSON code block (`decay_block_id`) of running counters. Update it:

1. `GET /v1/blocks/$DECAY_BLOCK_ID` → parse the JSON from the code block's rich_text.
2. Increment/append today's values: dump lines processed (from `~/Code/life-os/logs/cache/coherence-$(TZ=Asia/Kolkata date +%F).json` line count), cohered (today's Daybook Cohered checkbox), now_promotions today (from `now_promotions.json`), inbox_filed / done_archived / notdoing_expired from tonight's sweep.
3. `PATCH /v1/blocks/$DECAY_BLOCK_ID` writing the updated JSON back as the code block content, `"language": "json"`. weekly-digest reads this on Sundays — keep it valid JSON, one object, dated daily entries.

**Failure mode**: memory pass failing never blocks the filing sweep, and vice versa; a card that errors on filing is skipped, not retried in a loop; decay block missing or unparseable → write tonight's counters to `~/Code/life-os/logs/night-porter-$(date +%F).log` instead so the data survives. One log line per degradation, finish the remaining duties, never fail silently.
