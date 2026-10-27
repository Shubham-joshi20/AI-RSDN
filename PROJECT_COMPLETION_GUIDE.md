# AIRSDN Project Completion Guide

This guide explains how to run the project on Windows today, how to move to Ubuntu for real Mininet/Floodlight experiments, how to use Docker, and how to produce baseline evidence for the final report.

## 1. What Is Implemented Now

The repository currently provides:

- A deterministic 14-switch NSFNET-style routing graph.
- Up to five shortest candidate paths.
- Low-traffic and high-traffic experiment scenarios.
- QoE scoring using throughput, latency, loss, jitter, and utilization.
- Confidence-aware AIRSDN routing with a 90% threshold.
- Hop-count, QoS-aware, and AIRSDN comparison results using identical candidates.
- Experiment IDs, event history, JSON API, reset, and export responses.
- Slow frontend playback for topology, paths, telemetry, prediction, decision, flow update, and multimedia stages.
- Real adapters for Mininet, Floodlight REST, ping, iperf3, and NFStream.
- Capability reporting that distinguishes real tools from simulation.
- Windows Python virtual environment setup.

The current Windows run is a valid algorithm and visualization demonstration. It is not a claim of live Mininet traffic.

## 2. Choose the Execution Environment

### Recommended: Ubuntu virtual machine

Use Ubuntu 22.04 or Ubuntu 20.04 in VirtualBox or VMware. Give the VM at least:

- 4 CPU cores.
- 8 GB RAM.
- 40 GB disk.
- Internet access.
- A network mode that allows the Floodlight REST port to be reached.

This is the recommended option for the final professor demonstration because Mininet and Open vSwitch need Linux networking and privileges.

### Windows simulation

Use this when working on the current Windows machine. It supports the backend, UI, routing algorithm, experiment history, and local ping probing.

### Docker

Docker is optional, not required.

Docker is useful for:

- Running the Python backend consistently.
- Running the React frontend.
- Running a database or report service later.

Docker is not the easiest first choice for Mininet and Open vSwitch because they need host networking, kernel support, privileged containers, and careful interface access. Use an Ubuntu VM first. Add Docker only after the Linux experiment works directly.

## 3. Windows Setup and Demonstration

From PowerShell in the `AI-RSDN` folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_windows.ps1
```

Start the backend:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_backend_windows.ps1
```

Start the frontend in a second PowerShell window:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_frontend_windows.ps1
```

Open:

```text
http://localhost:5173/visualization
```

Demonstrate both scenarios:

1. Select low traffic and start an experiment.
2. Use Play slowly to explain each stage.
3. Show the AIRSDN result and the three-strategy baseline table.
4. Select high traffic and repeat.
5. Explain why the confidence threshold causes QoE fallback.
6. Use the topology layout buttons to change the visual arrangement.
7. Use the live probe panel to show real local ping or unavailable iperf3 status.

## 4. Ubuntu Installation

Open a terminal in Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git python3 python3-venv python3-pip \
  mininet openvswitch-switch iperf3 curl openjdk-8-jdk ant
```

Clone or copy the repository:

```bash
git clone <your-repository-url> AI-RSDN
cd AI-RSDN
```

Create and activate the backend environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-linux.txt
```

Confirm the base tools:

```bash
which mn
which ovs-vsctl
which iperf3
which java
python -c "import nfstream, sklearn, numpy; print('Python dependencies OK')"
```

## 5. Build and Start Floodlight

Use the Floodlight version selected by the team and record its commit/version in the final report.

Typical build flow:

```bash
git clone https://github.com/floodlight/floodlight.git
cd floodlight
ant
```

Start Floodlight using the command required by the selected version. Keep it running in its own terminal.

Verify the REST API:

```bash
curl http://127.0.0.1:8080/wm/core/controller/switches/json
```

An empty JSON list means Floodlight is running but no switch is connected yet. That is not an error at this stage.

## 6. Start the Real Mininet Topology

Open another Ubuntu terminal in the project root:

```bash
source .venv/bin/activate
sudo mn -c
sudo mn --custom network/nsfnet_topology.py --topo nsfnet \
  --controller remote --controller-ip 127.0.0.1 --controller-port 6653 \
  --switch ovsk,protocols=OpenFlow13
