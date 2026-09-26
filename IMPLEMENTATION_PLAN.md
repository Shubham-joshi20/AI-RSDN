# AIRSDN Implementation Plan and Step-by-Step Procedure

## 1. Implementation Strategy

Build the system in vertical slices. First prove that the simulated network works, then prove measurement, then prove routing decisions, and only then build the polished live dashboard around real events. Every stage must leave behind a runnable artifact and a focused validation result.

The recommended deployment model is:

- **Ubuntu 20.04 or compatible Linux:** Mininet, Floodlight, OpenFlow tools, iperf3, ping, NFStream, Python backend.
- **Web client:** React/Vite dashboard, served locally or by the backend.
- **Optional development host:** Windows can host the editor and browser while the Linux environment runs the network stack through WSL2, a VM, or SSH.

## 2. Target Repository Structure

```text
AI-RSDN/
  README.md
  SRS.md
  IMPLEMENTATION_PLAN.md
  backend/
    api/
    controller/
    telemetry/
    routing/
    experiments/
    quality/
    storage/
  network/
    topology/
    scenarios/
    scripts/
  ml/
    data/
    notebooks/
    training/
    artifacts/
  frontend/
    src/
      components/
      views/
      hooks/
      services/
      types/
  tests/
    unit/
    integration/
    scenarios/
  artifacts/
    runs/
    exports/
```

The exact framework may be adjusted after environment verification, but the ownership boundaries should remain.

## 3. Milestones

### Milestone 0: Environment and Feasibility Check

**Goal:** prove that the required network toolchain can run.

Steps:

1. Set up Ubuntu 20.04 or a compatible Linux environment.
2. Install Java required by the chosen Floodlight version.
3. Install Mininet, Open vSwitch, iperf3, ping utilities, Python, and NFStream.
4. Build or download the selected Floodlight version and verify its REST API.
5. Run a tiny Mininet topology with one switch and two hosts.
6. Verify that hosts can ping each other and that Floodlight sees the switch.
7. Record exact versions and commands in an environment report.

**Gate:** the controller connects, the switch is visible, and a two-host ping succeeds.

### Milestone 1: Reproducible NSFNET Topology

**Goal:** create the paper-aligned network independently of the UI.

Steps:

1. Define switch and host identifiers in one topology module.
2. Encode the NSFNET links and add configurable capacity, delay, and loss.
3. Add one main client and one server, then add configurable background clients.
4. Assign deterministic IP and MAC addresses.
5. Add a topology validation command that checks connectivity and expected node/link counts.
6. Save a topology snapshot that can be sent to the frontend.
7. Test the reference 3-hop, 4-hop, and 5-hop paths.

**Gate:** topology validation passes and all reference source-destination paths exist.

### Milestone 2: Floodlight Flow Control

**Goal:** control and verify forwarding from the application layer.

Steps:

1. Identify the Floodlight REST endpoints or module interfaces for switch discovery and static flow installation.
2. Create a controller adapter with methods for discovery, path flow installation, flow removal, and flow verification.
3. Translate a node path into switch output-port rules.
4. Install a test path and verify traffic follows it using traceroute, switch counters, or flow statistics.
5. Add idempotent reset logic so a failed run does not pollute the next run.
6. Return structured errors instead of exposing raw controller output to the UI.

**Gate:** a selected path can be installed, verified, and removed repeatedly.

### Milestone 3: Traffic and Telemetry Pipeline

**Goal:** measure the network with timestamps and run associations.

Steps:

1. Implement process wrappers for ping, iperf3, and NFStream.
2. Use structured output formats wherever available.
3. Define a common metric sample schema with timestamp, entity, metric, value, unit, and quality flag.
4. Start low-traffic background flows and record their process IDs and configuration.
5. Start high-traffic background flows and confirm the intended utilization range.
6. Measure RTT, packet loss, throughput, jitter, and utilization per flow/path.
7. Store raw output and normalized records separately.
8. Add timeout, cancellation, and stale-data handling.

**Gate:** a run produces valid low/high traffic records and a simple report without the frontend.

### Milestone 4: Dataset and ML Model

**Goal:** create a versioned, testable traffic classifier.

Steps:

1. Generate repeated records from the three path-length scenarios and low/high traffic conditions.
2. Preserve the raw feature set and label each record as `low` or `high`.
3. Reproduce the paper's feature-analysis workflow and document the selected 19 features.
4. Use a reproducible 70% training, 15% validation, and 15% test split.
5. Train Logistic Regression and the comparison models that the environment supports.
6. Produce precision, recall, F1, confusion matrix, ROC, and AUC reports.
7. Fit and save preprocessing with the model, never separately or implicitly.
8. Save a model manifest containing feature names, units, label mapping, threshold, code version, and training data hash.
9. Add an inference test that rejects missing or incorrectly ordered features.

