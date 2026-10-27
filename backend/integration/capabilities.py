from __future__ import annotations

import importlib.util
import shutil
from dataclasses import asdict, dataclass
from urllib.error import URLError
from urllib.request import urlopen


@dataclass(frozen=True)
class ToolStatus:
    name: str
    available: bool
    source: str | None
    detail: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def integration_status(floodlight_url: str = "http://127.0.0.1:8080") -> dict[str, object]:
    tools = [
        _binary_status("mininet", "mn", "Install Mininet inside Ubuntu/WSL2."),
        _binary_status("iperf3", "iperf3", "Install iperf3 on the Linux experiment host."),
        _binary_status("openvswitch", "ovs-vsctl", "Install and start Open vSwitch."),
        _binary_status("java", "java", "Floodlight requires a compatible Java runtime."),
        ToolStatus(
            name="nfstream",
            available=importlib.util.find_spec("nfstream") is not None,
            source="python module" if importlib.util.find_spec("nfstream") else None,
            detail="Ready for flow capture." if importlib.util.find_spec("nfstream") else "Install with pip install nfstream.",
        ),
        _floodlight_status(floodlight_url),
    ]
    return {
        "mode": "real" if all(tool.available for tool in tools) else "simulation",
        "floodlight_url": floodlight_url,
        "tools": [tool.as_dict() for tool in tools],
        "limitations": [
            "Mininet and Open vSwitch require Linux privileges and are not native Windows processes.",
            "The simulator is used only when a real integration tool is unavailable; missing telemetry is never converted to zero.",
        ],
    }


def _binary_status(name: str, executable: str, install_hint: str) -> ToolStatus:
    source = shutil.which(executable)
    return ToolStatus(
        name=name,
        available=source is not None,
        source=source,
        detail="Ready." if source else install_hint,
    )


def _floodlight_status(base_url: str) -> ToolStatus:
    url = f"{base_url.rstrip('/')}/wm/core/controller/switches/json"
    try:
        with urlopen(url, timeout=1.5) as response:
            if 200 <= response.status < 300:
                return ToolStatus("floodlight", True, base_url, "Controller REST API responded.")
    except (OSError, URLError):
        pass
    return ToolStatus(
        "floodlight",
        False,
        None,
        f"No response from {base_url}; start Floodlight on the Linux experiment host.",
    )
