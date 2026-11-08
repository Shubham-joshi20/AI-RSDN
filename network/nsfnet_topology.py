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
    # Switch-to-switch links transcribed from Fig. 1 of the supplied paper.
    # Switch IDs already match the figure (s0 through s13).
    (0, 1), (0, 2), (0, 3),
    (1, 2), (1, 8),
    (2, 5),
    (3, 4),
    (4, 5), (4, 6),
    (5, 12), (5, 13),
    (6, 7),
    (7, 10),
    (8, 9), (8, 11),
    (9, 10), (9, 12),
    (10, 11), (10, 13),
    (11, 12),
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
