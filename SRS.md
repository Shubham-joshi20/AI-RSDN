# Software Requirements Specification
## AIRSDN: AI-Based Routing in SDN for Multimedia Traffic Transmission

**Version:** 1.0  
**Status:** Draft for review  
**Project:** Advanced Algorithm Project  
**Authors:** Amit Nishad, Nikhilesh Joshi, Nikhil Bansal, Shubham Joshi

## 1. Purpose

AIRSDN is a reproducible software-defined networking simulation system that uses machine learning and network quality metrics to select less-congested paths for multimedia traffic. The system must make routing decisions visible: users should be able to see the topology, candidate paths, active path, packet movement, congestion, model confidence, fallback decisions, and resulting video quality.

This document defines the product scope and requirements before implementation. It is based on the project README and the supplied research paper. It does not claim that paper results will automatically be reproduced; the implementation must measure and report its own results.

## 2. Objectives and Success Criteria

1. Build the NSFNET-based virtual network in Mininet and connect it to Floodlight through OpenFlow.
2. Generate repeatable low-traffic and high-traffic multimedia scenarios.
3. Collect path and flow statistics using ping, iperf3, and NFStream.
4. Classify path traffic as low or high using a trained ML model.
5. Evaluate up to five shortest candidate paths and select a route dynamically.
6. Use an explicit confidence threshold. The default policy is confidence >= 90% for ML routing and confidence < 90% for QoE fallback.
7. Install and update flows through Floodlight without requiring manual switch configuration.
8. Compare AI routing against hop-count and QoS-aware baselines.
9. Demonstrate improvement using RTT, throughput, packet loss, jitter, bandwidth utilization, PSNR, and SSIM.
10. Provide a clear, responsive web UI that explains what the network is doing in real time.

## 3. Scope

### 3.1 In Scope

- Mininet virtual NSFNET topology.
- Floodlight controller integration through REST/OpenFlow.
- Host-to-host TCP multimedia traffic for the first implementation.
- Low-traffic and high-traffic background-load scenarios.
- Three candidate route scenarios based on 3, 4, and 5 hops.
- Collection, storage, validation, and display of network metrics.
- Dataset preparation, feature selection, training, evaluation, and model loading.
- Logistic Regression as the initial production model, with an extensible model comparison step.
- Top-five shortest-path candidate generation.
- Confidence-aware ML routing and QoE-based fallback.
- Flow installation, rerouting, reset, and experiment repetition.
- Web dashboard with topology and packet-flow visualization.
- Experiment result export and reproducibility metadata.

### 3.2 Out of Scope for Version 1

- Physical network deployment.
- Production-grade controller security hardening.
- Reinforcement learning.
- Multi-controller federation.
- Full support for arbitrary topologies through the UI.
- Formal real-time guarantees.
- UDP optimization as a required feature, although the design should leave room for it.

## 4. Stakeholders and Users

- **Student developers:** implement, debug, and extend the system.
- **Project evaluators:** run experiments and inspect evidence for the algorithm's behavior.
- **Network/ML researcher:** inspect features, model decisions, paths, and measurements.
- **Demonstration user:** start a scenario and understand packet movement without reading logs.

## 5. System Overview

The system consists of these logical components:

1. **Experiment Orchestrator:** starts and resets Mininet, configures scenarios, coordinates traffic, and records runs.
2. **Mininet Network:** emulates hosts, switches, links, delays, capacities, and background traffic.
3. **Floodlight Controller:** maintains network state and installs flow rules.
4. **Telemetry Collector:** obtains RTT, packet loss, throughput, bandwidth utilization, jitter, and flow statistics.
5. **Feature Pipeline:** validates raw observations, selects the model's required features, and produces an inference record.
6. **ML Service:** loads the trained classifier and returns traffic class, probability/confidence, model version, and inference time.
7. **Routing Decision Engine:** ranks candidate paths, applies the confidence policy, computes QoE scores when needed, and installs the selected path.
8. **Multimedia and Quality Analyzer:** transfers the test video and calculates file loss, PSNR, and SSIM.
9. **Event/API Layer:** exposes topology, metrics, decisions, packets, and experiment state to the UI.
10. **Visualization Dashboard:** renders network state, packet flow, path decisions, metrics, model reasoning, and comparison results.

