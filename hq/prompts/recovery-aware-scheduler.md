# recovery-aware-scheduler

**Schedule**: 06:50 IST daily  
**Task ID**: `recovery-aware-scheduler`  
**MCPs**: google-calendar, notion-rest (curl)

---

**Notion access (headless-safe):** No Notion connector exists in scheduled runs. All Notion reads/writes go through the REST API:

1. `source ~/.config/notion.env` (provides NOTION_API_KEY). If the file is missing, abort and write one line to ~/Code/life-os/logs/ explaining why — never fail silently.
2. Read `~/Code/life-os/hq/anchors.json` for every page/database/block ID (keys documented inside it). Never hardcode IDs.
3. Calls: `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2025-09-03" -H "Content-Type: application/json"`. Query databases via their `data_source_id` (in anchors.json), not database_id. Page/block writes use the regular pages/blocks endpoints.
4. The "Today callout" on The Pass is replaced wholesale: list its children, delete each, append the new set. Never append without deleting (clutter is a system failure).
5. Whoop data via the local whoop MCP if available, else the cached JSON at ~/Code/life-os/logs/cache/whoop_last_good.json.

---

## Purpose

Turn today's Mode plus the real calendar into the day's block list. Runs after `whoop-recovery-check` (06:30, sets Mode) and before `morning-brief` (07:30, mirrors the plan into the Today callout). Writes exactly one thing: the `Plan` section of today's Daybook page.

## Day contract (IST)

- **07:30–10:30 — ramp.** Light tasks only, no consumption. (Concerta 07:30.)
- **10:30–15:15 — PEAK.** One Flow card, creation only. (Concerta 10:00 and 13:00; medication peak 10:30–16:00.)
- **15:15–16:00 — coherence ritual.**
- **16:00–18:00 — fade.** Light tasks.
- **Evening — Consume queue only.**

## Duties

1. Read today's Daybook page (query `daybook_data_source_id`, Date = today IST): Mode and Recovery %. If the page doesn't exist yet, create it exactly as whoop-recovery-check would (three headings, Mode = Steady) and note that in your log line.
2. Read today's Google Calendar events. **Read-only** — never create, move, decline, or reply to anything, and never touch a meeting regardless of Mode. Real events are immovable objects the plan bends around.
3. Build the block list from the contract, bent around real events:
   - **Push / Steady**: keep the full contract. Split PEAK into two Flow blocks around any immovable midday event; with a clear calendar use `10:30–12:45` and `13:15–15:15`.
   - **Recover**: ONE peak block only (`10:30–13:00`), plus an explicit smaller-ask line: `Recover day — smaller ask: pick the lowest-load Flow card and call one finished section a win.` Fade block becomes optional rest.
   - Calendar events that land inside a contract block get their own bullet in place (`{start}–{end} · {event title} (calendar)`), with the surrounding block times trimmed around them.
4. Write the `Plan` section of today's Daybook:
   - `GET /v1/blocks/{daybook_page_id}/children` → locate the `Plan` and `Coherence` heading block ids.
   - Delete every block between `Plan` and `Coherence` **except** an RHR flag paragraph (a line starting `RHR `) left by whoop-recovery-check — that line survives and stays first.
   - Append the new bullets after the surviving flag (or directly after the `Plan` heading if no flag): `PATCH /v1/blocks/{daybook_page_id}/children` with `"after": "<block_id>"`.
   - Bullet format, one `bulleted_list_item` per block, in chronological order: `07:30–10:30 · ramp — Light only, no consumption` · `10:30–15:15 · PEAK — one Flow card` (or the two split blocks) · `15:15–16:00 · coherence ritual` · `16:00–18:00 · fade — Light` · `evening · Consume queue`.

## Guardrails

- Drafts of the day, never edits to the world: no invites, cancellations, or emails, in any Mode.
- No due dates anywhere, no Rail edits — lane decisions belong to focus-kickoff and progress-audit.

**Failure mode**: Calendar unreachable → write the pure contract block list and prefix the section's first bullet with `(calendar unread)`; Daybook missing and uncreatable → write the block list to `~/Code/life-os/logs/recovery-aware-scheduler-$(date +%F).log` instead. Always: log one line explaining the degradation, finish the remaining duties, never fail silently.
