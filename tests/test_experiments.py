import unittest

from backend.experiments import ExperimentStore


class ExperimentStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = ExperimentStore()

    def test_create_records_decision_timeline(self) -> None:
        run = self.store.create("high")

        self.assertEqual(run.status, "completed")
        self.assertEqual(run.result["decision"]["mode"], "QOE_FALLBACK")
        self.assertEqual(len(run.events), 5)
        self.assertEqual(run.events[0]["type"], "run.started")
        self.assertEqual(run.events[-1]["type"], "run.completed")

    def test_custom_threshold_controls_decision(self) -> None:
        run = self.store.create("low", confidence_threshold=0.99)

        self.assertEqual(run.result["decision"]["threshold"], 0.99)
        self.assertEqual(run.result["decision"]["mode"], "QOE_FALLBACK")

    def test_history_and_reset(self) -> None:
        run = self.store.create("low")

        self.assertEqual(self.store.list_runs()[0]["id"], run.run_id)
        self.assertEqual(self.store.reset(run.run_id), {"id": run.run_id, "status": "reset"})
        self.assertEqual(self.store.list_runs(), [])
        with self.assertRaises(KeyError):
            self.store.get(run.run_id)


if __name__ == "__main__":
    unittest.main()