### 5.1 High-Level Data Flow

```text
Scenario -> Mininet/Floodlight -> Telemetry -> Features -> ML prediction
                                                     |
                           confidence >= threshold --+-- confidence < threshold
                                                     |                    |
                                                ML route             QoE route
                                                     \                    /
                                                      -> Flow installation
                                                               |
                                          Video transfer + measurements + events
                                                               |
                                                    API -> Web dashboard
```

## 6. Functional Requirements

### FR-01: Topology Creation

The system shall create the NSFNET topology with the paper's baseline structure: 14 switches, one main client, one server, and configurable additional clients. It shall support link capacity, delay, and loss configuration.

### FR-02: Controller Integration

The system shall connect Mininet switches to Floodlight and verify controller reachability before an experiment starts. It shall expose controller errors and stale-flow conditions to the UI and run log.

### FR-03: Scenario Configuration

The system shall allow an experiment to define source host, destination host, protocol, video input, background-flow pairs, bandwidth, duration, traffic level, candidate-path count, confidence threshold, and routing strategy.

The default scenarios shall include:

- **3-hop route:** reference path through switches 0-3-8-9.
- **4-hop route:** reference path through switches 0-1-7-10-9.
- **5-hop route:** reference path through switches 0-2-5-13-10-9.
- **Low traffic:** approximately 30% link usage, using repeatable background TCP flows.
- **High traffic:** approximately 90% link usage, using repeatable background TCP flows.

The exact topology identifiers shall be configurable because switch naming can differ between Mininet and the paper diagrams.

### FR-04: Traffic Generation

The system shall start and stop background traffic and multimedia traffic independently. It shall record start time, end time, source, destination, protocol, requested bandwidth, achieved bandwidth, and process status for every flow.

### FR-05: Telemetry Collection

The system shall collect, timestamp, and associate measurements with a run, path, flow, and candidate route where applicable. Required metrics are:

- RTT/latency.
- Packet loss.
- Throughput/bits per second.
- Bandwidth utilization.
- Jitter.
- Flow duration and packet/byte counts.
- PSNR and SSIM for the transferred video.
- CPU and memory usage of the experiment components when enabled.

The collector shall mark missing, stale, or invalid values rather than silently treating them as zero.

### FR-06: Dataset and Feature Pipeline

The system shall preserve raw observations and create an inference-ready dataset. The pipeline shall support the paper's feature-reduction approach: approximately 49 initial features reduced to 19 selected features after analysis. The selected feature list, preprocessing parameters, label definition, and model version shall be stored with each trained model.

The initial traffic label shall be binary: `low` or `high`.

### FR-07: Model Training and Evaluation

The training pipeline shall:

- Split data into 70% training, 15% validation, and 15% test partitions.
- Prevent leakage between partitions.
- Train and compare Logistic Regression, XGBoost, Random Forest, SVM, KNN, and AdaBoost when dependencies are available.
- Report precision, recall, F1 score, confusion matrix, ROC curve, and AUC.
- Save the selected model, feature schema, scaler/preprocessor, and metrics.
- Make Logistic Regression the initial default model because the supplied paper reports its strongest F1 score among the compared models.

### FR-08: Candidate Path Generation

For a source and destination, the system shall generate and display up to five shortest candidate paths. Candidate paths shall include hop count and stable path identifiers. Invalid, disconnected, duplicate, or stale paths shall be rejected with an explanation.

### FR-09: ML Prediction

For each candidate path, the system shall provide the model with the required features and return:

- Predicted traffic class.
- Confidence/probability.
- Model name and version.
- Feature values used for inference.
- Inference timestamp and duration.

