from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ACTION_PRIORITY = 32768


@dataclass(frozen=True)
class FloodlightResponse:
    ok: bool
    status: int | None
    data: object
    error: str | None = None


class FloodlightClient:
    """Small REST client for Floodlight core and Static Flow Pusher APIs."""

    def __init__(self, base_url: str = "http://127.0.0.1:8080", timeout: float = 3.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def get_switches(self) -> FloodlightResponse:
        return self._request("GET", "/wm/core/controller/switches/json")

    def get_switch_ports(self, switch_id: str) -> FloodlightResponse:
        return self._request("GET", f"/wm/core/switch/{switch_id}/port-desc/json")

    def install_flow(
        self,
        switch_id: str,
        flow_name: str,
        match: dict[str, object],
        actions: list[str],
        priority: int = ACTION_PRIORITY,
    ) -> FloodlightResponse:
        payload = {
            "switch": switch_id,
            "name": flow_name,
            "cookie": "0",
            "priority": str(priority),
            "active": "true",
            "actions": ",".join(actions),
            **{key: str(value) for key, value in match.items()},
        }
        return self._request("POST", "/wm/staticflowpusher/json", payload)

    def delete_flow(self, flow_name: str) -> FloodlightResponse:
        return self._request("DELETE", f"/wm/staticflowpusher/json", {"name": flow_name})

    def _request(self, method: str, path: str, payload: dict[str, object] | None = None) -> FloodlightResponse:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            data=body,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                return FloodlightResponse(True, response.status, _decode(raw))
        except HTTPError as error:
            return FloodlightResponse(False, error.code, _decode(error.read().decode("utf-8")), str(error))
        except (OSError, URLError) as error:
            return FloodlightResponse(False, None, None, str(error))


def _decode(value: str) -> object:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value
