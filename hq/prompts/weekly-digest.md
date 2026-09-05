# weekly-digest

**Schedule**: 21:00 IST Sundays  
**Task ID**: `weekly-digest`  
**MCPs**: whoop, gmail, notion-rest (curl)

---

**Notion access (headless-safe):** No Notion connector exists in scheduled runs. All Notion reads/writes go through the REST API:

1. `source ~/.config/notion.env` (provides NOTION_API_KEY). If the file is missing, abort and write one line to ~/Code/life-os/logs/ explaining why — never fail silently.
2. Read `~/Code/life-os/hq/anchors.json` for every page/database/block ID (keys documented inside it). Never hardcode IDs.
3. Calls: `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2025-09-03" -H "Content-Type: application/json"`. Query databases via their `data_source_id` (in anchors.json), not database_id. Page/block writes use the regular pages/blocks endpoints.
4. The "Today callout" on The Pass is replaced wholesale: list its children, delete each, append the new set. Never append without deleting (clutter is a system failure).
5. Whoop data via the local whoop MCP if available, else the cached JSON at ~/Code/life-os/logs/cache/whoop_last_good.json.

---

## Purpose

Sunday night, three jobs: the performance digest email (existing duty), the life-map redraw on The Pass, and the decay report that keeps the whole OS honest. The digest reports the body; the life map reports the direction; the decay report reports whether the system itself is still alive.

## Duty 1 — performance digest email (existing duty, modernized sources)

Sources: Whoop (MCP, else cache) for the week's recoveries/sleep/strain; the week's 7 Daybook pages (`daybook_data_source_id`) for Mode distribution, Shipped, Cohered; Google Calendar / Gmail for what actually happened.

Sections: **Recovery trend** (best/worst day, average %, HRV direction) · **Sleep** (average hours, best/worst night) · **Strain** (total, workout count) · **Modes** (Push/Steady/Recover day counts) · **Shipped** (from Daybook Shipped props) · **Insights** (real cross-correlations only — recovery vs shipped, mode vs coherence) · **Next week** (one focus, from patterns).

Style: dark, minimal, data-dense — personal performance report, not corporate newsletter. **Draft** the email to pum268@gmail.com, subject `Param Hub · Weekly Digest · {date range}`. Draft only, never send.

## Duty 2 — life-map redraw on The Pass

Regenerate the mermaid code block (`life_map_block_id`) from Goals (`goals_data_source_id`) + Projects (`projects_data_source_id`):

- Root: the north star node.
- Alive goals (Horizon Now/Quarter/Year) as children, each labeled with its Target date.
- Active projects as leaves under their Goal relation.
- Every Parked/Blocked/Dormant project collapses into ONE gray node: `parked & dormant ({N})` — the map shows the living tree, not the graveyard.
  `GET /v1/blocks/$LIFE_MAP_BLOCK_ID` → `PATCH` it with the new mermaid source (`"language": "mermaid"`). Replace the content wholesale; never append a second diagram.

## Duty 3 — week in wins + decay report

1. **Week in wins**: query `wins_data_source_id` for Date in the last 7 days; include in the digest email grouped by Kind (Shipped/Streak/Milestone/First). Positive-only: absent streaks are simply absent.
2. **Decay report** — append a dated section to the Back office page (`back_office_page_id`), computing from the decay JSON block, the week's Daybooks, `now_promotions.json`, and per-DB last-edit inspection:
   - dump lines/day (capture pulse — red if averaging < 1)
   - ritual hit rate: Cohered checkboxes out of 7 (red if < 3)
   - Now-thrash count: Now-lane changes beyond focus-kickoff's own promotions (red if > 2)
   - human-vs-agent last-edit ratio per DB: sample recent pages in Rail/Daybook/Library/Wins, compare `last_edited_by` against the integration's bot id (red if humans are under 20% everywhere — a system only agents touch is a terrarium, not an OS)
3. **Amputation rule**: if ≥ 2 metrics are red, propose exactly ONE amputation in plain language at the end of the report — name the limb, the evidence, and what stopping would free up. One proposal, human decision. Never propose two, never auto-execute.

**Failure mode**: any of the three duties failing must not block the other two — degrade the digest to available sources (mark missing sections `no data this week`), skip the map redraw if Goals/Projects are unreadable rather than drawing a wrong one, and log one line per degradation to `~/Code/life-os/logs/weekly-digest-$(date +%F).log` — never fail silently.
