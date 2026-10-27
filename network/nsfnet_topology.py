"""Real Mininet topology for the AIRSDN NSFNET-style experiment.

Run on Ubuntu/WSL2 with Mininet and Open vSwitch installed:
    sudo mn --custom network/nsfnet_topology.py --topo nsfnet \
        --controller remote --switch ovsk,protocols=OpenFlow13
"""

try:
    from mininet.link import TCLink
    from mininet.topo import Topo
except ImportError as error:  # pragma: no cover - exercised only on Mininet hosts
    TCLink = None
    Topo = None
    _MININET_IMPORT_ERROR = error
else:
    _MININET_IMPORT_ERROR = None


LINKS = (
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


if Topo is not None:
    class NsfnetTopo(Topo):
        """14-switch topology with client h0 and server h9."""

        def build(self) -> None:
            switches = {node: self.addSwitch(f"s{node}", protocols="OpenFlow13") for node in range(14)}
            client = self.addHost("h0", ip="10.0.0.1/24")
            server = self.addHost("h9", ip="10.0.0.9/24")
            self.addLink(client, switches[0], cls=TCLink, bw=100, delay="1ms")
            self.addLink(server, switches[9], cls=TCLink, bw=100, delay="1ms")
            for left, right in LINKS:
                self.addLink(switches[left], switches[right], cls=TCLink, bw=100, delay="5ms", loss=0)


    topos = {"nsfnet": lambda: NsfnetTopo()}
else:
    class NsfnetTopo:  # type: ignore[no-redef]
        def __init__(self) -> None:
            raise RuntimeError(f"Mininet is required to construct this topology: {_MININET_IMPORT_ERROR}")

    topos = {}
