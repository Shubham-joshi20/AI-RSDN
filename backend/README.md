# AIRSDN First Evaluation Slice

This standalone Python slice demonstrates the routing algorithm before Mininet and Floodlight integration.

## Included

- A deterministic 14-node, 22-link NSFNET-style topology.
- Connectivity and reference-path validation.
- Up to five shortest simple candidate paths from source `0` to destination `9`.
- Path telemetry fields: latency, throughput, loss, jitter, and utilization.
- Confidence-aware routing with the SRS threshold of `0.90`.
- QoE fallback using normalized throughput, latency, loss, jitter, and utilization.
- Reproducible low-traffic and high-traffic presentation scenarios.

## Run

From the repository root:

```text
python -m backend.server
python -m backend.demo
python -m backend.demo --scenario low
python -m backend.demo --scenario high --json
python -m unittest discover -s tests -v
```

Run the frontend in a second terminal:

```text
cd FrontEnd
npm run dev
```

Open the Visualization page at `http://localhost:5173/visualization`. The Vite development proxy forwards `/api` requests to the Python service on port `8000`.

## Evaluation result

- `low`: a low-traffic candidate has confidence `0.96`, so the decision is `ML_ROUTING`.
- `high`: no candidate reaches `0.90`, so the decision is `QOE_FALLBACK` and the highest QoE score wins.

This is a simulation of the decision layer. It does not claim live Mininet traffic, Floodlight flow installation, or trained-model inference yet; those belong to the next milestones.
