import { useEffect, useState } from "react";

type Scenario = "low" | "high";
type PlaybackSpeed = "slow" | "medium" | "fast";

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

type StrategyResult = {
    strategy: string;
    selected_path_id: string;
    latency_ms: number;
    throughput_mbps: number;
};

type DemoResult = {
    scenario: Scenario;
    source: number;
    destination: number;
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
    baselines: {
        hop_count: StrategyResult;
        qos_aware: StrategyResult;
        airsdn: StrategyResult;
    };
    stream?: {
        mode: string;
        forwarding: boolean;
        running_seconds: number;
        packets: { id: string; path: number[]; progress: number }[];
    };
};

const nodePositions: Record<number, { x: number; y: number }> = {
    0: { x: 58, y: 205 },
    1: { x: 138, y: 128 },
    2: { x: 138, y: 282 },
    3: { x: 225, y: 190 },
    4: { x: 300, y: 220 },
    5: { x: 292, y: 342 },
    6: { x: 385, y: 190 },
    7: { x: 465, y: 170 },
    8: { x: 545, y: 86 },
    9: { x: 715, y: 145 },
    10: { x: 560, y: 165 },
    11: { x: 638, y: 42 },
    12: { x: 650, y: 282 },
    13: { x: 550, y: 360 },
};

const algorithmStages = [
    { title: "Check the NSFNET topology", description: "Confirm all 14 switches and 20 inter-switch links are connected, then use the receiver at S0 and sender at S9." },
    { title: "Calculate candidate paths", description: "Enumerate loop-free paths, sort them by hop count, and keep the five shortest candidates." },
    { title: "Compare path telemetry", description: "Compare each candidate's latency / RTT estimate, throughput, packet loss, jitter, and link utilization." },
    { title: "Classify traffic", description: "Read the low / high traffic class and confidence for each path. These Windows demo predictions are deterministic scenario values." },
    { title: "Rank paths by QoE", description: "Normalize throughput, delay, loss, jitter, and utilization, then apply the weighted QoE score." },
    { title: "Choose route and forward", description: "Use a low-traffic prediction only when confidence reaches 90%; otherwise use the best QoE score. Packets follow the selected route." },
];

const playbackTimings: Record<PlaybackSpeed, { stepMs: number; packetSeconds: number }> = {
    slow: { stepMs: 3600, packetSeconds: 7.2 },
    medium: { stepMs: 1900, packetSeconds: 3.8 },
    fast: { stepMs: 850, packetSeconds: 1.7 },
};

const pathColors = ["#f59e0b", "#a78bfa", "#fb7185", "#34d399", "#38bdf8"];

