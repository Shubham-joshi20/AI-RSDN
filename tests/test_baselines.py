import unittest

from backend.demo import build_candidates
from backend.routing import NetworkTopology, choose_route, compare_strategies


class BaselineComparisonTests(unittest.TestCase):
    def test_all_strategies_use_the_same_candidate_set(self) -> None:
        topology = NetworkTopology()
        paths = topology.shortest_paths(0, 9, limit=5)
        candidates = build_candidates("high", paths)
        decision = choose_route(candidates)
        comparison = compare_strategies(candidates, decision)

        self.assertEqual(set(comparison), {"hop_count", "qos_aware", "airsdn"})
        self.assertEqual(comparison["hop_count"]["selected_path_id"], "-".join(map(str, paths[0])))
        self.assertEqual(comparison["airsdn"]["selected_path_id"], "-".join(map(str, decision.selected_path)))
        self.assertTrue(all("throughput_mbps" in result for result in comparison.values()))

    def test_demo_exposes_baseline_results(self) -> None:
        from backend.demo import run_demo

        result = run_demo("low")
        self.assertEqual(result["baselines"]["airsdn"]["strategy"], "ML_ROUTING")
        self.assertEqual(set(result["baselines"]), {"hop_count", "qos_aware", "airsdn"})


if __name__ == "__main__":
    unittest.main()
