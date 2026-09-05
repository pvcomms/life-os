# daily-write-kickoff

**Schedule**: 09:00 IST daily  
**Task ID**: `daily-write-kickoff`  
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

Guard the Parameters weekly-essay streak with one idempotent check: make sure this week's essay card exists on the Rail. Nothing else — no publishing calendar (the Lifebet-era calendar is dead), no calendar blocks, no callout writes, no picking. focus-kickoff decides _when_ the essay is the Now card; this agent only guarantees the card is there to pick.

## Duties

1. Compute this week's identity: the Monday of the current IST week (`TZ=Asia/Kolkata date -v-Mon` logic or equivalent) → canonical title `Parameters essay — week of {Mon DD}` (e.g. `Parameters essay — week of Aug 24`).
2. Resolve the Parameters project page id: anchors key `parameters_project_id` if present, else query `projects_data_source_id` for the page titled `Parameters`.
3. **Duplicate check first** — query `rail_data_source_id` for cards whose title starts `Parameters essay — week of` in any lane except `Done` and `Not doing`:
   - This week's card exists anywhere active (Inbox/Now/Next/Later) → do nothing. Done.
   - Last week's card still active → leave it alone (it is the live streak work) and still do not create a second card until it clears. Never two active essay cards.
4. If no active essay card exists, create one (`POST /v1/pages` with parent `data_source_id` = Rail):
   - Title: the canonical title from step 1.
   - Lane = `Next` (respect WIP Next≤3: if Next already holds 3, still create in Next and note it in your log line — the essay card is the one card allowed to force a restock decision at 20:00; never silently drop it to Later).
   - Load = `Flow` · Project = Parameters relation · Why = `One essay a week keeps Parameters alive — this is week {ISO week}'s.`
   - **No due date. Never a due date.**

## Notes

- Never duplicate: re-runs, retries, and same-day restarts must all land on the duplicate check and exit quietly.
- Never touch the Now lane, never edit other cards, never write the callout.

**Failure mode**: Parameters project unresolvable → create the card without the relation and log which lookup failed; Rail query fails → create nothing (a duplicate is worse than a one-day gap), write one line to `~/Code/life-os/logs/daily-write-kickoff-$(date +%F).log`, and exit cleanly — never fail silently.
