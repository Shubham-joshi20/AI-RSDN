import { useEffect, useState } from "react";

type Scenario = "low" | "high";

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

const Visualization = () => {
    const [scenario, setScenario] = useState<Scenario>("low");
    const [data, setData] = useState<DemoResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
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
        return () => {
            cancelled = true;
        };
    }, [scenario]);

    const selectedPath = data?.decision.selected_path ?? [];
    const selectedLinks = new Set(
        selectedPath.slice(0, -1).map((node, index) => {
            const next = selectedPath[index + 1];
            return node < next ? `${node}-${next}` : `${next}-${node}`;
        }),
    );

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
                </div>
            </header>

            {error ? (
                <div className="rounded-xl border border-amber-500/50 bg-amber-100/70 p-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">Backend connection unavailable</p>
                    <p className="mt-1 text-sm">{error}</p>
                </div>
            ) : data ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric label="Routing mode" value={data.decision.mode.replace("_", " ")} />
                        <Metric label="Active path" value={data.decision.selected_path_id} />
                        <Metric label="Confidence" value={`${(data.decision.selected_confidence * 100).toFixed(0)}%`} />
                        <Metric label="Topology" value={`${data.topology.node_count} nodes / ${data.topology.edge_count} links`} />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                        <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold">Topology and active route</h2>
                                    <p className="text-xs text-zinc-500">Source S0 to destination S9</p>
                                </div>
                                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    VALIDATED
                                </span>
                            </div>
                            <svg viewBox="0 0 805 400" className="h-auto w-full" role="img" aria-label="Network topology">
                                {data.links.map((link) => {
                                    const start = nodePositions[link.source];
                                    const end = nodePositions[link.target];
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
                                {data.nodes.map((node) => {
                                    const position = nodePositions[node.id];
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

const Detail = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg bg-zinc-500/10 p-3">
        <dt className="text-xs text-zinc-500">{label}</dt>
        <dd className="mt-1 font-semibold capitalize">{value}</dd>
    </div>
);

export default Visualization;
//     storage/