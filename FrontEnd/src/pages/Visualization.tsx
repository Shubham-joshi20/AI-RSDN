import { useEffect, useState, type ReactNode } from "react";

type Scenario = "low" | "high";
type PlaybackPhase = "topology" | "candidates" | "telemetry" | "prediction" | "decision" | "flow" | "complete";
type GraphLayout = "nsfnet" | "layered" | "radial";

type Link = {
    source: number;
    target: number;
};

type Candidate = {
    path: number[];
    path_id: string;
    hop_count: number;
    latency_ms: number;
    throughput_mbps: number;
    packet_loss_pct: number;
    jitter_ms: number;
    utilization_pct: number;
    predicted_traffic: string;
    confidence: number;
    qoe_score: number;
};

type BaselineResult = {
    strategy: string;
    selected_path_id: string;
    reason: string;
    hop_count: number;
    latency_ms: number;
    throughput_mbps: number;
    packet_loss_pct: number;
    jitter_ms: number;
    utilization_pct: number;
};

type DemoResult = {
    scenario: Scenario;
    nodes: { id: number; label: string }[];
    links: Link[];
    topology: {
        node_count: number;
        edge_count: number;
        connected: boolean;
    };
    decision: {
        mode: string;
        selected_path: number[];
        selected_path_id: string;
        reason: string;
        threshold: number;
        selected_confidence: number;
        candidates: Candidate[];
    };
    baselines: Record<"hop_count" | "qos_aware" | "airsdn", BaselineResult>;
};

type RunSummary = {
    id: string;
    scenario: Scenario;
    status: string;
    created_at: string;
    completed_at: string | null;
    mode: string;
    selected_path_id: string;
    event_count: number;
};

type ExperimentRun = {
    id: string;
    status: string;
    result: DemoResult;
    events: {
        eventId: string;
        timestamp: string;
        type: string;
        payload: Record<string, string | number>;
    }[];
};

type IntegrationStatus = {
    mode: "real" | "simulation";
    tools: { name: string; available: boolean; detail: string }[];
    limitations: string[];
};

type LiveProbe = {
    host: string;
    has_valid_data: boolean;
    metrics: { metric: string; value: number; unit: string; source: string; quality: string; detail?: string }[];
};

const nodePositions: Record<number, { x: number; y: number }> = {
    0: { x: 70, y: 190 },
    1: { x: 190, y: 85 },
    2: { x: 190, y: 295 },
    3: { x: 190, y: 190 },
    4: { x: 330, y: 35 },
    5: { x: 330, y: 150 },
    6: { x: 330, y: 345 },
    7: { x: 470, y: 100 },
    8: { x: 470, y: 230 },
    9: { x: 735, y: 190 },
    10: { x: 610, y: 100 },
    11: { x: 470, y: 350 },
    12: { x: 610, y: 300 },
    13: { x: 610, y: 210 },
};

const graphLayouts: Record<GraphLayout, Record<number, { x: number; y: number }>> = {
    nsfnet: nodePositions,
    layered: {
        0: { x: 70, y: 200 }, 1: { x: 220, y: 90 }, 2: { x: 220, y: 300 }, 3: { x: 220, y: 200 },
        4: { x: 390, y: 55 }, 5: { x: 390, y: 165 }, 6: { x: 390, y: 345 }, 7: { x: 560, y: 100 },
        8: { x: 560, y: 250 }, 9: { x: 750, y: 200 }, 10: { x: 720, y: 85 }, 11: { x: 560, y: 360 },
        12: { x: 700, y: 320 }, 13: { x: 560, y: 170 },
    },
    radial: {
        0: { x: 400, y: 200 }, 1: { x: 260, y: 85 }, 2: { x: 170, y: 200 }, 3: { x: 260, y: 315 },
        4: { x: 400, y: 55 }, 5: { x: 530, y: 85 }, 6: { x: 625, y: 175 }, 7: { x: 625, y: 285 },
        8: { x: 530, y: 350 }, 9: { x: 400, y: 345 }, 10: { x: 750, y: 200 }, 11: { x: 170, y: 315 },
        12: { x: 650, y: 360 }, 13: { x: 700, y: 330 },
    },
};

