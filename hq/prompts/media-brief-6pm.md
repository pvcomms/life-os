# media-brief-6pm

**Schedule**: 18:00 IST daily  
**Task ID**: `6pm-media-brief`  
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

The evening media brief, upgraded to feed the Consume queue. The fade is ending; whatever this agent surfaces is the _only_ consumption sanctioned tonight — the day contract reserves the evening for the Consume queue, so this run decides what's in it.

## Duties

1. **Brief** (existing duty, unchanged): scan recent content from Param's content diet —
   - What broke today that matters
   - Emerging trends worth watching
   - One contrarian take worth his time
     Quick, sharp, no fluff. This text is the run's output message.
2. **Queue picks → Library**: distill the brief into **3–5 concrete consumption picks** (a specific essay, episode, video, thread — things finishable tonight, not beats to "follow"). For each, create a Library row (`POST /v1/pages`, parent `library_data_source_id`):
   - Title = the pick (piece title + author/outlet)
   - Kind = `Queue` · Source = URL or origin · Area = best fit (Build/Write/Learn/Career)
   - Duplicate check first: skip any pick already sitting in Library with Kind = `Queue`.
3. **Tonight's top pick → callout**: choose the single best pick and replace the evening Consume bullet in the Today callout's Blocks list:
   - `GET /v1/blocks/$TODAY_CALLOUT_ID/children` → find the `bulleted_list_item` containing `Consume` (the evening bullet — it is the only Consume bullet; morning-brief guarantees that).
   - `PATCH /v1/blocks/{block_id}` rich_text → `Consume → {top pick title}`.
   - Patch that one bullet only. Never rebuild the callout at 18:00.

## Guardrails

- Never more than 5 Queue rows a day — the queue is a filter, not a firehose. No AI-industry churn unless it clears the "matters tomorrow" bar.
- Nothing before 18:00 should have pointed at consumption; do not add Consume bullets anywhere but the evening slot.

**Failure mode**: content sources thin or unreachable → write the brief from what's available and create fewer (even zero) Queue rows rather than padding; Library write fails → still patch the callout bullet with the top pick; callout bullet not found → log which duty degraded in one line to `~/Code/life-os/logs/media-brief-6pm-$(date +%F).log` and finish the rest — never fail silently.
