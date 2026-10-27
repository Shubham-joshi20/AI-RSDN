from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class MetricSample:
    metric: str
    value: float
    unit: str
    source: str
    quality: str = "valid"
    detail: str | None = None

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


class PingProbe:
    def __init__(self, executable: str | None = None) -> None:
        self.executable = executable or shutil.which("ping") or "ping"

    def measure(self, host: str, count: int = 4, timeout_seconds: int = 2) -> list[MetricSample]:
        command = [self.executable, "-n", str(count), host] if _is_windows_ping() else [
            self.executable, "-c", str(count), "-W", str(timeout_seconds), host
        ]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=count * timeout_seconds + 5)
        output = f"{completed.stdout}\n{completed.stderr}"
        if completed.returncode != 0:
            return [MetricSample("rtt", 0.0, "ms", "ping", "invalid", output.strip()[-240:])]
        average = _parse_average_rtt(output)
        loss = _parse_loss(output)
        if average is None or loss is None:
            return [MetricSample("rtt", 0.0, "ms", "ping", "invalid", "Could not parse ping output.")]
        return [
            MetricSample("rtt", average, "ms", "ping"),
            MetricSample("packet_loss", loss, "%", "ping"),
        ]


class Iperf3Runner:
    """Runs iperf3 in JSON mode; server lifecycle is intentionally explicit."""

    def __init__(self, executable: str | None = None) -> None:
        self.executable = executable or shutil.which("iperf3") or "iperf3"
        self.server: subprocess.Popen[str] | None = None

    @property
    def available(self) -> bool:
        return shutil.which(self.executable) is not None

    def start_server(self, port: int = 5201) -> dict[str, object]:
        if not self.available:
            raise RuntimeError("iperf3 is unavailable on this host")
        if self.server and self.server.poll() is None:
            return {"status": "running", "pid": self.server.pid, "port": port}
        self.server = subprocess.Popen(
            [self.executable, "-s", "-p", str(port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        return {"status": "starting", "pid": self.server.pid, "port": port}

    def stop_server(self) -> dict[str, str]:
        if self.server and self.server.poll() is None:
            self.server.terminate()
            self.server.wait(timeout=5)
            self.server = None
            return {"status": "stopped"}
        return {"status": "not_running"}

    def measure(self, host: str, duration_seconds: int = 5, port: int = 5201) -> list[MetricSample]:
        if not self.available:
            return [MetricSample("throughput", 0.0, "Mbps", "iperf3", "unavailable", "Install iperf3 on Linux.")]
        command = [self.executable, "-c", host, "-p", str(port), "-t", str(duration_seconds), "-J"]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=duration_seconds + 15)
        if completed.returncode != 0:
            return [MetricSample("throughput", 0.0, "Mbps", "iperf3", "invalid", completed.stderr[-240:])]
        try:
            payload = json.loads(completed.stdout)
            summary = payload["end"].get("sum_received") or payload["end"]["sum_sent"]
            return [
                MetricSample("throughput", float(summary["bits_per_second"]) / 1_000_000, "Mbps", "iperf3"),
                MetricSample("bytes", float(summary["bytes"]), "bytes", "iperf3"),
            ]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            return [MetricSample("throughput", 0.0, "Mbps", "iperf3", "invalid", str(error))]


class NFStreamCollector:
    """Collects flow records when NFStream is installed on the capture host."""

    @property
    def available(self) -> bool:
        return shutil.which("python") is not None and _module_available("nfstream")

    def collect(self, interface: str) -> list[dict[str, Any]]:
        if not self.available:
            return []
        from nfstream import NFStreamer  # type: ignore[import-not-found]

        frame = NFStreamer(source=interface, statistical_analysis=True).to_pandas()
        return json.loads(frame.to_json(orient="records"))


def _module_available(name: str) -> bool:
    try:
        __import__(name)
    except ImportError:
        return False
    return True


def _is_windows_ping() -> bool:
    return sys.platform.startswith("win")


def _parse_average_rtt(output: str) -> float | None:
    match = re.search(r"(?:Average|avg)[^=]*=\s*([0-9.]+)\s*ms|=\s*[0-9.]+/([0-9.]+)/", output, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1) or match.group(2))


def _parse_loss(output: str) -> float | None:
    match = re.search(r"([0-9.]+)%\s*(?:packet )?loss", output, re.IGNORECASE)
    return float(match.group(1)) if match else 0.0
