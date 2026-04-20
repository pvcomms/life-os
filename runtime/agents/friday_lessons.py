"""friday-lessons with goal decomposition + fallbacks.

goal = "extract weekly lessons"
  ├── gather
  │     ├── notion-sessions  fallback: local claude-sessions cache
  │     ├── todoist-done     fallback: last-week snapshot
  │     └── whoop-week       fallback: skip biometrics
  ├── extract-lessons        fallback: terse 1-bullet fallback
  └── persist
        ├── append-file      fallback: log to logs/unwritten-lessons/
        └── git-commit       fallback: stage only, no commit
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
from pathlib import Path

from runtime.planner import Node, Run

ICLOUD = Path(os.environ.get(
    "LIFEOS_LESSONS_PATH",
    Path.home() / "Library" / "Mobile Documents" / "com~apple~CloudDocs" / "weekly_lessons.md",
))
CACHE_DIR = Path(os.environ.get("LIFEOS_CACHE_DIR", Path(__file__).resolve().parents[2] / "logs" / "cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def pull_notion(ctx):
    if ctx.get("fail_notion"):
        raise RuntimeError("notion timeout")
    sessions = ["Keep pivot", "Anthropic Fellows draft", "life-os refactor"]
    ctx["sessions"] = sessions
    (CACHE_DIR / "sessions.json").write_text(json.dumps(sessions))
    return f"{len(sessions)} sessions"


def pull_notion_fallback(ctx, err):
    p = CACHE_DIR / "sessions.json"
    ctx["sessions"] = json.loads(p.read_text()) if p.exists() else []
    return "used local cache"


def pull_todoist_done(ctx):
    if ctx.get("fail_todoist"):
        raise RuntimeError("todoist 503")
    ctx["done"] = ["shipped Keep settler", "published TFR v2", "14-agent sweep"]
    return f"{len(ctx['done'])} completions"


def pull_todoist_done_fallback(ctx, err):
    ctx["done"] = []
    return "last-week snapshot empty"


def pull_whoop_week(ctx):
    if ctx.get("fail_whoop"):
        raise RuntimeError("whoop 401")
    ctx["whoop_week"] = {"avg_recovery": 58, "red_days": 2}
    return "avg recovery 58%"


def pull_whoop_week_fallback(ctx, err):
    ctx["whoop_week"] = None
    return "skipping biometrics"


def extract_lessons(ctx):
    sessions = ctx.get("sessions", [])
    done = ctx.get("done", [])
    lessons = []
    if sessions:
        lessons.append(f"sessions > {len(sessions)} touched: {', '.join(sessions[:3])}")
    if done:
        lessons.append(f"ship cadence held: {len(done)} completions")
    w = ctx.get("whoop_week")
    if w:
        lessons.append(f"recovery avg {w['avg_recovery']}% — {w['red_days']} red days")
    if not lessons:
        raise RuntimeError("no inputs to extract from")
    ctx["lessons"] = lessons
    return f"{len(lessons)} lessons"


def extract_lessons_fallback(ctx, err):
    ctx["lessons"] = ["week ran degraded — see run tree"]
    return "terse fallback lesson"


def append_file(ctx):
    today = dt.date.today().isoformat()
    body = f"\n\n## Week ending {today}\n\n" + "\n".join(f"- {l}" for l in ctx["lessons"])
    target = ICLOUD
    if ctx.get("dry_run"):
        target = CACHE_DIR / f"dryrun-weekly-{today}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a") as f:
        f.write(body)
    return f"appended → {target}"


def append_file_fallback(ctx, err):
    stash = CACHE_DIR.parent / "unwritten-lessons" / f"{dt.date.today().isoformat()}.md"
    stash.parent.mkdir(parents=True, exist_ok=True)
    stash.write_text("\n".join(f"- {l}" for l in ctx.get("lessons", [])))
    return f"stashed → {stash}"


def git_commit(ctx):
    if ctx.get("fail_git"):
        raise RuntimeError("nothing to commit / git locked")
    # Real impl runs in iCloud repo; here we just report intent
    return "would: git add weekly_lessons.md && git commit -m 'weekly lessons'"


def git_commit_fallback(ctx, err):
    return "staged only, manual commit needed"


def build_plan() -> Node:
    return Node(
        name="extract weekly lessons",
        children=[
            Node(
                "gather",
                children=[
                    Node("notion-sessions", pull_notion, pull_notion_fallback),
                    Node("todoist-done", pull_todoist_done, pull_todoist_done_fallback),
                    Node("whoop-week", pull_whoop_week, pull_whoop_week_fallback),
                ],
            ),
            Node("extract-lessons", extract_lessons, extract_lessons_fallback),
            Node(
                "persist",
                children=[
                    Node("append-file", append_file, append_file_fallback),
                    Node("git-commit", git_commit, git_commit_fallback),
                ],
            ),
        ],
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fail", action="append", default=[])
    ap.add_argument("--write", action="store_true", help="write to real iCloud file (off by default)")
    args = ap.parse_args()
    run = Run("friday-lessons")
    for k in args.fail:
        run.context[f"fail_{k}"] = True
    run.context["dry_run"] = not args.write
    result = run.execute(build_plan())
    print(json.dumps(result.to_dict(), indent=2, default=str))


if __name__ == "__main__":
    main()
