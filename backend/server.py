from __future__ import annotations

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from backend.demo import run_demo

_stream_started_at = time.monotonic()


class ApiHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        request = urlparse(self.path)
        if request.path == "/api/health":
            self._send_json({"status": "ok", "service": "airsdn-routing"})
            return
        if request.path == "/api/demo":
            scenario = parse_qs(request.query).get("scenario", ["low"])[0]
            if scenario not in {"low", "high"}:
                self._send_json({"error": "scenario must be low or high"}, status=400)
                return
            self._send_json(run_demo(scenario))
            return
        if request.path == "/api/stream":
            scenario = parse_qs(request.query).get("scenario", ["low"])[0]
            forwarding = parse_qs(request.query).get("forwarding", ["false"])[0].lower() in {"1", "true", "yes"}
            if scenario not in {"low", "high"}:
                self._send_json({"error": "scenario must be low or high"}, status=400)
                return
            result = run_demo(scenario)
            elapsed = time.monotonic() - _stream_started_at if forwarding else 0.0
            route = result["decision"]["selected_path"]
            # Do not create packet events before the route-selection stage.
            result["stream"] = {
                "mode": "simulation",
                "forwarding": forwarding,
                "running_seconds": round(elapsed, 1),
                "packets": [
                    {"id": f"pkt-{index + 1}", "path": route,
                     "progress": round(((elapsed / 3.8 + index / 6) % 1), 3)}
                    for index in range(6)
                ] if forwarding else [],
            }
            self._send_json(result)
            return
        self._send_json({"error": "not found"}, status=404)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[api] {format % args}")

    def _send_json(self, payload: dict[str, object], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), ApiHandler)
    print("AIRSDN API listening at http://127.0.0.1:8000")
    print("Try http://127.0.0.1:8000/api/demo?scenario=low")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping AIRSDN API")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
