# AIRSDN Real Network Integration

The repository now contains real adapters for Mininet, Floodlight, iperf3, ping, and NFStream. The Windows development UI remains usable in simulation mode, while the real network experiment should run on Ubuntu 20.04+ or a Linux VM.

## Windows Simulation Environment

For Windows, run `setup_windows.ps1` from the repository root. It creates `.venv`, installs `requirements.txt`, and runs the backend tests. Then use `run_backend_windows.ps1` and `run_frontend_windows.ps1`. This mode provides the deterministic routing experiment, full step-by-step visualization, run history, and real Windows ping probing. It reports Linux-only tools as unavailable instead of pretending they are active.

## 1. Recommended Environment

Use a Linux VM or native Ubuntu for the experiment host. WSL2 can work, but Mininet and Open vSwitch require kernel and privilege support; a VM is usually easier for a stable demonstration.

Install the base tools:

```bash
sudo apt update
sudo apt install -y git openvswitch-switch mininet iperf3 openjdk-8-jdk python3-pip
python3 -m pip install nfstream requests scikit-learn numpy
```

Confirm the tools:

```bash
which mn ovs-vsctl iperf3 java
python3 -c "import nfstream, sklearn, numpy; print('Python telemetry dependencies: OK')"
```

## 2. Start Floodlight

Build and start the Floodlight version selected by the team. Confirm that the REST endpoint responds:

```bash
curl http://127.0.0.1:8080/wm/core/controller/switches/json
```

The expected response is a JSON list. An empty list means Floodlight is reachable but no Mininet switch is connected yet.

## 3. Start the Real Mininet Topology

From the repository root on Linux:

```bash
sudo mn -c
sudo mn --custom network/nsfnet_topology.py --topo nsfnet \
  --controller remote --controller-ip 127.0.0.1 --controller-port 6653 \
  --switch ovsk,protocols=OpenFlow13
```

Inside the Mininet CLI, verify the network:

```text
pingall
h0 ping -c 4 h9
net
```

The topology uses switches `s0` through `s13`, client `h0`, and server `h9`. The Python adapter in `backend/integration/mininet.py` uses the same topology definition.

## 4. Test iperf3 Traffic

In Mininet, start a server on the destination:

```text
h9 iperf3 -s -p 5201 &
```

Generate a TCP multimedia-like flow from the source:

```text
h0 iperf3 -c 10.0.0.9 -p 5201 -t 10 -J
```

The backend parser reads JSON mode and records throughput and byte count without turning failed commands into fake zero measurements.

## 5. Test Ping Telemetry

```text
h0 ping -c 10 10.0.0.9
```

The telemetry adapter extracts average RTT and packet loss. Invalid or missing output is marked with `quality=invalid`.

## 6. Test NFStream

Find the Mininet interface with:

```text
h0 ip link
```

Then capture flows on the relevant interface from the Linux experiment host:

```bash
python3 -c "from backend.integration.telemetry import NFStreamCollector; print(NFStreamCollector().collect('h0-eth0'))"
```

NFStream must be installed on the same Linux host that can see the traffic interface. Its records are flow-level observations and should be associated with the experiment ID before routing decisions use them.

## 7. Check Backend Capability Reporting

Start the backend:

```bash
python3 -m backend.server
```

Open:

```text
http://127.0.0.1:8000/api/integration/status
```

The response reports each dependency as `available` or `unavailable`, the execution mode (`real` or `simulation`), and an explanation. The frontend shows this status at the top of the Visualization page.

## 8. Current Boundary

The real adapters and Mininet topology are implemented, but the current experiment store still runs the deterministic routing demo. The next wiring step is to inject `MetricSample` records from Mininet probes into `PathMetrics`, call Floodlight flow installation for the selected path, and stream those event updates to the dashboard.

This boundary is intentional: the UI must never claim real traffic when the backend has not successfully connected to Mininet, Floodlight, iperf3, and NFStream.