### FR-10: Routing Decision Engine

The decision engine shall:

1. Rank candidate paths using the configured routing policy.
2. Select the ML-recommended path when confidence is at least the configured threshold.
3. Invoke QoE fallback when confidence is below the threshold or the ML result is invalid.
4. Record the decision reason, selected path, rejected paths, confidence, threshold, and input metrics.
5. Re-evaluate periodically and reroute only when the configured change condition is met.
6. Avoid unnecessary flow churn by retaining the current route when it remains acceptable.

### FR-11: QoE Fallback

The fallback shall score available candidate paths using normalized metrics including throughput, RTT/delay, packet loss, jitter, and bandwidth utilization. The weights shall be configurable and recorded per run. Lower delay, loss, jitter, and utilization shall improve the score; higher throughput shall improve the score.

The UI shall explicitly identify a QoE decision as a fallback and show the metric contributions, not just the final score.

### FR-12: Flow Installation

The system shall install the selected route through Floodlight, verify the resulting flow rules, and report installation success or failure. It shall support removal/reset of experiment flows and must not leave stale experiment state that affects a later run.

### FR-13: Re-routing

The system shall support periodic or event-triggered re-evaluation. A reroute event shall show the previous path, new path, trigger metric, time, and flow-update status. Packet animation shall visually transition from the old path to the new path.

### FR-14: Video Quality Evaluation

The system shall compare the original and transferred video and report:

- Transferred size and estimated data loss.
- PSNR in dB.
- SSIM in the range supported by the selected implementation.
- Frame or segment error summary when available.

The UI shall allow comparison of baseline and AI runs using synchronized metric cards and charts.

### FR-15: Experiment Management

The system shall provide start, pause where technically safe, stop, reset, and repeat actions. Every run shall have a unique ID and store configuration, software versions, model version, timestamps, status, logs, metrics, decisions, and output locations.

### FR-16: Visualization Dashboard

The dashboard shall provide the following views:

- **Network map:** switches, hosts, controller, links, link capacity, current utilization, health state, and labels.
- **Packet-flow animation:** packets or flow pulses moving from source to destination, with direction, rate, protocol, and selected path highlighted.
- **Path comparison:** all candidate paths shown simultaneously with hop count, predicted traffic, confidence, and QoE score.
- **Decision timeline:** telemetry observation, prediction, confidence check, fallback, route installation, and reroute events.
- **Live metrics:** RTT, throughput, packet loss, jitter, utilization, PSNR, and SSIM with units and timestamps.
- **Traffic heatmap:** link-level congestion using a color scale with a legend and accessible non-color labels.
- **Video quality panel:** original/transferred status, PSNR, SSIM, loss, and a frame-quality summary.
- **Baseline comparison:** hop-count, QoS-aware, and AI routing results across the same run configuration.
- **Model panel:** model version, predicted class, confidence, threshold, selected features, and fallback reason.
- **Run history:** searchable experiments, status, duration, and export action.

The visualization shall degrade gracefully when live telemetry is unavailable: it shall show the last update time and stale state instead of implying that data is current.

### FR-17: Export

The system shall export run configuration, raw metrics, processed metrics, decision events, path data, model results, and video-quality results in machine-readable format. It shall also provide a human-readable experiment summary.

## 7. Non-Functional Requirements

### NFR-01: Reproducibility

A run shall be repeatable from its saved configuration, topology version, model version, random seed, and environment information.

### NFR-02: Usability

A first-time evaluator shall be able to start a predefined experiment and understand the selected route and its reason without reading terminal logs.

### NFR-03: Performance

The dashboard shall remain responsive while telemetry is streamed. The backend shall avoid blocking the UI on long video transfers and shall expose progress/status events.

### NFR-04: Reliability

Partial failures shall be reported per component. A failed telemetry probe must not be confused with a measured zero; a failed route installation must stop or clearly mark the affected experiment.

### NFR-05: Accessibility