**Gate:** a fresh process can load the saved artifact and produce the same prediction for a fixed input.

### Milestone 5: Candidate Paths and Routing Engine

**Goal:** make the routing decision independently testable.

Steps:

1. Implement shortest-path enumeration with a configurable limit of five candidates.
2. Attach measured metrics to each candidate path.
3. Call the ML service for each candidate or for the feature representation required by the model.
4. Implement the confidence threshold as configuration, defaulting to 0.90.
5. Implement ML selection for high-confidence predictions.
6. Implement normalized QoE scoring for low-confidence predictions.
7. Record every candidate, score, prediction, confidence, and rejection reason.
8. Add rerouting triggers based on time interval and metric change.
9. Add a route-stability rule to avoid changing paths for insignificant improvements.
10. Connect the selected path to the Floodlight adapter.

**Gate:** unit tests cover high confidence, low confidence, missing telemetry, invalid model output, no valid path, and route installation failure.

### Milestone 6: Video Transfer and Quality Analysis

**Goal:** connect network decisions to multimedia outcomes.

Steps:

1. Select and document a test video and its checksum.
2. Transfer it over the baseline and AI-selected paths.
3. Record original size, received size, transfer duration, and estimated loss.
4. Compare original and received frames using a tested PSNR implementation.
5. Calculate SSIM consistently across the same sampled frames or segments.
6. Store quality results with the experiment ID and route decision ID.
7. Produce a baseline-vs-AI comparison report.
8. Verify that failed or incomplete video transfers are shown as incomplete rather than as valid quality scores.

**Gate:** the same run can link path metrics to PSNR/SSIM results and export them.

### Milestone 7: Backend API and Event Contract

**Goal:** give the UI stable, understandable data.

Recommended endpoints or equivalent services:

