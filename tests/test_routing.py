import unittest

from backend.demo import build_candidates
from backend.routing import NetworkTopology, choose_route


class RoutingCoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.topology = NetworkTopology()
        self.paths = self.topology.shortest_paths(0, 9, limit=5)

    def test_topology_matches_first_evaluation_contract(self) -> None:
        validation = self.topology.validate()
        self.assertTrue(validation.passed)
        self.assertEqual(validation.node_count, 14)
        self.assertTrue(all(validation.reference_paths.values()))

    def test_candidate_paths_are_unique_and_sorted_by_hops(self) -> None:
        self.assertLessEqual(len(self.paths), 5)
        self.assertEqual(len(self.paths), len(set(self.paths)))
        hop_counts = [len(path) for path in self.paths]
        self.assertEqual(hop_counts, sorted(hop_counts))

    def test_high_confidence_candidate_uses_ml_route(self) -> None:
        decision = choose_route(build_candidates("low", self.paths))
        self.assertEqual(decision.mode, "ML_ROUTING")
        self.assertEqual(decision.selected_path, self.paths[0])

    def test_low_confidence_candidates_use_qoe_fallback(self) -> None:
        decision = choose_route(build_candidates("high", self.paths))
        self.assertEqual(decision.mode, "QOE_FALLBACK")
        self.assertIn("confidence threshold", decision.reason)
        self.assertTrue(all(candidate.qoe_score >= 0 for candidate in decision.candidates))


if __name__ == "__main__":
    unittest.main()
