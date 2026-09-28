from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TopologyValidation:
    node_count: int
    edge_count: int
    connected: bool
    reference_paths: dict[str, bool]

    @property
    def passed(self) -> bool:
        return self.node_count == 14 and self.connected and all(self.reference_paths.values())


class NetworkTopology:
    """Deterministic NSFNET-style graph used by the first evaluation slice."""

    def __init__(self) -> None:
        self._adjacency: dict[int, set[int]] = {node: set() for node in range(14)}
        links = (
            (0, 1), (0, 2), (0, 3),
            (1, 4), (1, 5), (1, 7),
            (2, 5), (2, 6),
            (3, 8),
            (4, 9),
            (5, 7), (5, 10), (5, 13),
            (6, 11),
            (7, 10), (7, 12),
            (8, 9), (8, 12),
            (9, 10),
            (10, 13),
            (11, 12),
            (12, 13),
        )
        for left, right in links:
            self._adjacency[left].add(right)
            self._adjacency[right].add(left)

    @property
    def nodes(self) -> tuple[int, ...]:
        return tuple(sorted(self._adjacency))

    @property
    def edge_count(self) -> int:
        return sum(len(neighbors) for neighbors in self._adjacency.values()) // 2

    @property
    def links(self) -> tuple[tuple[int, int], ...]:
        return tuple(
            (left, right)
            for left in self.nodes
            for right in self._adjacency[left]
            if left < right
        )

    def neighbors(self, node: int) -> tuple[int, ...]:
        self._validate_node(node)
        return tuple(sorted(self._adjacency[node]))

    def shortest_paths(self, source: int, destination: int, limit: int = 5) -> list[tuple[int, ...]]:
        if limit < 1:
            raise ValueError("limit must be at least 1")
        self._validate_node(source)
        self._validate_node(destination)
        if source == destination:
            return [(source,)]

        paths: list[tuple[int, ...]] = []

        def visit(current: int, path: tuple[int, ...]) -> None:
            if current == destination:
                paths.append(path)
                return
            for neighbor in self.neighbors(current):
                if neighbor not in path:
                    visit(neighbor, path + (neighbor,))

        visit(source, (source,))
        paths.sort(key=lambda path: (len(path), path))
        return paths[:limit]

    def validate(self) -> TopologyValidation:
        reference_paths = {
            "3-hop": (0, 3, 8, 9),
            "4-hop": (0, 1, 7, 10, 9),
            "5-hop": (0, 2, 5, 13, 10, 9),
        }
        reachable = set()
        pending = [0]
        while pending:
            node = pending.pop()
            if node in reachable:
                continue
            reachable.add(node)
            pending.extend(self._adjacency[node] - reachable)

        return TopologyValidation(
            node_count=len(self.nodes),
            edge_count=self.edge_count,
            connected=len(reachable) == len(self.nodes),
            reference_paths={
                name: self._is_valid_path(path)
                for name, path in reference_paths.items()
            },
        )

    def _is_valid_path(self, path: tuple[int, ...]) -> bool:
        return all(right in self._adjacency[left] for left, right in zip(path, path[1:]))

    def _validate_node(self, node: int) -> None:
        if node not in self._adjacency:
            raise ValueError(f"unknown node: {node}")
