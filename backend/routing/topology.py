from __future__ import annotations

from dataclasses import dataclass

from network.nsfnet_topology import LINKS


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
    """14-switch topology transcribed from the paper's Mininet figure."""

    def __init__(self) -> None:
        self._adjacency: dict[int, set[int]] = {node: set() for node in range(14)}
        for left, right in LINKS:
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
            "3-hop": (0, 1, 8, 9),
            "4-hop": (0, 2, 5, 12, 9),
            "5-hop": (0, 1, 8, 11, 12, 9),
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