The UI shall use readable contrast, keyboard-operable controls, text labels/tooltips for unfamiliar icons, and non-color indicators for path state and congestion.

### NFR-06: Maintainability

The routing policy, telemetry adapters, model implementation, controller adapter, and UI data contract shall be replaceable independently. Configuration shall be externalized rather than hard-coded in visualization components.

### NFR-07: Security and Safety

The system shall validate API inputs, restrict controller operations to the experiment namespace, and avoid arbitrary shell command execution from user-supplied values. This is a research simulator, not a production SDN security solution.

## 8. Data Requirements

Every run should include these entities:

- `ExperimentRun`: id, scenario, strategy, status, timestamps, seed, environment.
- `Node`: id, type, address, position, status.
- `Link`: source, destination, capacity, delay, loss, utilization, status.
- `Flow`: id, source, destination, protocol, requested/actual rate, bytes, packets.
- `PathCandidate`: id, node sequence, hop count, metrics, prediction, confidence, QoE score.
- `RoutingDecision`: timestamp, reason, threshold, previous path, selected path, model version.
- `MetricSample`: timestamp, run, path/link/flow association, value, unit, quality flag.
- `VideoQualityResult`: original/transferred artifact, loss, PSNR, SSIM.
- `ModelArtifact`: model version, feature schema, preprocessing, training metrics.

## 9. Baselines and Acceptance Tests

The implementation shall compare at least these strategies under the same topology and traffic configuration:

1. Hop-count shortest path.
2. QoS-aware path using configured network metrics.
3. Confidence-aware AI routing with QoE fallback.

Minimum acceptance tests:

- The topology starts and the controller connection is verified.
- A complete run can be started, monitored, reset, and repeated.
- At least five candidate paths are displayed when five valid paths exist.
- A high-confidence result selects ML routing.
- A low-confidence result selects QoE fallback and displays why.
- A route installation is visible in the topology and event timeline.
- Packet animation follows the active route and stops when the run stops.
- Baseline and AI metrics are exportable and comparable.
- Missing telemetry is visibly marked as stale/invalid.
- Model inference uses the saved feature schema and produces a confidence value.
- PSNR and SSIM results are associated with the correct experiment.

## 10. Constraints, Assumptions, and Risks

- Mininet and Floodlight generally require a Linux environment; Ubuntu 20.04 is the target environment from the project proposal. Windows development should use a Linux VM, WSL2, or a dedicated Ubuntu machine.
- The paper's dataset is simulation-generated. Reported paper metrics are reference targets, not guaranteed outputs.
- Floodlight API/module behavior may vary by version and must be verified during setup.
- Real-time packet animation is an explanatory visualization derived from telemetry; it must not be presented as packet-level wire truth when the system only has flow-level statistics.
- Synthetic traffic can make classification easier than real-world traffic. The report must disclose this limitation.
- The initial implementation focuses on TCP and should preserve extension points for UDP.

## 11. Traceability to Paper and README

- NSFNET, Mininet, Floodlight, iperf3, NFStream, ping: Sections 3, 5, FR-01 to FR-05.
- 49 features reduced to 19: FR-06 and Section 8.
- 70/15/15 split and model comparison: FR-07.
- Top-five shortest paths and traffic prediction: FR-08 to FR-10.
- Low/high traffic and 3/4/5-hop scenarios: FR-03.
- PSNR/SSIM video evaluation: FR-14.
- Hop-count and QoS-aware comparison: Section 9.
- Real-time network and packet visualization: FR-16.

## 12. Open Decisions for Review

1. Confirm whether the dashboard is expected to run on the same Ubuntu host as Floodlight/Mininet or on a separate development machine.
2. Confirm the exact Floodlight version and REST modules available.
3. Confirm whether video playback is required or whether frame/quality comparison is sufficient.
4. Confirm whether the first milestone should use live WebSocket telemetry or periodic REST polling.
5. Confirm the final QoE weights and rerouting interval after baseline measurements.
