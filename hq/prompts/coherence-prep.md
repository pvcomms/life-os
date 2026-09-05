# coherence-prep

**Schedule**: 15:15 IST daily  
**Task ID**: `coherence-prep`  
**MCPs**: apple-notes, notion-rest (curl)

---

**Notion access (headless-safe):** No Notion connector exists in scheduled runs. All Notion reads/writes go through the REST API:

1. `source ~/.config/notion.env` (provides NOTION_API_KEY). If the file is missing, abort and write one line to ~/Code/life-os/logs/ explaining why — never fail silently.
2. Read `~/Code/life-os/hq/anchors.json` for every page/database/block ID (keys documented inside it). Never hardcode IDs.
3. Calls: `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2025-09-03" -H "Content-Type: application/json"`. Query databases via their `data_source_id` (in anchors.json), not database_id. Page/block writes use the regular pages/blocks endpoints.
4. The "Today callout" on The Pass is replaced wholesale: list its children, delete each, append the new set. Never append without deleting (clutter is a system failure).
5. Whoop data via the local whoop MCP if available, else the cached JSON at ~/Code/life-os/logs/cache/whoop_last_good.json.

---

## Purpose

Set the table for the 15:30 coherence ritual. Read the day's raw capture (Apple Notes dump + Rail Inbox), propose where every line goes, and lay it out in today's Daybook as checkboxes Param can veto in ninety seconds. **Proposals only — this agent creates nothing in the Rail or Library.** progress-audit (20:00) executes whatever survives the ritual.

## Gather

1. **Dump note**: the Apple Note named by anchors key `dump_note_title`. Apple Notes MCP if present; fallback AppleScript: `osascript -e 'tell application "Notes" to get body of note "<dump_note_title>"'`. Strip HTML to plain lines; every non-empty line is one captured thought, kept verbatim.
2. **Rail Inbox**: query `rail_data_source_id` for Lane = `Inbox` — cards captured directly that never went through the dump.
3. **Today's Daybook page** (query `daybook_data_source_id`, Date = today) and its Mode.

## Write the Coherence section

Idempotency: `GET /v1/blocks/{daybook_page_id}/children`, locate the `Coherence` and `Evening` headings, delete everything between them (a re-run replaces its own proposals), then append after the `Coherence` heading (`PATCH .../children` with `"after"`), in this order:

**(a) `Sorted`** (heading_3) — one `to_do` block per dump line and per Inbox card, text = `{verbatim line} → {proposed destination}`, where destination is exactly one of:

- `Rail card ({Flow|Light}, {Project})` — it's an action
- `Library ({Doc|Reference|Idea|Someday|Queue})` — it's knowledge, not action
- `drop` — it's noise
  Every to_do is created **checked** (`"checked": true`): accept-by-default, Param unchecks to veto. Verbatim means verbatim — never paraphrase his words in the left half.

**(b) `Drafted cards`** (heading_3) — a plain bulleted list of just the extracted actions: `{proposed card title} · {Load} · {Project}`. This is the preview of what progress-audit will create.

**(c) `Tomorrow`** (heading_3) — proposed top-3 for tomorrow as bullets, informed by Mode, deadlines, and what today shipped so far. Exactly ONE of the three is a Flow candidate and its bullet starts `#1 `.

## Snapshot + callout line

- Save exactly what was proposed to `~/Code/life-os/logs/cache/coherence-$(TZ=Asia/Kolkata date +%F).json` (`{line, destination, checked}` per to_do) — progress-audit diffs against this to detect vetoes/edits and set the Cohered checkbox.
- Patch the callout Dump line only (find child starting `Dump → `, `PATCH /v1/blocks/{block_id}`): `Dump → {n} lines sorted — review in Daybook · ritual 15:30`. Touch no other callout child.

**Failure mode**: dump note unreadable via both paths → build the section from Rail Inbox alone and make the Dump line `Dump → note unreadable · ritual 15:30`; Daybook page missing → write the proposals to the snapshot JSON only so progress-audit can still surface them, and log one line to `~/Code/life-os/logs/coherence-prep-$(date +%F).log`. Degrade per-source, finish the rest, never fail silently.
