from __future__ import annotations

from dataclasses import dataclass

from .decision import PathMetrics, RoutingDecision, _with_qoe_scores


@dataclass(frozen=True)
class BaselineResult:
    strategy: str
    selected_path: tuple[int, ...]
    selected_path_id: str
    reason: str
    hop_count: int
    latency_ms: float
    throughput_mbps: float
    packet_loss_pct: float
    jitter_ms: float
    utilization_pct: float

    def as_dict(self) -> dict[str, object]:
        return {
            "strategy": self.strategy,
            "selected_path": list(self.selected_path),
            "selected_path_id": self.selected_path_id,
            "reason": self.reason,
            "hop_count": self.hop_count,
            "latency_ms": self.latency_ms,
            "throughput_mbps": self.throughput_mbps,
            "packet_loss_pct": self.packet_loss_pct,
            "jitter_ms": self.jitter_ms,
            "utilization_pct": self.utilization_pct,
        }


def compare_strategies(
    candidates: list[PathMetrics],
    ai_decision: RoutingDecision,
) -> dict[str, dict[str, object]]:
    """Compare all strategies using the exact same measured candidate rows."""
    if not candidates:
        raise ValueError("at least one candidate path is required")
    scored = _with_qoe_scores(candidates)
    hop_count = min(scored, key=lambda candidate: (candidate.hop_count, candidate.path))
    qos_aware = max(scored, key=lambda candidate: (candidate.qoe_score, -candidate.hop_count))
    ai_candidate = next(candidate for candidate in scored if candidate.path == ai_decision.selected_path)
    return {
        "hop_count": _result(hop_count, "HOP_COUNT", "selected the fewest-hop candidate").as_dict(),
        "qos_aware": _result(qos_aware, "QOS_AWARE", "selected the highest QoE score").as_dict(),
        "airsdn": _result(ai_candidate, ai_decision.mode, ai_decision.reason).as_dict(),
    }


def _result(candidate: PathMetrics, strategy: str, reason: str) -> BaselineResult:
    return BaselineResult(
        strategy=strategy,
        selected_path=candidate.path,
        selected_path_id=candidate.path_id,
        reason=reason,
        hop_count=candidate.hop_count,
        latency_ms=candidate.latency_ms,
        throughput_mbps=candidate.throughput_mbps,
        packet_loss_pct=candidate.packet_loss_pct,
        jitter_ms=candidate.jitter_ms,
        utilization_pct=candidate.utilization_pct,
    )
