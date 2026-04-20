"""Minimal goal-decomposition planner for life-os agents.

A Plan is a tree of Nodes. Each leaf holds a callable + an optional
fallback. Execution walks the tree depth-first; leaf failure triggers
the fallback (re-plan) rather than crashing the run. Every state change
is streamed to a run log (JSONL) consumed by the dashboard/CLI tail.
"""

from __future__ import annotations

import json
import os
import time
import traceback
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

LOG_DIR = Path(os.environ.get("LIFEOS_LOG_DIR", Path(__file__).resolve().parent.parent / "logs"))
LOG_DIR.mkdir(parents=True, exist_ok=True)
STREAM_PATH = LOG_DIR / "stream.jsonl"


@dataclass
class Node:
    name: str
    run: Optional[Callable[[dict], Any]] = None
    fallback: Optional[Callable[[dict, Exception], Any]] = None
    children: list["Node"] = field(default_factory=list)

    def is_leaf(self) -> bool:
        return not self.children


@dataclass
class NodeResult:
    name: str
    status: str  # ok | failed | recovered | skipped
    value: Any = None
    error: Optional[str] = None
    fallback_used: bool = False
    duration_ms: int = 0
    children: list["NodeResult"] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "status": self.status,
            "value": _truncate(self.value),
            "error": self.error,
            "fallback_used": self.fallback_used,
            "duration_ms": self.duration_ms,
            "children": [c.to_dict() for c in self.children],
        }


def _truncate(v: Any, limit: int = 400) -> Any:
    try:
        s = v if isinstance(v, (str, type(None), bool, int, float)) else json.dumps(v, default=str)
    except Exception:
        s = str(v)
    if isinstance(s, str) and len(s) > limit:
        return s[:limit] + "…"
    return s


class Run:
    """One execution of one agent. Streams events to stream.jsonl."""

    def __init__(self, agent: str):
        self.agent = agent
        self.run_id = f"{agent}-{int(time.time())}-{uuid.uuid4().hex[:6]}"
        self.started_at = time.time()
        self.context: dict = {}

    def emit(self, kind: str, **fields) -> None:
        event = {
            "ts": time.time(),
            "run_id": self.run_id,
            "agent": self.agent,
            "kind": kind,
            **fields,
        }
        line = json.dumps(event, default=str)
        with STREAM_PATH.open("a") as f:
            f.write(line + "\n")

    def execute(self, root: Node) -> NodeResult:
        self.emit("run_start", goal=root.name)
        result = self._walk(root)
        self.emit(
            "run_end",
            status=result.status,
            duration_ms=int((time.time() - self.started_at) * 1000),
            tree=result.to_dict(),
        )
        # Persist per-run decision tree snapshot
        snapshot = LOG_DIR / f"{self.run_id}.json"
        snapshot.write_text(json.dumps({
            "run_id": self.run_id,
            "agent": self.agent,
            "started_at": self.started_at,
            "tree": result.to_dict(),
        }, indent=2, default=str))
        return result

    def _walk(self, node: Node) -> NodeResult:
        self.emit("node_start", node=node.name, leaf=node.is_leaf())
        start = time.time()

        if node.is_leaf():
            res = self._run_leaf(node)
            res.duration_ms = int((time.time() - start) * 1000)
            self.emit("node_end", node=node.name, status=res.status,
                      fallback_used=res.fallback_used,
                      last_line=_truncate(res.value, 160))
            return res

        child_results: list[NodeResult] = []
        failed = 0
        for child in node.children:
            cr = self._walk(child)
            child_results.append(cr)
            if cr.status == "failed":
                failed += 1

        status = "failed" if failed and failed == len(child_results) else "ok"
        if failed and status == "ok":
            status = "recovered"
        result = NodeResult(
            name=node.name,
            status=status,
            children=child_results,
            duration_ms=int((time.time() - start) * 1000),
        )
        self.emit("node_end", node=node.name, status=status, fallback_used=False)
        return result

    def _run_leaf(self, node: Node) -> NodeResult:
        try:
            value = node.run(self.context) if node.run else None
            return NodeResult(name=node.name, status="ok", value=value)
        except Exception as e:  # noqa: BLE001 — planner catches everything
            err = f"{type(e).__name__}: {e}"
            self.emit("node_error", node=node.name, error=err,
                      trace=traceback.format_exc(limit=3))
            if node.fallback is None:
                return NodeResult(name=node.name, status="failed", error=err)
            try:
                self.emit("fallback_start", node=node.name)
                value = node.fallback(self.context, e)
                return NodeResult(
                    name=node.name, status="recovered",
                    value=value, fallback_used=True,
                )
            except Exception as e2:  # noqa: BLE001
                return NodeResult(
                    name=node.name, status="failed",
                    error=f"primary={err}; fallback={type(e2).__name__}: {e2}",
                    fallback_used=True,
                )


def plan(agent: str, goal: str, sub_goals: list[Node]) -> tuple[Run, Node]:
    """Convenience: wrap sub-goals in a top-level goal node."""
    return Run(agent), Node(name=goal, children=sub_goals)
