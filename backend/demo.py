from __future__ import annotations

import argparse
import json
from dataclasses import asdict

from backend.routing import NetworkTopology, PathMetrics, choose_route


def build_candidates(scenario: str, paths: list[tuple[int, ...]]) -> list[PathMetrics]:
    candidates: list[PathMetrics] = []
    for index, path in enumerate(paths):
        if scenario == "low" and index == 0:
            latency, throughput, loss, jitter, utilization = 18.0, 92.0, 0.2, 1.1, 30.0
            predicted, confidence = "low", 0.96
        elif scenario == "low":
            latency = 28.0 + index * 4.0
            throughput = 78.0 - index * 5.0
            loss, jitter, utilization = 0.6 + index * 0.2, 2.0 + index * 0.4, 48.0 + index * 6.0
            predicted, confidence = "high", 0.72
        elif scenario == "high" and index == 1:
            latency, throughput, loss, jitter, utilization = 24.0, 88.0, 0.4, 1.8, 48.0
            predicted, confidence = "low", 0.86
        else:
            latency = 42.0 + index * 5.0
            throughput = 55.0 - index * 3.0
            loss, jitter, utilization = 2.0 + index * 0.4, 4.0 + index * 0.6, 78.0 + index * 3.0
            predicted, confidence = "high", 0.64
        candidates.append(
            PathMetrics(
                path=path,
                latency_ms=latency,
                throughput_mbps=throughput,
                packet_loss_pct=loss,
                jitter_ms=jitter,
                utilization_pct=utilization,
                predicted_traffic=predicted,
                confidence=confidence,
            )
        )
    return candidates


def run_demo(scenario: str, confidence_threshold: float = 0.90) -> dict[str, object]:
    if scenario not in {"low", "high"}:
        raise ValueError("scenario must be low or high")
    topology = NetworkTopology()
    validation = topology.validate()
    if not validation.passed:
        raise RuntimeError(f"topology validation failed: {validation}")

    paths = topology.shortest_paths(0, 9, limit=5)
    decision = choose_route(build_candidates(scenario, paths), confidence_threshold)
    return {
        "scenario": scenario,
        "nodes": [{"id": node, "label": f"S{node}"} for node in topology.nodes],
        "links": [{"source": left, "target": right} for left, right in topology.links],
        "topology": asdict(validation),
        "source": 0,
        "destination": 9,
        "candidate_count": len(paths),
        "decision": decision.as_dict(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AIRSDN first-evaluation routing demo.")
    parser.add_argument("--scenario", choices=("low", "high", "both"), default="both")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args()

    scenarios = ("low", "high") if args.scenario == "both" else (args.scenario,)
    results = [run_demo(scenario) for scenario in scenarios]
    if args.json:
        print(json.dumps(results, indent=2))
        return

    for result in results:
        decision = result["decision"]
        print(f"Scenario: {result['scenario'].upper()}")
        print(
            f"Topology: {result['topology']['node_count']} nodes, "
            f"{result['topology']['edge_count']} links, validation PASS"
        )
        print(f"Candidates: {result['candidate_count']} shortest paths from 0 to 9")
        print(f"Decision: {decision['mode']}")
        print(f"Selected path: {' -> '.join(map(str, decision['selected_path']))}")
        print(f"Reason: {decision['reason']}")
        print()


if __name__ == "__main__":
    main()
