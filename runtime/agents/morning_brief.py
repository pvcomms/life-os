"""morning-brief with goal decomposition + fallbacks.

Run: python -m runtime.agents.morning_brief [--dry-run]

Structure:
  goal = "produce today's brief"
    ├── pull-signals  (parallel-conceptually, sequential here)
    │     ├── whoop        fallback: cached last-good
    │     ├── calendar     fallback: empty day
    │     ├── gmail        fallback: skip
    │     └── todoist      fallback: stale top-3
    └── synthesize
          ├── compose-markdown
          └── write-notion-page  fallback: stash locally
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
from pathlib import Path

from runtime.planner import Node, Run

CACHE_DIR = Path(os.environ.get("LIFEOS_CACHE_DIR", Path(__file__).resolve().parents[2] / "logs" / "cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache(key: str, value=None):
    p = CACHE_DIR / f"{key}.json"
    if value is None:
        return json.loads(p.read_text()) if p.exists() else None
    p.write_text(json.dumps(value, default=str))
    return value


# --- leaf runners ----------------------------------------------------------

def pull_whoop(ctx):
    if ctx.get("fail_whoop"):
        raise RuntimeError("whoop 401: token expired")
    recovery = random.randint(30, 90)
    payload = {"recovery": recovery, "strain": round(random.uniform(6, 18), 1)}
    _cache("whoop_last_good", payload)
    ctx["whoop"] = payload
    return f"recovery={recovery}%"


def pull_whoop_fallback(ctx, err):
    cached = _cache("whoop_last_good") or {"recovery": None, "strain": None, "stale": True}
    ctx["whoop"] = {**cached, "stale": True}
    return f"using cached whoop ({cached.get('recovery')}%)"


def pull_calendar(ctx):
    if ctx.get("fail_calendar"):
        raise RuntimeError("calendar 503")
    events = [{"t": "10:00", "title": "deep work"}, {"t": "15:00", "title": "founder call"}]
    ctx["calendar"] = events
    return f"{len(events)} events"


def pull_calendar_fallback(ctx, err):
    ctx["calendar"] = []
    return "empty day (degraded)"


def pull_gmail(ctx):
    if ctx.get("fail_gmail"):
        raise RuntimeError("gmail quota exceeded")
    threads = ["investor: warm intro reply", "domain: renewal reminder"]
    ctx["gmail"] = threads
    return f"{len(threads)} highlights"


def pull_gmail_fallback(ctx, err):
    ctx["gmail"] = []
    return "skipping gmail"


def pull_todoist(ctx):
    if ctx.get("fail_todoist"):
        raise RuntimeError("todoist 500")
    tasks = ["ship Keep settler fix", "draft substack #1", "top up Anthropic credits"]
    _cache("todoist_last_good", tasks)
    ctx["todoist"] = tasks
    return f"{len(tasks)} tasks"


def pull_todoist_fallback(ctx, err):
    ctx["todoist"] = _cache("todoist_last_good") or []
    return "using stale todoist top-3"


def compose_markdown(ctx):
    today = dt.date.today().strftime("%a, %b %d")
    w = ctx.get("whoop", {})
    md = [f"# {today} — {w.get('recovery', '??')}%"]
    md.append("\n## Whoop\n")
    md.append(f"- recovery {w.get('recovery')}, strain {w.get('strain')}" + (" (stale)" if w.get("stale") else ""))
    md.append("\n## Calendar\n")
    md += [f"- {e['t']} — {e['title']}" for e in ctx.get("calendar", [])] or ["- (empty)"]
    md.append("\n## Gmail highlights\n")
    md += [f"- {t}" for t in ctx.get("gmail", [])] or ["- (none)"]
    md.append("\n## Top 3\n")
    md += [f"- [ ] {t}" for t in ctx.get("todoist", [])]
    out = "\n".join(md)
    ctx["brief_md"] = out
    return f"{len(out)} chars"


def write_notion(ctx):
    if ctx.get("fail_notion"):
        raise RuntimeError("notion 502")
    # Real impl calls notion MCP; stub just records target
    ctx["notion_page"] = f"notion://daily/{dt.date.today().isoformat()}"
    return ctx["notion_page"]


def write_notion_fallback(ctx, err):
    stash = CACHE_DIR / f"brief-{dt.date.today().isoformat()}.md"
    stash.write_text(ctx.get("brief_md", ""))
    return f"stashed → {stash}"


def build_plan() -> Node:
    return Node(
        name="produce today's morning brief",
        children=[
            Node(
                name="pull-signals",
                children=[
                    Node("whoop", pull_whoop, pull_whoop_fallback),
                    Node("calendar", pull_calendar, pull_calendar_fallback),
                    Node("gmail", pull_gmail, pull_gmail_fallback),
                    Node("todoist", pull_todoist, pull_todoist_fallback),
                ],
            ),
            Node(
                name="synthesize",
                children=[
                    Node("compose-markdown", compose_markdown),
                    Node("write-notion-page", write_notion, write_notion_fallback),
                ],
            ),
        ],
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fail", action="append", default=[], help="simulate failure: whoop|calendar|gmail|todoist|notion")
    args = ap.parse_args()

    run = Run("morning-brief")
    for k in args.fail:
        run.context[f"fail_{k}"] = True

    result = run.execute(build_plan())
    print(json.dumps(result.to_dict(), indent=2, default=str))


if __name__ == "__main__":
    main()
