# whoop-recovery-check

**Schedule**: 06:30 IST daily  
**Task ID**: `whoop-recovery-check`  
**MCPs**: whoop, notion-rest (curl)

---

**Notion access (headless-safe):** No Notion connector exists in scheduled runs. All Notion reads/writes go through the REST API:

1. `source ~/.config/notion.env` (provides NOTION_API_KEY). If the file is missing, abort and write one line to ~/Code/life-os/logs/ explaining why — never fail silently.
2. Read `~/Code/life-os/hq/anchors.json` for every page/database/block ID (keys documented inside it). Never hardcode IDs.
3. Calls: `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2025-09-03" -H "Content-Type: application/json"`. Query databases via their `data_source_id` (in anchors.json), not database_id. Page/block writes use the regular pages/blocks endpoints.
4. The "Today callout" on The Pass is replaced wholesale: list its children, delete each, append the new set. Never append without deleting (clutter is a system failure).
5. Whoop data via the local whoop MCP if available, else the cached JSON at ~/Code/life-os/logs/cache/whoop_last_good.json.

---

## Purpose

First agent of the day. Pull the night's Whoop data, open today's Daybook page, set Mode and Recovery %. Every downstream agent (scheduler, brief, promoter) reads what this agent writes. This agent touches nothing else — no Rail, no callout, no calendar.

## Duties

1. **Pull Whoop**: last night's recovery %, sleep duration + performance, HRV, RHR. On a successful live pull, overwrite `~/Code/life-os/logs/cache/whoop_last_good.json` with the fresh payload — this agent is the cache's writer; everyone else only reads it.
2. **Derive Mode** from recovery %: ≥67 → `Push` · 34–66 → `Steady` · ≤33 → `Recover`.
3. **Create today's Daybook page** in the Daybook DB (`daybook_data_source_id` in anchors.json):
   - Idempotency first: `POST /v1/data_sources/$DAYBOOK_DS/query` filtered on Date = today (IST, `TZ=Asia/Kolkata date +%F`). If a page exists, PATCH its properties instead of creating a duplicate.
   - Title: IST short date via `TZ=Asia/Kolkata date +"%a %b %-d"` → e.g. `Mon Aug 25`.
   - Properties: Date = today · Mode = derived Mode · Recovery % = recovery integer. Leave Shipped empty and Cohered unchecked — those belong to progress-audit.
   - Body: exactly three `heading_2` blocks, in this order: `Plan`, `Coherence`, `Evening`. Later agents append beneath these headings; never rename or reorder them.
4. **RHR flag** (cardiac history — factual, never alarmist): compute the 14-day RHR baseline as the mean of the last 14 recoveries from the whoop MCP. If only the cache is available, skip this step — never estimate a baseline. If today's RHR > baseline + 7 bpm, append one plain paragraph as the first block after the `Plan` heading (`PATCH /v1/blocks/{daybook_page_id}/children` with `"after": "<plan_heading_block_id>"`):
   `RHR {today} vs {baseline} 14-day avg — elevated. Worth noticing today.`
   One line, no advice, no exclamation. The reason this line exists is also the reason it stays boring.

## Notes

- Mode is the day's master switch: `Recover` makes downstream agents shrink the ask (one peak block, lowest-load Flow card, smaller top-3). This agent only sets the value.
- No Todoist, ever. The old rescheduling duties are gone; the Daybook Mode replaces the red/yellow/green alert tasks.

**Failure mode**: Whoop MCP down → read `whoop_last_good.json` and mark the data as cached in your log line; cache also missing → still create today's Daybook page with Mode = `Steady` and Recovery % empty, write one line to `~/Code/life-os/logs/whoop-recovery-check-$(date +%F).log` saying what was missing, and finish the remaining duties — degrade gracefully, never block Daybook creation, never fail silently.
