from __future__ import annotations

from typing import Any

from .telemetry import Iperf3Runner, MetricSample, PingProbe


class LiveProbeRunner:
    """Collects real host probes without converting unavailable data to fake values."""

    def __init__(self) -> None:
        self.ping = PingProbe()
        self.iperf = Iperf3Runner()

    def probe(self, host: str, count: int = 4, duration_seconds: int = 5) -> dict[str, Any]:
        samples = self.ping.measure(host, count=count)
        samples.extend(self.iperf.measure(host, duration_seconds=duration_seconds))
        return {
            "host": host,
            "metrics": [sample.as_dict() for sample in samples],
            "source": "live probes",
            "has_valid_data": any(sample.quality == "valid" for sample in samples),
        }


def samples_as_dict(samples: list[MetricSample]) -> list[dict[str, object]]:
    return [sample.as_dict() for sample in samples]