function StrategyChart({ title, unit, items, color }: { title: string; unit: string; items: { label: string; value: number; path: string }[]; color: string }) {
    const chart = { left: 48, right: 456, top: 24, bottom: 174 };
    const maximum = Math.max(...items.map((item) => item.value), 1) * 1.18;
    const barWidth = 66;
    const centers = [116, 252, 388];
    return (
        <article className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
            <h3 className="font-semibold">{title}</h3>
            <svg viewBox="0 0 480 236" className="mt-2 h-auto w-full" role="img" aria-label={`${title} comparison for hop-count, QoS-aware, and AIRSDN routing`}>
                {[0, 1, 2, 3].map((tick) => {
                    const y = chart.bottom - (tick / 3) * (chart.bottom - chart.top);
                    return <g key={tick}><line x1={chart.left} y1={y} x2={chart.right} y2={y} stroke="#94a3b8" strokeOpacity=".24" /><text x={chart.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{(maximum * tick / 3).toFixed(0)}</text></g>;
                })}
                {items.map((item, index) => {
                    const height = (item.value / maximum) * (chart.bottom - chart.top);
                    const x = centers[index] - barWidth / 2;
                    const y = chart.bottom - height;
                    return <g key={item.label}><title>{`${item.label}: ${item.value} ${unit}; route ${item.path}`}</title><rect x={x} y={y} width={barWidth} height={height} rx="5" fill={index === 2 ? color : "#64748b"} opacity={index === 2 ? 0.9 : 0.58} /><text x={centers[index]} y={Math.max(y - 7, 15)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#cbd5e1">{item.value}</text><text x={centers[index]} y="194" textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8">{item.label}</text><text x={centers[index]} y="211" textAnchor="middle" fontSize="8" fill="#64748b">{item.path}</text></g>;
                })}
                <text x="12" y="15" fontSize="9" fill="#64748b">{unit}</text>
            </svg>
        </article>
    );
}

const Visualization = () => {
    const [scenario, setScenario] = useState<Scenario>("low");
    const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>("medium");
    const [activeStep, setActiveStep] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [data, setData] = useState<DemoResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        const forwarding = activeStep === algorithmStages.length - 1;
        const update = () => fetch(`/api/stream?scenario=${scenario}&forwarding=${forwarding}`)
            .then((response) => {
                if (!response.ok) throw new Error("The routing API returned an error.");
                return response.json() as Promise<DemoResult>;
            })
            .then((result) => { if (!cancelled) setData(result); })
            .catch(() => {
                if (!cancelled) {
                    setData(null);
                    setError("Start the Python API with: python -m backend.server");
                }
            });
        void update();
        const timer = window.setInterval(update, 700);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [scenario, activeStep]);

    useEffect(() => {
        if (!playing || activeStep >= algorithmStages.length - 1) {
            if (activeStep >= algorithmStages.length - 1) setPlaying(false);
            return;
        }
        const timer = window.setTimeout(() => setActiveStep((step) => Math.min(step + 1, algorithmStages.length - 1)), playbackTimings[playbackSpeed].stepMs);
        return () => window.clearTimeout(timer);
    }, [activeStep, playbackSpeed, playing]);

    const selectedPath = data?.decision.selected_path ?? [];
    const selectedPathD = selectedPath.map((node, index) => {
        const point = nodePositions[node];
        return `${index === 0 ? "M" : "L"}${point.x} ${point.y}`;
    }).join(" ");
    const candidatePathD = (path: number[]) => path.map((node, index) => {
        const point = nodePositions[node];
        return `${index === 0 ? "M" : "L"}${point.x} ${point.y}`;
    }).join(" ");
    const sortedCandidates = [...(data?.decision.candidates ?? [])].sort((left, right) => activeStep === 4 ? right.qoe_score - left.qoe_score : left.hop_count - right.hop_count || left.path_id.localeCompare(right.path_id));
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
                        Backend-driven NSFNET topology, routing decisions, and continuous packet flow.
                    </p>
                </div>
                <div className="flex gap-2" role="group" aria-label="Traffic scenario">
                    {(["low", "high"] as Scenario[]).map((option) => (
                            <button
                            key={option}
                            type="button"
                                onClick={() => { setScenario(option); setActiveStep(0); setPlaying(true); }}
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
                                    NSFNET · 14 SWITCHES
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
                                <line x1="32" y1="205" x2={nodePositions[data.source].x - 17} y2="205" stroke="#64748b" strokeWidth="2" />
                                <g aria-label="Receiver host connected to switch S0">
                                    <rect x="10" y="190" width="20" height="15" rx="2" fill="#f4f4f5" stroke="#64748b" strokeWidth="2" />
                                    <path d="M14 209h12m-6-4v4" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
                                    <text x="20" y="228" textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b">RECEIVER</text>
                                </g>
                                <line x1={nodePositions[data.destination].x + 17} y1="145" x2="756" y2="145" stroke="#64748b" strokeWidth="2" />
                                <g aria-label="Server sender connected to switch S9">
                                    <rect x="758" y="130" width="19" height="29" rx="3" fill="#f4f4f5" stroke="#64748b" strokeWidth="2" />
                                    <circle cx="772" cy="136" r="1.5" fill="#34d399" />
                                    <path d="M762 143h10m-10 5h10m-10 5h7" stroke="#64748b" strokeWidth="1.5" />
                                    <text x="767" y="174" textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b">SENDER</text>
                                </g>
                                <g aria-label="Floodlight SDN controller">
                                    <rect x="335" y="16" width="134" height="31" rx="7" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.5" />
                                    <circle cx="351" cy="31.5" r="6" fill="#2563eb" />
                                    <text x="402" y="29" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1e3a8a">FLOODLIGHT SDN</text>
                                    <text x="402" y="39" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1e3a8a">CONTROLLER</text>
                                </g>
                                {activeStep > 0 && activeStep < algorithmStages.length - 1 && data.decision.candidates.map((candidate, index) => {
                                    const rank = sortedCandidates.findIndex((item) => item.path_id === candidate.path_id);
                                    const color = activeStep === 3
                                        ? candidate.predicted_traffic === "low" ? "#34d399" : "#fb923c"
                                        : activeStep === 4
                                            ? rank === 0 ? "#fbbf24" : "#94a3b8"
                                            : pathColors[index % pathColors.length];
                                    return <path key={`candidate-${candidate.path_id}`} d={candidatePathD(candidate.path)} fill="none" stroke={color} strokeWidth={rank === 0 ? 3.5 : 2.5} strokeDasharray={activeStep === 1 ? "7 6" : undefined} strokeLinecap="round" strokeLinejoin="round" opacity={activeStep === 4 && rank > 0 ? 0.28 : 0.55} />;
                                })}
                                {selectedPath.length > 1 && <path id="selected-packet-route" d={selectedPathD} fill="none" stroke="none" />}
                                {activeStep === algorithmStages.length - 1 && selectedPath.length > 1 && (data.stream?.packets ?? []).map((packet, index) => (
                                    <circle key={packet.id} r={index % 2 === 0 ? 5 : 3.5} fill={index % 2 === 0 ? "#fbbf24" : "#22d3ee"} stroke="#0f172a" strokeWidth="1.5">
                                        <animateMotion dur={`${playbackTimings[playbackSpeed].packetSeconds}s`} repeatCount="indefinite" begin={`${-packet.progress * playbackTimings[playbackSpeed].packetSeconds}s`}>
                                            <mpath href="#selected-packet-route" />
                                        </animateMotion>
                                    </circle>
                                ))}
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
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                                <span>Source S{data.source} → destination S{data.destination} · {data.links.length} physical links</span>
                                <span className={`font-semibold ${activeStep === algorithmStages.length - 1 ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500"}`}>{activeStep === algorithmStages.length - 1 ? `${data.stream?.packets.length ?? 0} packets in flight · continuous` : "Packets held until route selection"}</span>
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">Step {activeStep + 1} / {algorithmStages.length}: {algorithmStages[activeStep].title}</p>
                            <p className="mt-1 text-[11px] text-zinc-500">Backend simulation stream. Mininet and Floodlight adapters remain in the project for Linux deployment; they are not active in this Windows demo.</p>
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

                    <section className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold">Algorithm walkthrough</h2>
                                <p className="mt-1 text-xs text-zinc-500">Step {activeStep + 1} of {algorithmStages.length} · {algorithmStages[activeStep].title}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="mr-1 text-xs text-zinc-500">Packet and walkthrough speed</span>
                                {(["slow", "medium", "fast"] as PlaybackSpeed[]).map((speed) => <button key={speed} type="button" onClick={() => setPlaybackSpeed(speed)} aria-pressed={playbackSpeed === speed} className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize ${playbackSpeed === speed ? "border-blue-700 bg-blue-700 text-white" : "border-zinc-400/40 hover:border-blue-500"}`}>{speed}</button>)}
                                <button type="button" onClick={() => { if (activeStep === algorithmStages.length - 1) setActiveStep(0); setPlaying((value) => !value); }} className="rounded-lg border border-zinc-400/40 px-3 py-2 text-xs font-semibold">{playing ? "Pause" : "Play"}</button>
                                <button type="button" onClick={() => { setActiveStep(0); setPlaying(true); }} className="rounded-lg border border-zinc-400/40 px-3 py-2 text-xs font-semibold">Restart</button>
                                <button type="button" onClick={() => { setPlaying(false); setActiveStep((step) => Math.min(step + 1, algorithmStages.length - 1)); }} className="rounded-lg border border-zinc-400/40 px-3 py-2 text-xs font-semibold">Next step</button>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {algorithmStages.map((stage, index) => <button key={stage.title} type="button" onClick={() => { setActiveStep(index); setPlaying(false); }} aria-current={activeStep === index ? "step" : undefined} className={`rounded-lg border p-3 text-left transition ${activeStep === index ? "border-blue-600 bg-blue-600/10" : "border-zinc-400/20 hover:border-blue-400"}`}>
                                <span className={`font-mono text-[10px] font-bold ${activeStep === index ? "text-blue-700 dark:text-blue-300" : "text-zinc-500"}`}>STEP {String(index + 1).padStart(2, "0")}</span>
                                <span className="ml-2 text-xs font-semibold">{stage.title}</span>
                            </button>)}
                        </div>
                        <p className="mt-3 rounded-lg bg-zinc-500/[0.06] p-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{algorithmStages[activeStep].description}{activeStep === 5 ? ` Current decision: ${data.decision.reason} Selected path: ${data.decision.selected_path_id.replaceAll("-", " → ")}.` : ""}</p>
                        <p className="mt-2 text-[11px] text-zinc-500">Traffic class and telemetry values are scenario simulation data. Packet animation follows the backend-selected path; it does not claim live switch traffic.</p>
                    </section>

                    <div className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div><h2 className="text-lg font-bold">Candidate paths and telemetry</h2><p className="mt-1 text-xs text-zinc-500">Rows highlight and reorder to match the current algorithm step. RTT / delay and traffic values are simulated.</p></div>
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{data.scenario.toUpperCase()} TRAFFIC · STEP {activeStep + 1}</span>
                        </div>
                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[1180px] text-left text-sm">
                                <thead className="border-b border-zinc-400/30 text-xs uppercase text-zinc-500">
                                    <tr><th className="px-3 py-2">Path</th><th className="px-3 py-2">Hops</th><th className="px-3 py-2">Traffic</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2">RTT / delay</th><th className="px-3 py-2">Throughput</th><th className="px-3 py-2">Packet loss</th><th className="px-3 py-2">Jitter</th><th className="px-3 py-2">Utilization</th><th className="px-3 py-2">QoE</th><th className="px-3 py-2">Step result</th></tr>
                                </thead>
                                <tbody>
                                    {sortedCandidates.map((candidate, rank) => {
                                        const selected = candidate.path_id === data.decision.selected_path_id;
                                        const stepResult = activeStep === 0 ? "Topology checked" : activeStep === 1 ? "Path calculated" : activeStep === 2 ? "Metrics compared" : activeStep === 3 ? `${candidate.predicted_traffic} traffic` : activeStep === 4 ? `QoE rank #${rank + 1}` : selected ? "Forwarding" : "Alternate";
                                        const rowClass = activeStep === 5 && selected ? "bg-blue-500/15 font-semibold" : activeStep === 3 ? candidate.predicted_traffic === "low" ? "bg-emerald-500/[0.06]" : "bg-orange-500/[0.06]" : activeStep === 4 && rank === 0 ? "bg-amber-500/10 font-semibold" : selected ? "bg-blue-500/[0.05]" : "border-b border-zinc-400/10";
                                        return <tr key={candidate.path_id} className={rowClass}>
                                            <td className="px-3 py-3 font-mono">{candidate.path_id.replaceAll("-", " → ")}</td>
                                            <td className="px-3 py-3">{candidate.hop_count}</td>
                                            <td className="px-3 py-3 capitalize">{candidate.predicted_traffic}</td>
                                            <td className="px-3 py-3">{(candidate.confidence * 100).toFixed(0)}%</td>
                                            <td className="px-3 py-3">{candidate.latency_ms} ms</td>
                                            <td className="px-3 py-3">{candidate.throughput_mbps} Mbps</td>
                                            <td className="px-3 py-3">{Number(candidate.packet_loss_pct.toFixed(2))}%</td>
                                            <td className="px-3 py-3">{candidate.jitter_ms} ms</td>
                                            <td className="px-3 py-3">{candidate.utilization_pct}%</td>
                                            <td className="px-3 py-3">{candidate.qoe_score.toFixed(2)}</td>
                                            <td className="px-3 py-3 text-xs font-semibold">{stepResult}</td>
                                        </tr>;
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <section className="rounded-xl border border-zinc-400/30 bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold">Research metrics comparison</h2>
                            <p className="mt-1 text-xs text-zinc-500">Hop-count, QoS-aware, and AIRSDN results for the selected {data.scenario}-traffic scenario.</p>
                            <p className="mt-1 text-[11px] text-zinc-500">Throughput and RTT-style metrics follow the paper's comparison themes. Values here are calculated from this project's simulated scenario data, not copied research-paper results.</p>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <StrategyChart title="Throughput by routing strategy" unit="Mbps" color="#2563eb" items={[
                                { label: "Hop Count", value: data.baselines.hop_count.throughput_mbps, path: data.baselines.hop_count.selected_path_id },
                                { label: "QoS-aware", value: data.baselines.qos_aware.throughput_mbps, path: data.baselines.qos_aware.selected_path_id },
                                { label: "AIRSDN", value: data.baselines.airsdn.throughput_mbps, path: data.baselines.airsdn.selected_path_id },
                            ]} />
                            <StrategyChart title="RTT / latency by routing strategy" unit="ms" color="#0d9488" items={[
                                { label: "Hop Count", value: data.baselines.hop_count.latency_ms, path: data.baselines.hop_count.selected_path_id },
                                { label: "QoS-aware", value: data.baselines.qos_aware.latency_ms, path: data.baselines.qos_aware.selected_path_id },
                                { label: "AIRSDN", value: data.baselines.airsdn.latency_ms, path: data.baselines.airsdn.selected_path_id },
                            ]} />
                        </div>
                    </section>
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
