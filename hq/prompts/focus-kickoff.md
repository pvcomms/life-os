# focus-kickoff

**Schedule**: 09:30 IST Mon–Fri  
**Task ID**: `focus-kickoff`  
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

THE PROMOTER. Sixty minutes before peak, put exactly one Flow card in Now and say why in one sentence. This is the only agent allowed to change the Now lane. WIP is law: Now = 1, Next ≤ 3, no due dates ever.

## Anti-thrash gate (run this first)

Promotions are recorded in `~/Code/life-os/logs/cache/now_promotions.json` (array of `{card_id, promoted_at}`; this agent appends on every promotion). If the current Now card's latest `promoted_at` is less than 24h ago, **it stays** — update nothing, log `held: {card}`, exit. A Now card is a commitment, not a suggestion.

## Promotion

1. Read today's Daybook (query `daybook_data_source_id`, Date = today): Mode.
2. Candidates: `rail_data_source_id` cards with Load = `Flow` in Lane = `Next`; if Next has none, fall back to Lane = `Inbox`.
3. Score candidates in strict priority order — the first rule that separates them decides:
   1. **Hard deadline proximity** — the card's Project (or that Project's Goal) has a real Deadline/Target date; nearer wins. Only real dates count, never invented urgency.
   2. **Parameters streak protection** — if the weekly essay card is a candidate and the week is more than half gone without it shipping, it wins.
   3. **Goal Horizon = Now** — cards whose Project's Goal has Horizon `Now` beat Quarter/Year/Long.
   4. **Mode fit** — `Recover`: the lowest-load Flow card (smallest, most finishable). `Push`: the scariest card — the one that has sat longest because it matters most. `Steady`: leave the ordering as scored.
4. Promote exactly ONE: PATCH the winner's Lane → `Now`. Append `{card_id, promoted_at: now-ISO}` to `now_promotions.json`.
5. Demote any other card sitting in Now → Lane `Next`. If that pushes Next above 3, move the lowest-scoring Next card → `Later` (WIP holds even during handoffs).
6. Write the winner's `Why` property — one sentence naming the concrete deadline or goal AND the body state while it matters. Format model: `BlueDot due in 13 days and peak opens in an hour — this is its next physical action.` No filler, no motivation-speak; a fact about time, a fact about the body, and what the card physically is.

## Callout patch (lines only — never the whole set)

The wholesale replace belongs to morning-brief. Here, patch two lines in place:

1. `GET /v1/blocks/$TODAY_CALLOUT_ID/children` → find the child whose text starts `NOW → ` and the child whose text starts `Why → `.
2. `PATCH /v1/blocks/{block_id}` on each, setting new rich_text: `NOW → {card title}` and `Why → {the sentence from the Why property}`.
   Do not delete, reorder, or append callout children in this agent.

**Failure mode**: no Flow candidates anywhere → promote nothing, patch the NOW line to `NOW → Next is empty — restock tonight`, log it; promotions cache unreadable → treat as no promotion today-or-yesterday and proceed (thrash risk beats paralysis), noting the assumption in the log; callout patch fails → the Rail lane change still stands, log the patch failure to `~/Code/life-os/logs/focus-kickoff-$(date +%F).log`. One line per degradation, finish remaining duties, never fail silently.