```

Inside the Mininet CLI:

```text
nodes
net
pingall
h0 ping -c 4 10.0.0.9
```

Expected topology:

- Switches: `s0` through `s13`.
- Source host: `h0`, address `10.0.0.1`.
- Destination host: `h9`, address `10.0.0.9`.
- 22 inter-switch links.

Do not close this terminal while testing the network.

## 7. Generate Real Traffic

Inside Mininet, start the iperf3 server:

```text
h9 iperf3 -s -p 5201 &
```

Generate a low-load flow:

```text
h0 iperf3 -c 10.0.0.9 -p 5201 -t 10 -b 10M -J
```

Generate a higher-load flow:

```text
h0 iperf3 -c 10.0.0.9 -p 5201 -t 10 -b 80M -J
```

Run background flows from additional Mininet hosts when the topology is extended with background clients. Save the JSON output for every run.

## 8. Collect Real Telemetry

Ping and packet loss:

```text
h0 ping -c 10 10.0.0.9
```

The backend `PingProbe` extracts average RTT and packet loss.

NFStream:

```bash
python -c "from backend.integration.telemetry import NFStreamCollector; print(NFStreamCollector().collect('s0-eth1'))"
```

Use the actual interface reported by `ip link`. Store flow records with:

- Run ID.
- Timestamp.
- Source and destination.
- Protocol.
- Bytes and packets.
- Duration.
- Throughput.
- Interface.

Missing or failed measurements must be marked invalid or unavailable. Never convert them to zero.

## 9. Start the AIRSDN Backend and UI

In a terminal outside the Mininet CLI:

```bash
cd AI-RSDN
source .venv/bin/activate
python -m backend.server
```

In another terminal:

```bash
cd AI-RSDN/FrontEnd
npm install
npm run dev -- --host 0.0.0.0
```

Open the frontend using the VM address:

```text
http://<ubuntu-ip>:5173/visualization
```

Check the integration panel:

```text
http://127.0.0.1:8000/api/integration/status
```

The panel should show Mininet, Open vSwitch, Java, iperf3, NFStream, and Floodlight as ready when each service is correctly running.

## 10. Baseline Experiment Procedure

Every strategy must use the same:

- Topology.
- Source and destination.
- Traffic load.
- Candidate paths.
- Measurement window.
- Video or TCP flow.
- Random seed where applicable.

Run these strategies:

### Baseline 1: Hop-count

Select the candidate with the fewest hops. This represents traditional shortest-path routing.

### Baseline 2: QoS-aware

Select the candidate with the best normalized QoE score using throughput, latency, loss, jitter, and utilization.

### AIRSDN

Use the ML prediction when confidence is at least 0.90. Use QoE fallback when confidence is below 0.90 or the prediction is invalid.

The backend now returns all three results in `result.baselines` and the frontend displays them together.

## 11. ML Dataset and Model Procedure

Collect repeated observations for:

- Low traffic.
- High traffic.
- 3-hop route.
- 4-hop route.
- 5-hop route.
- Each candidate path.

Create one row per path observation. Required initial features:

```text
latency_ms
throughput_mbps
packet_loss_pct
jitter_ms
utilization_pct
```

Label each row:

```text
low
high
```

Split the dataset reproducibly:

```text
70% training
15% validation
15% test
```

Train Logistic Regression first. Then compare Random Forest, SVM, KNN, AdaBoost, and XGBoost when installed. Save:

- Model file.
- Feature order.
- Preprocessing/scaler.
- Label mapping.
- Confidence policy.
- Training data hash.
- Precision, recall, F1, confusion matrix, ROC, and AUC.

The production inference code must reject missing or incorrectly ordered features.

## 12. Multimedia and PSNR/SSIM Procedure

Choose one test video and record its checksum.

For every strategy:

1. Transfer the same video from `h0` to `h9`.
2. Save original size and checksum.
3. Save received size and checksum.
4. Record transfer duration.
5. Compare corresponding frames.
6. Calculate PSNR.
7. Calculate SSIM.
8. Associate the quality result with the run ID and selected path.

Do not report PSNR or SSIM for an incomplete transfer as if it were valid. Mark the result incomplete.

## 13. Required Final Evidence

Capture and save:

- Environment versions.
- Floodlight switch-discovery response.
- Mininet `nodes`, `net`, and `pingall` output.
- iperf3 JSON output.
- NFStream flow output.
- AIRSDN decision event timeline.
- Hop-count, QoS-aware, and AIRSDN comparison table.
- RTT, throughput, packet loss, jitter, and utilization charts.
- PSNR and SSIM results.
- Screenshots or recording of topology and route changes.

## 14. Current Honest Status

The Windows environment is complete for simulation and visualization. The real adapters, topology definition, Floodlight client, iperf3 parser, ping parser, and NFStream collector are implemented.

The final Linux integration step is to connect successful live telemetry samples to `PathMetrics`, install the selected path through Floodlight, and associate real video-quality results with the run. This must be validated on Ubuntu because the current Windows machine does not provide the required Linux networking stack.
