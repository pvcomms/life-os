"""SSE server: tails logs/stream.jsonl and pushes each new line to clients.

Zero deps — stdlib only. Serves:
  GET /            dashboard HTML
  GET /events      text/event-stream
  GET /history     last 200 events as JSON
"""

from __future__ import annotations

import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STREAM_PATH = Path(os.environ.get(
    "LIFEOS_STREAM",
    ROOT.parent / "logs" / "stream.jsonl",
))
DASHBOARD_HTML = ROOT / "dashboard" / "index.html"
WINDOW = 200


def _tail(path: Path, start_offset: int):
    """Yield (offset, line) tuples starting at start_offset. Blocks."""
    while not path.exists():
        time.sleep(0.25)
    with path.open("r") as f:
        f.seek(start_offset)
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.5)
                continue
            yield f.tell(), line.rstrip("\n")


def _last_n(path: Path, n: int) -> list[str]:
    if not path.exists():
        return []
    with path.open("r") as f:
        lines = f.readlines()
    return [ln.rstrip("\n") for ln in lines[-n:]]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet the default stderr spam
        return

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            return self._serve_html()
        if self.path == "/history":
            return self._serve_history()
        if self.path.startswith("/events"):
            return self._serve_events()
        self.send_error(404)

    def _serve_html(self):
        html = DASHBOARD_HTML.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    def _serve_history(self):
        payload = ("[" + ",".join(_last_n(STREAM_PATH, WINDOW)) + "]").encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _serve_events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        # Replay last window then tail
        offset = STREAM_PATH.stat().st_size if STREAM_PATH.exists() else 0
        try:
            for line in _last_n(STREAM_PATH, WINDOW):
                self.wfile.write(f"data: {line}\n\n".encode())
            self.wfile.flush()
            for new_offset, line in _tail(STREAM_PATH, offset):
                self.wfile.write(f"data: {line}\n\n".encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            return


def main(port: int = 8787):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"life-os dashboard → http://127.0.0.1:{port}")
    print(f"tailing {STREAM_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    import sys
    p = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    main(p)
