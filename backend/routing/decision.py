from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class PathMetrics:
    path: tuple[int, ...]
    latency_ms: float
    throughput_mbps: float
    packet_loss_pct: float
    jitter_ms: float
    utilization_pct: float
    predicted_traffic: str
    confidence: float
    qoe_score: float = 0.0

    @property
    def path_id(self) -> str:
        return "-".join(map(str, self.path))

    @property
    def hop_count(self) -> int:
        return len(self.path) - 1

    def as_dict(self) -> dict[str, object]:
        value = asdict(self)
        value["path"] = list(self.path)
        value["path_id"] = self.path_id
        value["hop_count"] = self.hop_count
        return value


@dataclass(frozen=True)
class RoutingDecision:
    mode: str
    selected_path: tuple[int, ...]
    reason: str
    threshold: float
    selected_confidence: float
    candidates: tuple[PathMetrics, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "mode": self.mode,
            "selected_path": list(self.selected_path),
            "selected_path_id": "-".join(map(str, self.selected_path)),
            "reason": self.reason,
            "threshold": self.threshold,
            "selected_confidence": self.selected_confidence,
            "candidates": [candidate.as_dict() for candidate in self.candidates],
        }


def _with_qoe_scores(candidates: list[PathMetrics]) -> list[PathMetrics]:
    def normalize(values: list[float], value: float, reverse: bool = False) -> float:
        lowest = min(values)
        highest = max(values)
        if highest == lowest:
            return 1.0
        score = (value - lowest) / (highest - lowest)
        return 1.0 - score if reverse else score

    latency = [candidate.latency_ms for candidate in candidates]
    throughput = [candidate.throughput_mbps for candidate in candidates]
    loss = [candidate.packet_loss_pct for candidate in candidates]
    jitter = [candidate.jitter_ms for candidate in candidates]
    utilization = [candidate.utilization_pct for candidate in candidates]

    scored: list[PathMetrics] = []
    for index, candidate in enumerate(candidates):
        score = (
            0.35 * normalize(throughput, candidate.throughput_mbps)
            + 0.25 * normalize(latency, candidate.latency_ms, reverse=True)
            + 0.15 * normalize(loss, candidate.packet_loss_pct, reverse=True)
            + 0.10 * normalize(jitter, candidate.jitter_ms, reverse=True)
            + 0.15 * normalize(utilization, candidate.utilization_pct, reverse=True)
        )
        scored.append(PathMetrics(**{**candidate.__dict__, "qoe_score": round(score, 4)}))
    return scored


def choose_route(
    candidates: list[PathMetrics],
    confidence_threshold: float = 0.90,
) -> RoutingDecision:
    if not candidates:
        raise ValueError("at least one candidate path is required")
    if not 0.0 <= confidence_threshold <= 1.0:
        raise ValueError("confidence_threshold must be between 0 and 1")

    scored = _with_qoe_scores(candidates)
    ml_candidates = [
        candidate
        for candidate in scored
        if candidate.predicted_traffic == "low" and candidate.confidence >= confidence_threshold
    ]
    if ml_candidates:
        selected = max(ml_candidates, key=lambda candidate: (candidate.confidence, candidate.qoe_score))
        return RoutingDecision(
            mode="ML_ROUTING",
            selected_path=selected.path,
            reason=(
                f"low-traffic prediction confidence {selected.confidence:.2f} "
                f">= threshold {confidence_threshold:.2f}"
            ),
            threshold=confidence_threshold,
            selected_confidence=selected.confidence,
            candidates=tuple(scored),
        )

    selected = max(scored, key=lambda candidate: (candidate.qoe_score, -candidate.hop_count))
    return RoutingDecision(
        mode="QOE_FALLBACK",
        selected_path=selected.path,
        reason=(
            f"no low-traffic candidate met confidence threshold {confidence_threshold:.2f}; "
            "selected highest QoE score"
        ),
        threshold=confidence_threshold,
        selected_confidence=selected.confidence,
        candidates=tuple(scored),
    )