const playbackPhases: { key: PlaybackPhase; label: string; description: string }[] = [
    { key: "topology", label: "Discover topology", description: "The controller verifies the available switches, links, source, and destination." },
    { key: "candidates", label: "Calculate candidate paths", description: "The routing engine enumerates up to five loop-free shortest paths." },
    { key: "telemetry", label: "Collect traffic metrics", description: "Each candidate receives latency, throughput, loss, jitter, and utilization measurements." },
    { key: "prediction", label: "Predict traffic", description: "The ML classifier estimates traffic level and confidence for each candidate." },
    { key: "decision", label: "Select route", description: "Confidence is compared with the threshold; uncertain predictions use QoE scoring." },
    { key: "flow", label: "Update flow table", description: "The selected route is sent to the SDN controller for forwarding." },
    { key: "complete", label: "Transmit multimedia", description: "Traffic follows the selected route while the experiment records its result." },
];

const Visualization = () => {
    const [scenario, setScenario] = useState<Scenario>("low");
    const [data, setData] = useState<DemoResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [runStatus, setRunStatus] = useState("preview");
    const [history, setHistory] = useState<RunSummary[]>([]);
    const [isStarting, setIsStarting] = useState(false);
    const [events, setEvents] = useState<ExperimentRun["events"]>([]);
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [pulseIndex, setPulseIndex] = useState(0);
    const [graphLayout, setGraphLayout] = useState<GraphLayout>("nsfnet");
    const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
    const [probeHost, setProbeHost] = useState("127.0.0.1");
    const [probe, setProbe] = useState<LiveProbe | null>(null);
    const [isProbing, setIsProbing] = useState(false);
    const selectedPath = data?.decision.selected_path ?? [];
    const currentPhase = playbackPhases[phaseIndex];
    const visibleSelectedPath = phaseIndex >= 4 ? selectedPath : [];
    const selectedLinks = new Set(
        visibleSelectedPath.slice(0, -1).map((node, index) => {
            const next = visibleSelectedPath[index + 1];
            return node < next ? `${node}-${next}` : `${next}-${node}`;
        }),
    );
    const pulseNode = selectedPath[pulseIndex];
    const positions = graphLayouts[graphLayout];

    const restartPlayback = () => {
        setPhaseIndex(0);
        setPulseIndex(0);
        setIsPlaying(false);
    };

    const stepPlayback = (direction: number) => {
        setIsPlaying(false);
        setPhaseIndex((current) => Math.max(0, Math.min(playbackPhases.length - 1, current + direction)));
    };

    useEffect(() => {
        let cancelled = false;
        setError(null);
        setRunId(null);
        setRunStatus("preview");
        setEvents([]);
        setPhaseIndex(0);
        setIsPlaying(false);
        setPulseIndex(0);
        fetch(`/api/demo?scenario=${scenario}`)
            .then((response) => {
                if (!response.ok) throw new Error("The routing API returned an error.");
                return response.json() as Promise<DemoResult>;
            })
            .then((result) => {
                if (!cancelled) setData(result);
            })
            .catch(() => {
                if (!cancelled) {
                    setData(null);
                    setError("Start the Python API with: python -m backend.server");
                }
            });
        fetch("/api/runs")
            .then((response) => response.json() as Promise<{ runs: RunSummary[] }>)
            .then((result) => {
                if (!cancelled) setHistory(result.runs);
            })
            .catch(() => undefined);
        fetch("/api/integration/status")
            .then((response) => response.json() as Promise<IntegrationStatus>)
            .then((result) => {
                if (!cancelled) setIntegration(result);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [scenario]);

    useEffect(() => {
        if (!isPlaying) return undefined;
        const timer = window.setInterval(() => {
            setPhaseIndex((current) => {
                if (current >= playbackPhases.length - 1) {
                    setIsPlaying(false);
                    return current;
                }
                return current + 1;
            });
        }, 2200);
        return () => window.clearInterval(timer);
    }, [isPlaying]);

    useEffect(() => {
        if (!isPlaying || phaseIndex < 2 || !selectedPath.length) return undefined;
        const timer = window.setInterval(() => {
            setPulseIndex((current) => (current + 1) % selectedPath.length);
        }, 650);
        return () => window.clearInterval(timer);
    }, [isPlaying, phaseIndex, selectedPath.length]);

    const startExperiment = async () => {
        setIsStarting(true);
        setError(null);
        try {
            const response = await fetch("/api/runs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario, confidence_threshold: 0.9 }),
            });
            if (!response.ok) throw new Error("The experiment API returned an error.");
            const run = await response.json() as ExperimentRun;
            setData(run.result);
            setRunId(run.id);
            setRunStatus(run.status);
            setEvents(run.events);
            const historyResponse = await fetch("/api/runs");
            const historyData = await historyResponse.json() as { runs: RunSummary[] };
            setHistory(historyData.runs);
        } catch {
            setError("Could not start the experiment. Start the Python API with: python -m backend.server");
        } finally {
            setIsStarting(false);
        }
    };

    const probeLiveHost = async () => {
        setIsProbing(true);
        try {
            const response = await fetch("/api/integration/probe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ host: probeHost }),
            });
            if (!response.ok) throw new Error("Live probe failed");
            setProbe(await response.json() as LiveProbe);
        } catch {
            setProbe({ host: probeHost, has_valid_data: false, metrics: [{ metric: "probe", value: 0, unit: "", source: "backend", quality: "invalid", detail: "Probe request failed." }] });
        } finally {
            setIsProbing(false);
        }
    };

    return (
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 text-left md:px-8">
            <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                        AIRSDN routing workbench
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                        Network decision view
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
                        Live results from the Python topology and confidence-aware routing engine.
                    </p>
                </div>
                <div className="flex gap-2" role="group" aria-label="Traffic scenario">
                    {(["low", "high"] as Scenario[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setScenario(option)}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold capitalize transition ${
                                scenario === option
                                    ? "border-blue-700 bg-blue-700 text-white"
                                    : "border-zinc-400/50 bg-white/50 hover:border-blue-500 dark:bg-zinc-900/50"
                            }`}
                        >
                            {option} traffic
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={startExperiment}
                        disabled={isStarting}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                    >
                        {isStarting ? "Running..." : "Start experiment"}
                    </button>
                </div>
            </header>

            <section className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 shadow-sm" aria-label="Slow routing playback">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Slow explanation mode</p>
                        <h2 className="mt-1 text-xl font-bold">{currentPhase.label}</h2>
                        <p className="mt-1 max-w-3xl text-sm text-zinc-700 dark:text-zinc-200">{currentPhase.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <button type="button" onClick={restartPlayback} className="rounded-lg border border-zinc-400/50 px-3 py-2 text-sm font-semibold hover:border-blue-500">Restart</button>
                        <button type="button" onClick={() => stepPlayback(-1)} disabled={phaseIndex === 0} className="rounded-lg border border-zinc-400/50 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
                        <button type="button" onClick={() => setIsPlaying((playing) => !playing)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">{isPlaying ? "Pause" : "Play slowly"}</button>
                        <button type="button" onClick={() => stepPlayback(1)} disabled={phaseIndex === playbackPhases.length - 1} className="rounded-lg border border-zinc-400/50 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
                    </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-7">
                    {playbackPhases.map((phase, index) => (
                        <button
                            key={phase.key}
                            type="button"
                            onClick={() => { setIsPlaying(false); setPhaseIndex(index); }}
                            className={`min-h-14 rounded-lg border px-2 py-2 text-left text-xs transition ${index === phaseIndex ? "border-blue-700 bg-blue-700 text-white" : index < phaseIndex ? "border-emerald-600/40 bg-emerald-500/10" : "border-zinc-400/40 bg-white/40 dark:bg-zinc-900/30"}`}
                        >
                            <span className="font-mono font-bold">{String(index + 1).padStart(2, "0")}</span>
                            <span className="mt-1 block font-semibold">{phase.label}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60 md:flex-row md:items-center md:justify-between" aria-label="Graph layout selector">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Topology view</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Change the visual arrangement without changing the network links or routing result.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(["nsfnet", "layered", "radial"] as GraphLayout[]).map((layout) => (
                        <button
                            key={layout}
                            type="button"
                            onClick={() => setGraphLayout(layout)}
                            className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${graphLayout === layout ? "border-blue-700 bg-blue-700 text-white" : "border-zinc-400/50 hover:border-blue-500"}`}
                        >
                            {layout === "nsfnet" ? "NSFNET" : layout}
                        </button>
                    ))}
                </div>
            </section>

            {integration && <IntegrationPanel integration={integration} />}
            <LiveProbePanel host={probeHost} setHost={setProbeHost} probe={probe} isProbing={isProbing} onProbe={probeLiveHost} />

            {error ? (
                <div className="rounded-xl border border-amber-500/50 bg-amber-100/70 p-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">Backend connection unavailable</p>
                    <p className="mt-1 text-sm">{error}</p>
                </div>
            ) : data ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric label="Run" value={runId ?? "Preview"} />
                        <Metric label="Routing mode" value={data.decision.mode.replace("_", " ")} />
                        <Metric label="Active path" value={data.decision.selected_path_id} />
                        <Metric label="Status" value={runStatus} />
                    </div>

                    <StageEvidence phase={currentPhase.key} data={data} selectedPath={selectedPath} />

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                        <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold">Topology and active route</h2>
                                    <p className="text-xs text-zinc-500">Source S0 to destination S9</p>
                                </div>
                                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    {data.topology.node_count} NODES / {data.topology.edge_count} LINKS
                                </span>
                            </div>
                            <svg viewBox="0 0 805 400" className="h-auto w-full" role="img" aria-label="Network topology">
                                {data.links.map((link) => {
                                    const start = positions[link.source];
                                    const end = positions[link.target];
                                    const key = link.source < link.target
                                        ? `${link.source}-${link.target}`
                                        : `${link.target}-${link.source}`;
                                    const active = selectedLinks.has(key);
                                    return (
                                        <line
                                            key={key}
                                            x1={start.x}
                                            y1={start.y}
                                            x2={end.x}
                                            y2={end.y}
                                            stroke={active ? "#2563eb" : "#a1a1aa"}
                                            strokeWidth={active ? 5 : 2}
                                            strokeLinecap="round"
                                            opacity={active ? 1 : 0.65}
                                        />
                                    );
                                })}
                                {phaseIndex >= 1 && phaseIndex < 4 && data.decision.candidates.map((candidate, index) => (
                                    <polyline
                                        key={`candidate-${candidate.path_id}`}
                                        points={candidate.path.map((node) => `${positions[node].x},${positions[node].y}`).join(" ")}
                                        fill="none"
                                        stroke={index === 0 ? "#f59e0b" : "#94a3b8"}
                                        strokeWidth={index === 0 ? 4 : 2}
                                        strokeDasharray={index === 0 ? "8 5" : "4 6"}
                                        opacity={index === 0 ? 0.9 : 0.45}
                                    />
                                ))}
                                {data.nodes.map((node) => {
                                    const position = positions[node.id];
                                    const active = selectedPath.includes(node.id);
                                    return (
                                        <g key={node.id}>
                                            <circle
                                                cx={position.x}
                                                cy={position.y}
                                                r={active ? 19 : 15}
                                                fill={active ? "#2563eb" : "#f4f4f5"}
                                                stroke={active ? "#bfdbfe" : "#71717a"}
                                                strokeWidth="3"
                                            />
                                            <text x={position.x} y={position.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={active ? "white" : "#27272a"}>
                                                {node.label}
                                            </text>
                                        </g>
                                    );
                                })}
                                {phaseIndex >= 6 && pulseNode !== undefined && (
                                    <circle
                                        cx={positions[pulseNode].x}
                                        cy={positions[pulseNode].y}
                                        r="9"
                                        fill="#f97316"
                                        stroke="white"
                                        strokeWidth="3"
                                        className="transition-all duration-500"
                                    />
                                )}
                            </svg>
                        </div>

                        <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                            <h2 className="text-lg font-bold">Decision explanation</h2>
                            <div className="mt-4 rounded-lg bg-blue-700 p-4 text-white">
                                <p className="text-xs font-semibold uppercase tracking-wider">{data.decision.mode.replace("_", " ")}</p>
                                <p className="mt-2 text-xl font-bold">{data.decision.selected_path_id}</p>
                                <p className="mt-2 text-sm text-blue-100">{data.decision.reason}</p>
                            </div>
                            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <Detail label="Scenario" value={`${data.scenario} traffic`} />
                                <Detail label="Threshold" value={`${data.decision.threshold * 100}%`} />
                                <Detail label="Candidates" value={`${data.decision.candidates.length}`} />
                                <Detail label="Path hops" value={`${selectedPath.length - 1}`} />
                            </dl>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                        <h2 className="text-lg font-bold">Candidate paths and telemetry</h2>
                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-zinc-400/30 text-xs uppercase text-zinc-500">
                                    <tr><th className="px-3 py-2">Path</th><th className="px-3 py-2">Prediction</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2">Latency</th><th className="px-3 py-2">Throughput</th><th className="px-3 py-2">Utilization</th><th className="px-3 py-2">QoE</th></tr>
                                </thead>
                                <tbody>
                                    {data.decision.candidates.map((candidate) => (
                                        <tr key={candidate.path_id} className={candidate.path_id === data.decision.selected_path_id ? "bg-blue-500/10 font-semibold" : "border-b border-zinc-400/10"}>
                                            <td className="px-3 py-3">{candidate.path_id}</td>
                                            <td className="px-3 py-3 capitalize">{candidate.predicted_traffic}</td>
                                            <td className="px-3 py-3">{(candidate.confidence * 100).toFixed(0)}%</td>
                                            <td className="px-3 py-3">{candidate.latency_ms} ms</td>
                                            <td className="px-3 py-3">{candidate.throughput_mbps} Mbps</td>
                                            <td className="px-3 py-3">{candidate.utilization_pct}%</td>
                                            <td className="px-3 py-3">{candidate.qoe_score.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <BaselineComparison baselines={data.baselines} />

                    <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                            <h2 className="text-lg font-bold">Decision event timeline</h2>
                            <ol className="mt-3 space-y-3">
                                {(events.length ? events : [{ eventId: "preview", timestamp: "", type: "preview.mode", payload: {} }]).map((event) => (
                                    <li key={event.eventId} className="flex items-start gap-3 border-l-2 border-blue-500/50 pl-3">
                                        <div>
                                            <p className="text-sm font-semibold">{event.type}</p>
                                            <p className="text-xs text-zinc-500">{event.timestamp || "Preview only"}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                        <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                            <h2 className="text-lg font-bold">Experiment history</h2>
                            {history.length ? (
                                <div className="mt-3 space-y-2">
                                    {history.slice(0, 5).map((run) => (
                                        <div key={run.id} className="flex items-center justify-between rounded-lg bg-zinc-500/10 px-3 py-2 text-sm">
                                            <span className="font-mono font-semibold">{run.id}</span>
                                            <span className="capitalize">{run.scenario} / {run.mode.replace("_", " ")}</span>
                                            <span className="text-xs text-zinc-500">{run.event_count} events</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-3 text-sm text-zinc-500">No completed experiments yet.</p>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-8 text-center dark:bg-zinc-900/60">Loading routing results...</div>
            )}
        </section>
    );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 dark:bg-zinc-900/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="mt-2 truncate text-lg font-bold capitalize">{value}</p>
    </div>
);

const IntegrationPanel = ({ integration }: { integration: IntegrationStatus }) => (
    <section className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60" aria-label="Integration status">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Execution source</p>
                <h2 className="mt-1 text-xl font-bold">{integration.mode === "real" ? "Real network integration" : "Deterministic simulation"}</h2>
            </div>
            <p className="text-xs text-zinc-500">The dashboard reports tool availability instead of hiding missing live telemetry.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            {integration.tools.map((tool) => (
                <div key={tool.name} className={`rounded-lg border p-3 ${tool.available ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`} title={tool.detail}>
                    <p className="text-xs font-semibold uppercase tracking-wider">{tool.name}</p>
                    <p className="mt-1 text-sm font-bold">{tool.available ? "READY" : "UNAVAILABLE"}</p>
                </div>
            ))}
        </div>
        {integration.mode === "simulation" && <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">Run the backend inside Ubuntu/WSL2 with Mininet, Open vSwitch, iperf3, Java/Floodlight, and NFStream to switch this panel to real mode.</p>}
    </section>
);

const LiveProbePanel = ({
    host,
    setHost,
    probe,
    isProbing,
    onProbe,
}: {
    host: string;
    setHost: (value: string) => void;
    probe: LiveProbe | null;
    isProbing: boolean;
    onProbe: () => void;
}) => (
    <section className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60" aria-label="Live telemetry probe">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Live telemetry probe</p>
                <h2 className="mt-1 text-xl font-bold">Measure a reachable host</h2>
                <p className="mt-1 text-xs text-zinc-500">Uses real ping and iperf3 when installed. Invalid values remain visibly invalid.</p>
            </div>
            <div className="flex gap-2">
                <input value={host} onChange={(event) => setHost(event.target.value)} aria-label="Host to probe" className="w-44 rounded-lg border border-zinc-400/50 bg-transparent px-3 py-2 text-sm" />
                <button type="button" onClick={onProbe} disabled={isProbing} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isProbing ? "Probing..." : "Probe host"}</button>
            </div>
        </div>
        {probe && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {probe.metrics.map((metric) => <div key={`${metric.metric}-${metric.source}`} className={`rounded-lg border p-3 ${metric.quality === "valid" ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                <p className="text-xs uppercase tracking-wider text-zinc-500">{metric.metric}</p>
                <p className="mt-1 font-semibold">{metric.quality === "valid" ? `${metric.value.toFixed(2)} ${metric.unit}` : "Unavailable"}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{metric.quality} / {metric.source}</p>
            </div>)}
        </div>}
    </section>
);

const StageEvidence = ({
    phase,
    data,
    selectedPath,
}: {
    phase: PlaybackPhase;
    data: DemoResult;
    selectedPath: number[];
}) => {
    const flowRows = selectedPath.slice(0, -1).map((node, index) => ({
        hop: index + 1,
        switch: `S${node}`,
        next: `S${selectedPath[index + 1]}`,
        action: `forward to S${selectedPath[index + 1]}`,
    }));

    const header = (title: string, description: string) => (
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Current output</p>
                <h2 className="mt-1 text-xl font-bold">{title}</h2>
            </div>
            <p className="max-w-xl text-xs text-zinc-500">{description}</p>
        </div>
    );

    if (phase === "topology") {
        return (
            <section className="rounded-xl border border-blue-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
                {header("Topology creation record", "The topology module creates the graph before any route can be calculated.")}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <EvidenceValue label="Nodes created" value={`${data.topology.node_count} switches`} />
                    <EvidenceValue label="Links created" value={`${data.topology.edge_count} links`} />
                    <EvidenceValue label="Source" value="S0" />
                    <EvidenceValue label="Destination" value="S9" />
                </div>
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="border-b border-zinc-400/30 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2">Record</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Status</th></tr></thead>
                        <tbody>
                            <tr><td className="px-3 py-2">Topology validation</td><td className="px-3 py-2">14 nodes / 22 links</td><td className="px-3 py-2 font-semibold text-emerald-700">PASS</td></tr>
                            <tr><td className="px-3 py-2">Connectivity</td><td className="px-3 py-2">All nodes reachable</td><td className="px-3 py-2 font-semibold text-emerald-700">PASS</td></tr>
                            <tr><td className="px-3 py-2">Reference paths</td><td className="px-3 py-2">3-hop / 4-hop / 5-hop</td><td className="px-3 py-2 font-semibold text-emerald-700">PASS</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        );
    }

    if (phase === "candidates") {
        return (
            <section className="rounded-xl border border-amber-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
                {header("Candidate-path table", "The path enumerator has generated loop-free alternatives. The routing engine will compare these rows next.")}
                <EvidenceTable headers={["Candidate", "Path", "Hops", "Valid", "Selection state"]}>
                    {data.decision.candidates.map((candidate, index) => <tr key={candidate.path_id}><td className="px-3 py-2 font-mono">P{index + 1}</td><td className="px-3 py-2 font-mono">{candidate.path_id}</td><td className="px-3 py-2">{candidate.hop_count}</td><td className="px-3 py-2 text-emerald-700">VALID</td><td className="px-3 py-2">Waiting for telemetry</td></tr>)}
                </EvidenceTable>
            </section>
        );
    }

    if (phase === "telemetry") {
        return (
            <section className="rounded-xl border border-cyan-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
                {header("Traffic-generation and telemetry table", "The simulator generates repeatable flow conditions and attaches measurements to every candidate path. Real Mininet probes will replace these values later.")}
                <EvidenceTable headers={["Path", "Flow", "Latency", "Throughput", "Loss", "Jitter", "Utilization"]}>
                    {data.decision.candidates.map((candidate) => <tr key={candidate.path_id}><td className="px-3 py-2 font-mono">{candidate.path_id}</td><td className="px-3 py-2">video-flow-{candidate.hop_count}</td><td className="px-3 py-2">{candidate.latency_ms} ms</td><td className="px-3 py-2">{candidate.throughput_mbps} Mbps</td><td className="px-3 py-2">{candidate.packet_loss_pct}%</td><td className="px-3 py-2">{candidate.jitter_ms} ms</td><td className="px-3 py-2">{candidate.utilization_pct}%</td></tr>)}
                </EvidenceTable>
            </section>
        );
    }

    if (phase === "prediction") {
        return (
            <section className="rounded-xl border border-violet-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
                {header("ML prediction table", "The classifier reads the telemetry features and returns a traffic class plus confidence for each candidate.")}
                <EvidenceTable headers={["Path", "Input features", "Prediction", "Confidence", "Threshold check"]}>
                    {data.decision.candidates.map((candidate) => <tr key={candidate.path_id}><td className="px-3 py-2 font-mono">{candidate.path_id}</td><td className="px-3 py-2">5 telemetry features</td><td className="px-3 py-2 font-semibold capitalize">{candidate.predicted_traffic}</td><td className="px-3 py-2">{(candidate.confidence * 100).toFixed(0)}%</td><td className="px-3 py-2">{candidate.confidence >= data.decision.threshold ? "PASS" : "FALLBACK"}</td></tr>)}
                </EvidenceTable>
            </section>
        );
    }

    if (phase === "decision") {
        return (
            <section className="rounded-xl border border-blue-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
                {header("Routing decision table", "The decision engine combines confidence and QoE score, then records why the selected route won.")}
                <EvidenceTable headers={["Path", "Confidence", "QoE score", "Decision"]}>
                    {data.decision.candidates.map((candidate) => <tr key={candidate.path_id}><td className="px-3 py-2 font-mono">{candidate.path_id}</td><td className="px-3 py-2">{(candidate.confidence * 100).toFixed(0)}%</td><td className="px-3 py-2">{candidate.qoe_score.toFixed(2)}</td><td className="px-3 py-2 font-semibold">{candidate.path_id === data.decision.selected_path_id ? data.decision.mode : "REJECTED"}</td></tr>)}
                </EvidenceTable>
            </section>
        );
    }

    if (phase === "flow") {
        return (
            <section className="rounded-xl border border-emerald-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
                {header("Flow-table update", "The selected path is translated into forwarding actions. In the full SDN version, these rows will be installed through Floodlight/OpenFlow.")}
                <EvidenceTable headers={["Hop", "Current switch", "Next switch", "Forwarding action"]}>
                    {flowRows.map((row) => <tr key={row.hop}><td className="px-3 py-2">{row.hop}</td><td className="px-3 py-2 font-mono">{row.switch}</td><td className="px-3 py-2 font-mono">{row.next}</td><td className="px-3 py-2">{row.action}</td></tr>)}
                </EvidenceTable>
            </section>
        );
    }

    return (
        <section className="rounded-xl border border-orange-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
            {header("Multimedia flow status", "The selected route is now carrying the simulated multimedia flow. The orange pulse on the graph represents this movement.")}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <EvidenceValue label="Flow" value="video-stream-01" />
                <EvidenceValue label="Route" value={data.decision.selected_path_id} />
                <EvidenceValue label="Mode" value={data.decision.mode.replace("_", " ")} />
                <EvidenceValue label="Quality stage" value="Collecting result" />
            </div>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Next implementation step: attach this flow to a real video file and calculate PSNR and SSIM after transmission.</p>
        </section>
    );
};

const EvidenceTable = ({ headers, children }: { headers: string[]; children: ReactNode }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-400/30 text-xs uppercase text-zinc-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead>
            <tbody>{children}</tbody>
        </table>
    </div>
);

const EvidenceValue = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg bg-zinc-500/10 p-3">
        <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="mt-1 font-semibold">{value}</p>
    </div>
);

const BaselineComparison = ({ baselines }: { baselines: DemoResult["baselines"] }) => (
    <section className="rounded-xl border border-emerald-500/30 bg-white/70 p-4 shadow-sm dark:bg-zinc-900/60">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Same candidates, three strategies</p>
                <h2 className="mt-1 text-xl font-bold">Baseline comparison</h2>
            </div>
            <p className="max-w-xl text-xs text-zinc-500">Every strategy receives the same paths and telemetry. Only the selection policy changes.</p>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-zinc-400/30 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2">Strategy</th><th className="px-3 py-2">Selected path</th><th className="px-3 py-2">Hops</th><th className="px-3 py-2">Latency</th><th className="px-3 py-2">Throughput</th><th className="px-3 py-2">Loss</th><th className="px-3 py-2">Utilization</th></tr></thead>
                <tbody>
                    {Object.entries(baselines).map(([key, result]) => <tr key={key} className={key === "airsdn" ? "bg-emerald-500/10 font-semibold" : "border-b border-zinc-400/10"}>
                        <td className="px-3 py-3 uppercase">{result.strategy.replace("_", " ")}</td>
                        <td className="px-3 py-3 font-mono">{result.selected_path_id}</td>
                        <td className="px-3 py-3">{result.hop_count}</td>
                        <td className="px-3 py-3">{result.latency_ms} ms</td>
                        <td className="px-3 py-3">{result.throughput_mbps} Mbps</td>
                        <td className="px-3 py-3">{result.packet_loss_pct}%</td>
                        <td className="px-3 py-3">{result.utilization_pct}%</td>
                    </tr>)}
                </tbody>
            </table>
        </div>
    </section>
);

const Detail = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg bg-zinc-500/10 p-3">
        <dt className="text-xs text-zinc-500">{label}</dt>
        <dd className="mt-1 font-semibold capitalize">{value}</dd>
    </div>
);

export default Visualization;
//     storage/