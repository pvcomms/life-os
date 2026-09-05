# morning-brief

**Schedule**: 07:30 IST daily  
**Task ID**: `morning-brief`  
**MCPs**: google-calendar, gmail, apple-notes, notion-rest (curl)

---

**Notion access (headless-safe):** No Notion connector exists in scheduled runs. All Notion reads/writes go through the REST API:

1. `source ~/.config/notion.env` (provides NOTION_API_KEY). If the file is missing, abort and write one line to ~/Code/life-os/logs/ explaining why — never fail silently.
2. Read `~/Code/life-os/hq/anchors.json` for every page/database/block ID (keys documented inside it). Never hardcode IDs.
3. Calls: `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2025-09-03" -H "Content-Type: application/json"`. Query databases via their `data_source_id` (in anchors.json), not database_id. Page/block writes use the regular pages/blocks endpoints.
4. The "Today callout" on The Pass is replaced wholesale: list its children, delete each, append the new set. Never append without deleting (clutter is a system failure).
5. Whoop data via the local whoop MCP if available, else the cached JSON at ~/Code/life-os/logs/cache/whoop_last_good.json.

---

## Purpose

The day's single full rewrite of the Today callout on The Pass. Gathers what the 06:30/06:50 agents wrote plus calendar, mail subjects, and the dump note, and mirrors it into the callout in the exact contract order. Everything after this run only patches individual lines; this run owns the whole set.

## Gather

1. **Today's Daybook** (query `daybook_data_source_id`, Date = today IST): Mode, Recovery %, and the `Plan` section bullets.
2. **Yesterday's Daybook**: Shipped property, and from its `Evening` section the line starting `Yesterday → ` that progress-audit composed. If present, reuse it verbatim; if absent, compose `Yesterday → shipped {Shipped or 0}` and — only if an unbroken streak exists in the Wins DB — append ` · {n}-day streak`. Broken streaks are never mentioned and never shown as zero.
3. **Yesterday's Coherence section**: any confirmed next steps (checked to_dos) that name today — context for the Why line only, no writes.
4. **Rail** (query `rail_data_source_id`): the card with Lane = `Now`, and its `Why` rich_text. Also count Lane = `Inbox` cards.
5. **Google Calendar**: today's events (read-only).
6. **Gmail**: overnight unread, **subject-level only** — never open bodies. Only a genuinely time-critical subject (flight, payment failure, hard deadline today) earns a bullet; gossip and newsletters earn nothing.
7. **Dump note**: count non-empty lines in the Apple Note named by anchors key `dump_note_title` (Apple Notes MCP; fallback `osascript -e 'tell application "Notes" to get body of note "<title>"'`).

## Rewrite the Today callout (the replace dance — exact sequence)

1. `GET /v1/blocks/$TODAY_CALLOUT_ID/children?page_size=100` (follow `next_cursor` to the end) → collect every child block id.
2. `DELETE /v1/blocks/{child_id}` for each collected id, in order.
3. `PATCH /v1/blocks/$TODAY_CALLOUT_ID/children` appending the new set — never append before every old child is deleted.

New children, exactly this order:

1. `link_to_page` → The Rail (`rail_page_id`): `{"type":"link_to_page","link_to_page":{"type":"page_id","page_id":"<rail_page_id>"}}`
2. Paragraph `NOW → {Now card title}` — no Now card: `NOW → — focus-kickoff picks at 09:30`
3. Paragraph `Why → {the Now card's Why, one sentence}` — no Now card: `Why → —`
4. Paragraph `PEAK 10:30–16:00 — Flow only`
5. Paragraph `Blocks →` followed by one `bulleted_list_item` per Plan bullet, same order. Prefix `⚡ ` on every bullet whose block falls inside 10:30–16:00. The Consume bullet appears only in the evening position, never earlier. At most one extra bullet for a time-critical mail subject, formatted `Mail: {subject}`.
6. Paragraph `Mode → {Mode} (recovery {N}%)`
7. Paragraph `Dump → {n} lines waiting · ritual 15:30`
8. Paragraph `Yesterday → shipped {x} · {streak}` (streak fragment omitted when there is none)
9. Daybook link labeled `ritual →`: the API's `link_to_page` block cannot carry a label, so implement as a paragraph — rich_text `ritual → ` followed by a page mention of today's Daybook: `{"type":"mention","mention":{"type":"page","page":{"id":"<daybook_page_id>"}}}`

**Failure mode**: any single source unreachable → degrade that one line (`Mode → Steady (recovery unread)`, `Dump → ? · ritual 15:30`, skip the mail bullet) and still complete the full callout rewrite; callout id missing from anchors.json → skip the rewrite, log one line to `~/Code/life-os/logs/morning-brief-$(date +%F).log` naming the missing key, and exit cleanly — never a partial delete without an append, never fail silently.
