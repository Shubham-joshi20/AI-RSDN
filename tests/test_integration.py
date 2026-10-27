import unittest

from backend.integration import Iperf3Runner, NFStreamCollector, integration_status
from backend.integration.telemetry import _parse_average_rtt, _parse_loss


class IntegrationTests(unittest.TestCase):
    def test_capability_report_has_all_real_components(self) -> None:
        report = integration_status("http://127.0.0.1:9")
        names = {tool["name"] for tool in report["tools"]}
        self.assertEqual(names, {"mininet", "iperf3", "openvswitch", "java", "nfstream", "floodlight"})
        self.assertIn(report["mode"], {"real", "simulation"})

    def test_ping_parsers_handle_linux_output(self) -> None:
        output = "4 packets transmitted, 4 received, 0% packet loss\nrtt min/avg/max/mdev = 1.2/2.3/4.0/0.4 ms"
        self.assertEqual(_parse_average_rtt(output), 2.3)
        self.assertEqual(_parse_loss(output), 0.0)

    def test_unavailable_tools_return_explicit_status(self) -> None:
        runner = Iperf3Runner(executable="definitely-missing-iperf3")
        self.assertFalse(runner.available)
        self.assertIsInstance(NFStreamCollector().available, bool)
        self.assertEqual(runner.measure("127.0.0.1")[0].quality, "unavailable")


if __name__ == "__main__":
    unittest.main()
