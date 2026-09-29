from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from backend.demo import run_demo
from backend.experiments import store


class ApiHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        request = urlparse(self.path)
        if request.path == "/api/health":
            self._send_json({"status": "ok", "service": "airsdn-routing"})
            return
        if request.path == "/api/runs":
            self._send_json({"runs": store.list_runs()})
            return
        if request.path.startswith("/api/runs/"):
            self._handle_run_get(request.path)
            return
        if request.path == "/api/demo":
            scenario = parse_qs(request.query).get("scenario", ["low"])[0]
            if scenario not in {"low", "high"}:
                self._send_json({"error": "scenario must be low or high"}, status=400)
                return
            self._send_json(run_demo(scenario))
            return
        self._send_json({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        request = urlparse(self.path)
        try:
            if request.path == "/api/runs":
                payload = self._read_json()
                scenario = payload.get("scenario", "low")
                threshold = float(payload.get("confidence_threshold", 0.90))
                run = store.create(str(scenario), threshold)
                self._send_json(run.as_dict(), status=201)
                return

            parts = request.path.rstrip("/").split("/")
            if len(parts) == 5 and parts[:3] == ["", "api", "runs"]:
                run_id, action = parts[3], parts[4]
                if action == "stop":
                    self._send_json(store.stop(run_id).as_dict())
                    return
                if action == "reset":
                    self._send_json(store.reset(run_id))
                    return
            self._send_json({"error": "not found"}, status=404)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            self._send_json({"error": str(error)}, status=400)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._add_cors_headers()
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        print(f"[api] {format % args}")

    def _handle_run_get(self, path: str) -> None:
        parts = path.rstrip("/").split("/")
        if len(parts) not in {4, 5} or parts[:3] != ["", "api", "runs"]:
            self._send_json({"error": "not found"}, status=404)
            return
        run_id = parts[3]
        if len(parts) == 5 and parts[4] != "export":
            self._send_json({"error": "not found"}, status=404)
            return
        try:
            self._send_json(store.get(run_id).as_dict())
        except KeyError:
            self._send_json({"error": f"run {run_id} not found"}, status=404)

    def _read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise TypeError("request body must be a JSON object")
        return payload

    def _send_json(self, payload: dict[str, object], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._add_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _add_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")


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
