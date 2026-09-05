# progress-audit

**Schedule**: 20:00 IST daily  
**Task ID**: `the-progress-audit`  
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

The day's bookkeeper and the coherence ritual's executor. At 20:00 the vetoes are in: this agent settles the Rail, logs the wins, files the dump, restocks tomorrow's Next, and leaves the Evening section ready for tomorrow's 07:30 brief.

## Duties (in order)

1. **Rail deltas**: query `rail_data_source_id` — cards whose Lane moved to `Done` today (last_edited today AND Lane = Done, cross-checked against yesterday's state where knowable).
2. **Daybook Shipped**: PATCH today's Daybook page (query `daybook_data_source_id`, Date = today) — Shipped = comma-joined titles of today's Done cards (empty stays empty; never write "nothing").
3. **Wins rows**: for each Done card, create a Wins row (`wins_data_source_id`): What = card title · Date = today · Kind = `Shipped` · Project = card's Project. Duplicate check on What+Date first. Streak logic is positive-only everywhere: a broken streak simply disappears — never log, show, or imply a zero.
4. **Execute the coherence proposals** — read the `Coherence` section of today's Daybook (`GET` page children, walk the to_dos under `Sorted`) and diff against `~/Code/life-os/logs/cache/coherence-$(TZ=Asia/Kolkata date +%F).json`:
   - Checked to_do → execute its destination: `Rail card ({Load}, {Project})` → create the card, Lane = `Inbox`, Load/Project as proposed, no due date. `Library ({Kind})` → create the Library row. `drop` → nothing.
   - Unchecked to_do → skipped entirely. A veto is a veto; do not re-propose tomorrow.
   - **Cohered checkbox**: if any veto or text edit is detected versus the snapshot (an unchecked box, a changed line, a changed destination), the ritual happened — set Cohered = true on today's Daybook. Untouched proposals = leave Cohered unchecked.
5. **Archive the dump**: append the raw dump text verbatim (with a `--- {date} ---` header) to the Apple Note named by anchors key `archive_note_title`, then clear the dump note's body (the note named `dump_note_title`). **Never delete either note.** Only clear the dump after the archive append succeeds.
6. **Restock Next to exactly 3**: count Lane = `Next`. Over 3 → move lowest-priority extras to `Later`. Under 3 → promote the best candidates from `Later` (fallback `Inbox`), preferring cards that serve a Goal with Horizon `Now`, at least one of them Flow. Now lane is untouched — that is focus-kickoff's jurisdiction.
7. **Tomorrow's top-3 → Evening section**: locate the `Evening` heading in today's Daybook, delete any previous children under it (idempotent re-runs), append the top-3 from the Coherence `Tomorrow` proposals adjusted for vetoes — the `#1` Flow candidate first.
8. **Yesterday line for tomorrow's brief**: append one final paragraph under Evening: `Yesterday → shipped {n}` plus ` · {streak}` only if an active streak exists (e.g. `3-day ship streak`, `essay streak intact`). morning-brief reuses this line verbatim tomorrow at 07:30.

**Failure mode**: coherence snapshot missing → treat every checked to_do in the Daybook as confirmed and say so in the log (never re-ask); Apple Notes unreachable → skip step 5 entirely (never clear a dump that wasn't archived) and retry tomorrow; any single step failing → log one line per failure to `~/Code/life-os/logs/progress-audit-$(date +%F).log` and continue with the remaining steps — never block the rest of the duties, never fail silently.