- `GET /api/topology`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{id}`
- `POST /api/runs/{id}/stop`
- `POST /api/runs/{id}/reset`
- `GET /api/runs/{id}/candidates`
- `GET /api/runs/{id}/metrics`
- `GET /api/runs/{id}/decisions`
- `GET /api/runs/{id}/quality`
- `GET /api/runs/{id}/export`
- `GET /api/events` or a WebSocket/SSE stream for live updates

Define event types before implementing components:

```text
run.started
run.status_changed
telemetry.updated
path.candidates_updated
model.prediction_made
routing.decision_made
flow.install_started
flow.install_succeeded
flow.install_failed
packet.flow_started
packet.flow_ended
video.quality_updated
run.completed
run.failed
```

Each event should contain `eventId`, `runId`, `timestamp`, `type`, and a typed payload. The event stream must tolerate reconnects and include the last known sequence number.

**Gate:** a command-line client can start a run and receive enough events to reconstruct the decision timeline.

### Milestone 8: Visualization-First Dashboard

**Goal:** make the algorithm's behavior immediately understandable.

#### 8.1 Primary Screen Layout

Use a workbench layout rather than a marketing page:

- **Top status bar:** experiment state, controller connection, model version, elapsed time, start/stop/reset actions.
- **Main canvas:** large Cytoscape.js topology map with stable positions and animated flow overlays.
- **Right decision rail:** active path, confidence, routing mode, fallback reason, and latest decision.
- **Bottom analysis strip:** synchronized metric charts and a compact event timeline.
- **Secondary tabs:** Candidates, Video Quality, Baselines, Model, Run History, Logs.

The topology canvas should have enough space to inspect links and should not be reduced to a small decorative thumbnail.

#### 8.2 Network Map Behavior

1. Use stable node positions so the map does not jump while metrics update.
2. Style hosts, switches, and controller differently and label them clearly.
3. Use link thickness for traffic volume and a color scale for utilization, with numeric labels available on hover/focus.
4. Highlight the active path with a strong line and show alternate candidates with lighter lines.
5. Show link detail on selection: capacity, delay, utilization, loss, and last update.
6. Show node/link failure or stale state explicitly.
7. Provide fit-to-network, pause animation, and reset view controls with icon tooltips.

#### 8.3 Packet and Flow Animation

1. Animate directional pulses along the selected path.
2. Use different visual treatments for video traffic and background traffic.
3. Scale animation rate to the measured flow rate within bounded limits so very high values do not become unreadable.
4. Pause and resume animation without changing the experiment.
5. When a reroute happens, finish or fade the old flow and begin the new path with a visible decision marker.
6. Label the animation as flow-level visualization if packet-level capture is not available.
7. Do not fabricate packet positions or delivery success; animation must follow the event and telemetry contract.

#### 8.4 Decision Storytelling

The UI should answer these questions in order:

1. What is happening now?
2. Which path is active?
3. Why was it selected?
4. How confident was the model?
5. Did QoE fallback run?
6. What changed in the network?
7. Did the decision improve multimedia quality?

Use a decision card with a clear mode label: `ML ROUTING`, `QOE FALLBACK`, `BASELINE`, or `NO VALID ROUTE`. Include the threshold and the exact trigger for rerouting.

#### 8.5 Charts and Comparison

- Use synchronized time axes for RTT, throughput, loss, jitter, and utilization.
- Show units, legends, empty states, stale state, and sampling timestamps.
- Mark route changes on charts with vertical event markers.
- Compare hop-count, QoS-aware, and AI runs using identical scales where possible.
- Show PSNR and SSIM beside transfer loss; do not imply that one metric alone represents user experience.
- Keep chart interaction focused: hover values, zoom/reset, and visible selected time window.

#### 8.6 Responsive and Accessible UX

- Desktop is the primary demonstration layout; tablet layout must remain usable.
- On small screens, stack the decision rail and analysis strip below the map.
- Keep controls stable in size so live text cannot shift the layout.
- Use familiar icons for map controls and text for high-impact actions such as Start and Stop.
- Provide keyboard focus, readable contrast, and text alternatives for color-coded states.

**Gate:** an evaluator can identify source, destination, active path, congestion, model confidence, routing mode, and latest metric change within one screen.

### Milestone 9: Integration, Baselines, and Evaluation

**Goal:** produce credible project evidence.

Steps:

1. Run the hop-count baseline under each scenario.
2. Run the QoS-aware baseline under the same scenario configurations.
3. Run AI routing with confidence fallback.
4. Repeat runs with fixed seeds and record variability.
5. Compare RTT, throughput, loss, jitter, utilization, PSNR, and SSIM.
6. Record route changes and controller/host resource use.
7. Export raw data and generate a report with methods, limitations, and results.
8. Verify that screenshots or screen recordings show the actual topology and packet-flow behavior.

**Gate:** the report can trace every chart value back to a run and can explain every route change.

## 4. Recommended Test Matrix

| Dimension | Values |
|---|---|
| Routing strategy | Hop-count, QoS-aware, AI + fallback |
| Path scenario | 3 hop, 4 hop, 5 hop |
| Background traffic | Low, high |
| Protocol | TCP initially |
| Candidate paths | 1 to 5 where available |
| Model confidence | High, low, invalid/missing |
| Telemetry state | Fresh, delayed, missing |
| Experiment state | Start, running, rerouting, stop, reset, failure |

Run the smallest matrix first, then expand to repeated trials.

## 5. Validation Checklist

### Network

- [ ] Controller and switch versions are recorded.
- [ ] Topology node and link counts are validated.
- [ ] Reference paths are verified.
- [ ] Flow installation and deletion are idempotent.
- [ ] Background traffic reaches its intended endpoints.

### ML

- [ ] Dataset schema is versioned.
- [ ] Train/validation/test separation is reproducible.
- [ ] Preprocessing is saved with the model.
- [ ] Feature order and missing values are validated.
- [ ] Confidence threshold behavior has automated tests.

### Routing

- [ ] Candidate paths are deterministic for a fixed topology.
- [ ] QoE weights and normalization are recorded.
- [ ] Rerouting does not cause unnecessary churn.
- [ ] No-valid-route and controller-failure states are visible.

### Multimedia

- [ ] Original video checksum is recorded.
- [ ] Incomplete transfers are detected.
- [ ] PSNR and SSIM implementations are tested on known inputs.
- [ ] Quality results map to the correct run and path.

### UI/UX

- [ ] Topology remains stable while data updates.
- [ ] Active path and alternate candidates are distinguishable.
- [ ] Flow animation follows event data.
- [ ] Model confidence and fallback reason are visible.
- [ ] Charts show units, timestamps, and stale states.
- [ ] UI works at desktop and tablet widths.
- [ ] Keyboard focus and non-color state indicators work.

## 6. Suggested Team Work Split

- **Network and controller:** topology, Floodlight adapter, flow rules, reset.
- **Telemetry and experiments:** traffic orchestration, probes, run storage.
- **ML and routing:** dataset, features, model artifacts, candidate ranking, QoE.
- **Frontend and visualization:** topology map, flow animation, charts, events, UX.
- **Evaluation and documentation:** baselines, test matrix, reports, reproducibility.

All team members should agree on the event and data schemas before parallel implementation.

## 7. Definition of Done

The project is ready for demonstration when a user can select a predefined scenario, start a run, observe background and video flows on the topology, see candidate paths and model confidence, witness ML or QoE routing selection, observe route installation or rerouting, inspect live metrics, compare video quality with baselines, stop/reset the run, and export the evidence without relying on terminal logs.
