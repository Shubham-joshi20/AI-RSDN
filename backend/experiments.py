from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from backend.demo import run_demo


@dataclass
class ExperimentRun:
    run_id: str
    scenario: str
    status: str
    created_at: str
    started_at: str
    completed_at: str | None
    config: dict[str, Any]
    result: dict[str, Any]
    events: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.run_id,
            "scenario": self.scenario,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "config": self.config,
            "result": self.result,
            "events": self.events,
        }

    def summary(self) -> dict[str, Any]:
        decision = self.result["decision"]
        return {
            "id": self.run_id,
            "scenario": self.scenario,
            "status": self.status,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "mode": decision["mode"],
            "selected_path_id": decision["selected_path_id"],
            "event_count": len(self.events),
        }


class ExperimentStore:
    """Thread-safe in-memory experiment history for the local research demo."""

    def __init__(self) -> None:
        self._runs: dict[str, ExperimentRun] = {}
        self._next_id = 1
        self._lock = Lock()

    def create(self, scenario: str, confidence_threshold: float = 0.90) -> ExperimentRun:
        if scenario not in {"low", "high"}:
            raise ValueError("scenario must be low or high")
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be between 0 and 1")

        now = _timestamp()
        with self._lock:
            run_id = f"run-{self._next_id:03d}"
            self._next_id += 1

        result = run_demo(scenario, confidence_threshold)
        events = [
            self._event(run_id, "run.started", {"scenario": scenario}),
            self._event(
                run_id,
                "topology.validated",
                {"node_count": result["topology"]["node_count"], "edge_count": result["topology"]["edge_count"]},
            ),
            self._event(
                run_id,
                "telemetry.updated",
                {"candidate_count": result["candidate_count"], "scenario": scenario},
            ),
            self._event(
                run_id,
                "routing.decision_made",
                {
                    "mode": result["decision"]["mode"],
                    "selected_path_id": result["decision"]["selected_path_id"],
                    "confidence": result["decision"]["selected_confidence"],
                },
            ),
        ]
        completed_at = _timestamp()
        events.append(self._event(run_id, "run.completed", {"status": "completed"}))
        experiment = ExperimentRun(
            run_id=run_id,
            scenario=scenario,
            status="completed",
            created_at=now,
            started_at=now,
            completed_at=completed_at,
            config={
                "source": result["source"],
                "destination": result["destination"],
                "candidate_limit": 5,
                "confidence_threshold": confidence_threshold,
                "routing_strategy": "confidence-aware with QoE fallback",
            },
            result=result,
            events=events,
        )
        with self._lock:
            self._runs[run_id] = experiment
        return experiment

    def list_runs(self) -> list[dict[str, Any]]:
        with self._lock:
            runs = list(self._runs.values())
        return [run.summary() for run in reversed(runs)]

    def get(self, run_id: str) -> ExperimentRun:
        with self._lock:
            run = self._runs.get(run_id)
        if run is None:
            raise KeyError(run_id)
        return run

    def stop(self, run_id: str) -> ExperimentRun:
        run = self.get(run_id)
        if run.status == "running":
            run.status = "stopped"
            run.completed_at = _timestamp()
            run.events.append(self._event(run_id, "run.stopped", {"status": "stopped"}))
        return run

    def reset(self, run_id: str) -> dict[str, str]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(run_id)
            del self._runs[run_id]
        return {"id": run_id, "status": "reset"}

    @staticmethod
    def _event(run_id: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "eventId": f"{run_id}:{event_type}",
            "runId": run_id,
            "timestamp": _timestamp(),
            "type": event_type,
            "payload": payload,
        }


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


store = ExperimentStore()
