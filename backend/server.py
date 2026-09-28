from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from backend.demo import run_demo


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
