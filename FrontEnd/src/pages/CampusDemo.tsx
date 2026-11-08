import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SiteId = "cse" | "ece" | "civil" | "main" | "mech" | "library" | "centre" | "jubilee" | "everest" | "beach" | "guest" | "sports";
type CandidateId = "P1" | "P2" | "P3" | "P4" | "P5";
type Incident = "normal" | "surge" | "link_down";
type Site = { id: SiteId; name: string; point: [number, number] };
type Candidate = { id: CandidateId; path: SiteId[]; highProbability: number; confidence: number; qoe: number; status: string };
type FeedItem = { time: string; title: string; detail: string };

const sites: Site[] = [
  { id: "beach", name: "Beach Gate", point: [150, 221] },
  { id: "guest", name: "Bhabha Guest House", point: [388, 105] },
  { id: "cse", name: "Computer Science", point: [400, 235] },
  { id: "civil", name: "Civil Engineering", point: [605, 198] },
  { id: "ece", name: "Electronics & Communication", point: [515, 292] },
  { id: "main", name: "Main Building", point: [691, 280] },
  { id: "mech", name: "Mechanical Engineering", point: [765, 142] },
  { id: "library", name: "Central Library", point: [707, 342] },
  { id: "centre", name: "Computer Centre", point: [837, 329] },
  { id: "sports", name: "Sports Complex", point: [996, 226] },
  { id: "jubilee", name: "Jubilee Auditorium", point: [856, 396] },
  { id: "everest", name: "Everest Hostel", point: [816, 484] },
];

const paths: Record<CandidateId, SiteId[]> = {
  P1: ["cse", "civil", "main", "library", "everest"],
  P2: ["cse", "ece", "main", "library", "everest"],
  P3: ["cse", "civil", "mech", "centre", "jubilee", "everest"],
  P4: ["cse", "civil", "mech", "sports", "centre", "jubilee", "everest"],
  P5: ["cse", "guest", "beach", "civil", "main", "centre", "jubilee", "everest"],
};
const ids: CandidateId[] = ["P1", "P2", "P3", "P4", "P5"];
const routeColors: Record<CandidateId, string> = { P1: "#5eead4", P2: "#60a5fa", P3: "#fbbf24", P4: "#c4b5fd", P5: "#f472b6" };
const surgeSources: Partial<Record<SiteId, SiteId>> = { main: "ece", library: "main", centre: "mech" };
const site = (id: SiteId) => sites.find((entry) => entry.id === id)!;
const points = (path: SiteId[]) => path.map((id) => site(id).point.map(String).join(",")).join(" ");
const routePath = (path: SiteId[]) => path.map((id, index) => `${index === 0 ? "M" : "L"}${site(id).point[0]} ${site(id).point[1]}`).join(" ");
const toClock = (seconds: number) => {
  const whole = Math.floor(seconds);
  return [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60].map((value) => String(value).padStart(2, "0")).join(":");
};

function candidatesFor(incident: Incident, surgeNode: SiteId | null): Candidate[] {
  const rows: Candidate[] = [
    { id: "P1", path: paths.P1, highProbability: 0.07, confidence: 0.93, qoe: 0.82, status: "Gate pass" },
    { id: "P2", path: paths.P2, highProbability: 0.06, confidence: 0.94, qoe: 0.88, status: "Gate pass" },
    { id: "P3", path: paths.P3, highProbability: 0.35, confidence: 0.65, qoe: 0.94, status: "Low confidence" },
    { id: "P4", path: paths.P4, highProbability: 0.94, confidence: 0.94, qoe: 0.78, status: "High traffic" },
    { id: "P5", path: paths.P5, highProbability: 0.03, confidence: 0.97, qoe: 0.90, status: "Stale probe" },
  ];
  if (incident === "surge" && surgeNode) return rows.map((row) => {
    if (!row.path.includes(surgeNode)) return row;
    return { ...row, highProbability: 0.72, confidence: 0.72, qoe: 0.28, status: "Queue building" };
  });
  if (incident === "link_down") return rows.map((row) => {
    if (row.id === "P3") return { ...row, confidence: 0, qoe: 0, status: "Link down" };
    if (row.id === "P1") return { ...row, highProbability: 0.08, confidence: 0.92, qoe: 0.86, status: "Selected" };
    return row;
  });
  return rows;
}

function selectRoute(incident: Incident, candidates: Candidate[], surgeNode: SiteId | null): { id: CandidateId; mode: "ML_ROUTING" | "QOE_FALLBACK" } {
  if (incident === "link_down") return { id: "P1", mode: "ML_ROUTING" };
  if (incident === "normal") return { id: "P2", mode: "ML_ROUTING" };
  const eligible = candidates.filter((candidate) => candidate.confidence >= 0.9 && candidate.highProbability <= 0.1 && candidate.id !== "P5");
  if (eligible.length) {
    const selected = eligible.reduce((best, candidate) => candidate.confidence > best.confidence ? candidate : best);
    return { id: selected.id, mode: "ML_ROUTING" };
  }
  const feasible = candidates.filter((candidate) => candidate.id !== "P5" && candidate.status !== "High traffic" && candidate.status !== "Queue building" && (!surgeNode || !candidate.path.includes(surgeNode)));
  const selected = feasible.reduce((best, candidate) => candidate.qoe > best.qoe ? candidate : best);
  return { id: selected.id, mode: "QOE_FALLBACK" };
}

function metricValues(elapsed: number, incident: Incident) {
  const noise = Math.sin(elapsed * 0.73);
  const starting = elapsed < 14;
  const surge = incident === "surge";
  return {
    congestion: Math.round((surge ? 82 : 19) + noise * (surge ? 5 : 2)),
    loss: Number(Math.max(0.03, (surge ? 2.34 : 0.11) + noise * 0.08).toFixed(2)),
    bandwidth: Math.round((surge ? 26 : incident === "link_down" ? 127 : 142) + noise * 5),
    rtt: Number((surge ? 101 : incident === "link_down" ? 22.4 : 23.2 + noise * 2).toFixed(1)),
    traffic: starting ? 0 : Math.round((surge ? 374 : 258) + noise * 18),
    psnr: starting ? null : Number((surge ? 19 + noise : 31.4 + noise * 0.5).toFixed(1)),
    ssim: starting ? null : Number((surge ? Math.max(0.2, 0.65 + noise * 0.1) : 0.951 + noise * 0.008).toFixed(3)),
    jitter: surge ? 14.7 : incident === "link_down" ? 2.9 : 3.3,
  };
}

function sparkline(seed: number, elapsed: number, stress: boolean) {
  return Array.from({ length: 24 }, (_, index) => {
    const x = (index / 23) * 320;
    let y = 49 + Math.sin(index * 1.37 + seed + elapsed * 0.24) * 4 + Math.sin(index * 0.39 + seed + elapsed * 0.11) * 5;
    if (stress && index > 18) y -= Math.min(42, (index - 18) * 8);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${Math.max(5, Math.min(75, y)).toFixed(1)}`;
  }).join(" ");
}

function MetricCard({ title, value, unit, subtitle, color, seed, elapsed, stress = false, bars = false }: {
  title: string; value: string; unit: string; subtitle: string; color: string; seed: number; elapsed: number; stress?: boolean; bars?: boolean;
}) {
  return <article className="rounded-xl border border-white/10 bg-[#101f21] p-4">
    <div className="flex items-end justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-200">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><p className="shrink-0 text-2xl font-semibold text-slate-100">{value}<span className="ml-1 text-sm text-slate-400">{unit}</span></p></div>
    <svg viewBox="0 0 320 82" className="mt-3 h-16 w-full" role="img" aria-label={`${title} simulated trend`}>
      <path d="M0 20 H320 M0 42 H320 M0 64 H320" stroke="rgba(148,163,184,.12)" strokeDasharray="3 5" />
      {bars ? Array.from({ length: 28 }, (_, index) => <rect key={index} x={index * 12} y={stress && index > 21 ? 12 + (index % 3) * 3 : 67} width="5" height={stress && index > 21 ? 55 - (index % 3) * 3 : 4} rx="2" fill={color} opacity=".72" />) : <path d={sparkline(seed, elapsed, stress)} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
    <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>−30 s</span><span>−20 s</span><span>−10 s</span><span>Now</span></div>
  </article>;
}

function EventFeedPanel({ events }: { events: FeedItem[] }) {
  return <section className="rounded-xl border border-white/10 bg-[#101f21] p-4">
    <div className="flex items-center justify-between"><div><h2 className="font-semibold">Event feed</h2><p className="mt-1 text-[10px] text-slate-500">Recent probes, route changes, and network events</p></div><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /></div>
    <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {events.length ? events.slice(0, 6).map((event, index) => <div key={`${event.time}-${event.title}-${index}`} className="border-l border-emerald-300/30 pl-3"><p className="font-mono text-[10px] text-emerald-200">{event.time}</p><p className="mt-0.5 text-xs font-semibold text-slate-200">{event.title}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">{event.detail}</p></div>) : <p className="text-xs text-slate-500">Waiting for the first path-probe events…</p>}
    </div>
  </section>;
}

const CampusDemo = () => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState<"discovering" | "streaming">("discovering");
  const [revealedCount, setRevealedCount] = useState(0);
  const [incident, setIncident] = useState<Incident>("normal");
  const [surgeNode, setSurgeNode] = useState<SiteId | null>(null);
  const [eventFeed, setEventFeed] = useState<FeedItem[]>([]);
  const [session, setSession] = useState(0);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  const logEvent = useCallback((title: string, detail: string) => {
    const item = { time: toClock(elapsedRef.current), title, detail };
    setEventFeed((items) => [item, ...items].slice(0, 10));
  }, []);

  const candidates = useMemo(() => candidatesFor(incident, surgeNode), [incident, surgeNode]);
  const selection = selectRoute(incident, candidates, surgeNode);
  const activeId = phase === "streaming" ? selection.id : null;
  const active = candidates.find((candidate) => candidate.id === activeId);
  const metrics = metricValues(elapsed, incident);
  const stressed = incident === "surge";
  const queueCount = stressed ? 16 + (elapsed % 9) : 0;

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setElapsed((time) => time + 1), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [running, speed, session]);

  useEffect(() => {
    if (!running || phase !== "discovering") return undefined;
    const timer = window.setTimeout(() => {
      if (revealedCount < ids.length) {
        const candidateId = ids[revealedCount];
        setRevealedCount((count) => count + 1);
        logEvent(`${candidateId} discovered`, `Candidate route ${candidateId} is being probed.`);
      } else {
        setPhase("streaming");
        logEvent("Route selected · stream started", "P2 passes the 90% confidence gate; packets begin moving to Everest Hostel.");
      }
    }, 1250 / speed);
    return () => window.clearTimeout(timer);
  }, [logEvent, phase, revealedCount, running, session, speed]);

  useEffect(() => {
    if (!running || phase !== "streaming") return undefined;
    if (incident === "normal") {
      const timer = window.setTimeout(() => {
        const next: Incident = Math.random() < 0.62 ? "surge" : "link_down";
        setIncident(next);
        if (next === "surge") {
          const hotspots: SiteId[] = ["main", "library", "centre"];
          const hotspot = hotspots[Math.floor(Math.random() * hotspots.length)];
          setSurgeNode(hotspot);
          logEvent(`Traffic surge · ${site(hotspot).name}`, `More packets are arriving at ${site(hotspot).name}; its queue is building and candidate routes are being checked.`);
        } else {
          setSurgeNode(null);
          logEvent("Link failure", "Mechanical Engineering–Computer Centre link is down. The controller is checking alternates.");
        }
      }, (8 + Math.random() * 9) * 1000 / speed);
      return () => window.clearTimeout(timer);
    }
    const wasSurge = incident === "surge";
    const timer = window.setTimeout(() => {
      setIncident("normal");
      setSurgeNode(null);
      logEvent(wasSurge ? "Traffic normalized" : "Link restored", wasSurge ? "Congestion cleared; P2 wins the confidence gate again." : "All 18 links are available; the current path is retained until the next evaluation.");
    }, (wasSurge ? 10 + Math.random() * 6 : 6 + Math.random() * 5) * 1000 / speed);
    return () => window.clearTimeout(timer);
  }, [incident, logEvent, phase, running, session, speed]);

  const reset = () => {
    setRunning(true);
    setElapsed(0);
    setPhase("discovering");
    setRevealedCount(0);
    setIncident("normal");
    setSurgeNode(null);
    setEventFeed([]);
    setSession((value) => value + 1);
  };

  const headline = phase === "discovering" ? `Discovering routes · ${revealedCount} of 5` : incident === "surge" ? selection.mode === "QOE_FALLBACK" ? `Queue at ${surgeNode ? site(surgeNode).name : "campus node"} · QoE selects ${selection.id}` : `Queue at ${surgeNode ? site(surgeNode).name : "campus node"} · ${selection.id} stays clear` : incident === "link_down" ? "Link failure · P1 reroute" : "P2 carries the video stream";
  const status = phase === "discovering" ? "PROBING" : incident === "surge" ? selection.mode === "QOE_FALLBACK" ? "QOE FALLBACK" : "REROUTED" : incident === "link_down" ? "REROUTING" : "STREAMING";
  const displayedCandidates = phase === "discovering" ? ids.slice(0, revealedCount).map((id) => candidates.find((row) => row.id === id)!) : candidates;
  const activeRouteColor = activeId ? routeColors[activeId] : "#5eead4";

  return <section className="mx-auto w-full max-w-[1700px] px-3 py-4 text-left text-slate-100 sm:px-5 lg:px-7">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-300"><svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M16 4 5 11v10l11 7 11-7V11L16 4Z"/><path d="m5 11 11 7 11-7M16 18v10M16 4v14"/><circle cx="16" cy="4" r="2" fill="currentColor"/><circle cx="5" cy="11" r="2" fill="currentColor"/><circle cx="27" cy="11" r="2" fill="currentColor"/><circle cx="5" cy="21" r="2" fill="currentColor"/><circle cx="27" cy="21" r="2" fill="currentColor"/><circle cx="16" cy="28" r="2" fill="currentColor"/></svg></span><div><p className="text-2xl font-semibold tracking-tight">AIRSDN <span className="mx-2 text-slate-600">/</span><span className="text-lg font-medium text-slate-300">Campus multimedia routing</span></p><p className="text-xs tracking-wide text-slate-500">National Institute of Technology Karnataka, Surathkal</p></div></div>
      <div className="flex items-center gap-3 text-xs"><span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 font-mono tracking-widest text-emerald-200">● SIMULATION</span><span className="hidden border-l border-white/10 pl-4 sm:inline"><span className="block text-[9px] uppercase tracking-widest text-slate-500">Controller</span><span className="font-medium text-slate-300">Floodlight model</span></span><span className="border-l border-white/10 pl-4"><span className="block text-[9px] uppercase tracking-widest text-slate-500">Running time</span><span className="font-mono text-base tabular-nums">{toClock(elapsed)}</span></span></div>
    </header>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(350px,0.95fr)]">
      <div className="flex min-w-0 flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101f21]">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-white/10 px-4 py-3"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-emerald-300/80">Campus satellite</p><h1 className="text-lg font-semibold">NITK Surathkal</h1></div><p className="text-xs text-slate-400">Video 12 Mb/s <span className="mx-2 text-slate-600">·</span> RTT &lt; 60 ms <span className="mx-2 text-slate-600">·</span> Jitter &lt; 12 ms <span className="mx-2 text-slate-600">·</span> Loss &lt; 2%</p><p className="font-mono text-xs text-slate-400">12 sites <span className="mx-1 text-slate-600">/</span> {incident === "link_down" ? 17 : 18} links up</p></div>
        <div className="relative aspect-[1.2] overflow-hidden bg-slate-900 sm:aspect-[1162/474]">
          <img src="/nitk-campus-satellite.png" alt="Satellite map of NITK Surathkal with campus network sites" className="absolute inset-0 h-full w-full object-cover" />
          <svg viewBox="0 56 1162 474" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-label="Campus candidate routes and moving video packets">
            {phase === "discovering" && ids.slice(0, revealedCount).map((id) => <polyline key={id} points={points(paths[id])} fill="none" stroke={routeColors[id]} strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" opacity=".8" />)}
            {incident === "link_down" && <g><line x1={site("mech").point[0]} y1={site("mech").point[1]} x2={site("centre").point[0]} y2={site("centre").point[1]} stroke="#fb7185" strokeWidth="5" strokeDasharray="8 8"/><circle cx="801" cy="234" r="11" fill="#190d16" stroke="#fb7185" strokeWidth="2"/><path d="m797 230 8 8m0-8-8 8" stroke="#fb7185" strokeWidth="2"/><text x="815" y="238" fill="#fecdd3" fontSize="12" fontWeight="700">LINK DOWN</text></g>}
            {active && <path id="active-route" d={routePath(active.path)} fill="none" stroke={activeRouteColor} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".98" style={{ filter: "drop-shadow(0 0 6px rgba(45,212,191,.85))", strokeDasharray: "14 8", animation: "airsdn-route 1.2s linear infinite" }} />}
            {incident === "surge" && surgeNode && (() => {
              const [x, y] = site(surgeNode).point;
              const sourceNode = surgeSources[surgeNode] ?? "main";
              return <g>
                <path id="surge-inbound" d={routePath([sourceNode, surgeNode])} fill="none" stroke="#fb923c" strokeWidth="3" strokeDasharray="4 6" opacity=".85" />
                {Array.from({ length: 8 }, (_, index) => <circle key={`incoming-${index}`} r={index % 3 === 0 ? 4 : 3} fill="#fdba74" stroke="#7c2d12" strokeWidth="1"><animateMotion dur="1.7s" repeatCount="indefinite" begin={`${index * -0.21}s`}><mpath href="#surge-inbound" /></animateMotion></circle>)}
                <circle cx={x} cy={y} r="23" fill="none" stroke="#fb923c" strokeWidth="2" opacity=".85"><animate attributeName="r" values="18;36;18" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".85;.18;.85" dur="1.8s" repeatCount="indefinite"/></circle>
                {Array.from({ length: 18 }, (_, index) => { const angle = (index / 18) * Math.PI * 2 + elapsed * 0.16; const radius = 13 + (index % 3) * 6; return <circle key={`queued-${index}`} cx={x + Math.cos(angle) * radius} cy={y + Math.sin(angle) * radius} r={index % 4 === 0 ? 4 : 2.8} fill={index % 4 === 0 ? "#fb923c" : "#fde68a"} stroke="#7c2d12" strokeWidth=".8"/>; })}
                <rect x={x + 17} y={y + 16} width="122" height="36" rx="5" fill="#111827" fillOpacity=".94" stroke="#fb923c" strokeOpacity=".8" />
                <text x={x + 24} y={y + 30} fill="#fdba74" fontSize="9" fontWeight="700" letterSpacing="1">TRAFFIC SURGE</text>
                <text x={x + 24} y={y + 44} fill="#fff7ed" fontSize="11" fontWeight="700">{queueCount} packets queued</text>
              </g>;
            })()}
            {active && active.path.map((id) => { const [x, y] = site(id).point; return <circle key={id} cx={x} cy={y} r="5" fill="#ecfeff" stroke={activeRouteColor} strokeWidth="2"/>; })}
            {active && running && Array.from({ length: 7 }, (_, index) => <circle key={index} r={index % 3 === 0 ? 5 : 3.5} fill={index % 3 === 0 ? "#fef08a" : "#ffffff"} stroke="#0f766e" strokeWidth="1.5"><animateMotion dur="3.2s" repeatCount="indefinite" begin={`${index * -0.46}s`}><mpath href="#active-route"/></animateMotion></circle>)}
            <style>{"@keyframes airsdn-route { to { stroke-dashoffset: -44; } }"}</style>
          </svg>
          <div className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">{phase === "discovering" ? "Candidate paths" : "Live simulation event"}</p><p className="max-w-sm text-xs text-white">{phase === "discovering" ? `Revealing route ${Math.min(revealedCount + 1, 5)} of 5: Computer Science → Everest Hostel` : incident === "normal" ? "Video packets are moving along the selected route." : incident === "surge" ? `Extra packets are queuing at ${surgeNode ? site(surgeNode).name : "a campus node"}; ${queueCount} packets waiting.` : "Link failure detected; rerouting packets around the failed link."}</p></div>
          {active && <span className="absolute right-3 top-3 rounded-md border border-emerald-200/30 bg-slate-950/80 px-2 py-1 text-[10px] font-mono font-bold text-emerald-100">{active.id} · {active.path.length - 1} HOPS · PACKETS MOVING</span>}
        </div>
        <div className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 p-4"><span className={`grid h-11 w-11 place-items-center rounded-full border-2 text-xs font-bold ${incident === "link_down" ? "border-rose-400 text-rose-300" : "border-emerald-300 text-emerald-200"}`}>{incident === "link_down" ? "17/18" : "18/18"}</span><div><p className="text-xs text-slate-400">Campus links</p><p className="text-sm font-semibold">{incident === "link_down" ? "Alternate path active" : "All links available"}</p></div></div>
          <div className="p-4"><p className="text-xs text-slate-400">Network traffic</p><p className="text-xl font-semibold">{metrics.traffic}<span className="ml-1 text-xs font-normal text-slate-400">Mb/s</span></p></div>
          <div className="p-4"><p className="text-xs text-slate-400">Forwarding path</p><p className="mt-1 text-sm font-semibold text-emerald-200">{active ? `${active.id} · ${active.path.length - 1} hops` : "Probing candidate paths"}</p><p className="mt-1 truncate text-[10px] text-slate-500">{active ? active.path.map((id) => site(id).name.split(" ")[0]).join(" → ") : "Computer Science → Everest Hostel"}</p></div>
        </div>
      </div>
      <EventFeedPanel events={eventFeed} />
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-xl border border-white/10 bg-[#101f21] p-4">
          <div className="flex items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">Path selection</h2><p className="mt-1 text-[11px] text-slate-400">Logistic regression model · 90% confidence gate · P(high) ≤ 0.10</p></div><span className="shrink-0 font-mono text-[9px] font-bold tracking-wider text-emerald-300">{displayedCandidates.length}/5 PATHS · {status}</span></div>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[360px] text-left text-xs"><thead className="border-b border-white/10 text-[10px] text-slate-500"><tr><th className="py-2">Path</th><th>P(high)</th><th>Confidence</th><th>QoE</th><th>Path check</th></tr></thead><tbody>{displayedCandidates.map((row) => { const selected = row.id === activeId; const isDown = incident === "link_down" && row.id === "P3"; return <tr key={row.id} className={`border-b border-white/5 ${selected ? "bg-emerald-300/10 text-emerald-200" : "text-slate-300"}`}><td className="py-2.5 font-mono font-semibold">{row.id}</td><td>{isDown ? "—" : row.highProbability.toFixed(2)}</td><td>{isDown ? "—" : row.confidence.toFixed(2)}</td><td>{isDown ? "—" : row.qoe.toFixed(2)}</td><td className={isDown || row.status.includes("limits") || row.status.includes("Queue") ? "text-rose-300" : row.status.includes("confidence") || row.status.includes("traffic") ? "text-amber-200" : "text-emerald-200"}>● {selected ? "Selected" : row.status}</td></tr>; })}</tbody></table>{phase === "discovering" && <p className="mt-2 text-[10px] text-slate-500">Checking one candidate at a time before starting the video stream.</p>}</div>
          <div className="mt-3 border-t border-white/10 pt-3"><h3 className={`font-semibold ${incident === "link_down" ? "text-rose-300" : incident === "surge" ? "text-emerald-300" : "text-teal-200"}`}>{headline}</h3><p className="mt-1 text-xs leading-5 text-slate-300">{phase === "discovering" ? "The controller discovers candidate routes in sequence and probes each one before allowing video traffic." : incident === "surge" ? selection.mode === "QOE_FALLBACK" ? `The ${surgeNode ? site(surgeNode).name : "hotspot"} queue makes P1 and P2 exceed limits. P3 avoids the busy node and wins the QoE fallback.` : `Extra packets are piling up at ${surgeNode ? site(surgeNode).name : "the hotspot"}. ${selection.id} stays on a route that avoids the queue and passes the confidence gate.` : incident === "link_down" ? "P3 crosses the failed link. P1 is selected and packets continue over the alternate route." : "P2 passes the confidence gate and has the best QoE score among eligible routes."}</p></div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#101f21] p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Video quality</h2><span className="text-[9px] uppercase tracking-widest text-slate-500">Simulated preview</span></div><div className="relative mt-3 grid aspect-video grid-cols-2 overflow-hidden rounded-lg border border-white/10 bg-slate-900"><img src="/nitk-campus-satellite.png" alt="Source stream preview" className="h-full w-full object-cover object-left"/><img src="/nitk-campus-satellite.png" alt="Received stream preview" className={`h-full w-full border-l border-white/80 object-cover object-right transition duration-500 ${stressed ? "blur-[1.5px] saturate-50" : ""}`}/><span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[9px] font-bold">SOURCE</span><span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[9px] font-bold">RECEIVED</span></div><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-[9px] uppercase tracking-widest text-slate-500">PSNR</p><p className="text-xl font-semibold">{metrics.psnr === null ? "—" : `${metrics.psnr} dB`}</p></div><div><p className="text-[9px] uppercase tracking-widest text-slate-500">SSIM</p><p className="text-xl font-semibold">{metrics.ssim ?? "—"}</p></div></div></section>
      </aside>
    </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <MetricCard title="Congestion" value={`${metrics.congestion}`} unit="%" subtitle="Bottleneck queue occupancy" color="#fbbf6b" seed={1} elapsed={elapsed} stress={stressed}/>
      <MetricCard title="Packet loss" value={`${metrics.loss}`} unit="%" subtitle="0.5 s bins · simulated" color="#fb7185" seed={4} elapsed={elapsed} stress={stressed} bars/>
      <MetricCard title="Available bandwidth" value={`${metrics.bandwidth}`} unit="Mb/s" subtitle="400 Mb/s nominal link · illustrative" color="#5eead4" seed={9} elapsed={elapsed} stress={stressed}/>
      <MetricCard title="Round-trip delay" value={`${metrics.rtt}`} unit="ms" subtitle={`p95 RTT · jitter ${metrics.jitter} ms`} color="#c4b5fd" seed={13} elapsed={elapsed} stress={stressed}/>
    </div>

    <section className="mt-4 rounded-xl border border-white/10 bg-[#101f21] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Continuous network simulation</p><h2 className="mt-1 text-sm font-semibold">{phase === "discovering" ? `Discovering candidate routes · ${revealedCount} / 5` : incident === "normal" ? "Video packets are streaming · waiting for a network event" : incident === "surge" ? selection.mode === "QOE_FALLBACK" ? `Queue at ${surgeNode ? site(surgeNode).name : "campus node"} · QoE fallback uses ${selection.id}` : `Queue at ${surgeNode ? site(surgeNode).name : "campus node"} · ${selection.id} avoids the busy node` : "Link down · traffic is rerouted around the failure"}</h2></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor="demo-speed">Playback speed</label><select id="demo-speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="rounded-lg border border-white/15 bg-[#0b1517] px-2 py-2 text-xs text-slate-200"><option value={1}>1× speed</option><option value={2}>2× speed</option><option value={4}>4× speed</option></select><button type="button" onClick={() => setRunning((value) => !value)} className="min-w-24 rounded-lg border border-emerald-200/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/10">{running ? "Pause" : "Resume"}</button><button type="button" onClick={reset} className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-200">Restart</button></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{ids.map((id, index) => <div key={id} className={`rounded-lg border px-3 py-2 text-xs ${index < revealedCount ? id === activeId ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300" : "border-white/5 text-slate-600"}`}><span className="font-mono font-bold">{id}</span><span className="ml-2">{index < revealedCount ? index === revealedCount - 1 && phase === "discovering" ? "probing…" : "probed" : "waiting"}</span></div>)}</div>
      <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-5 text-slate-500">The simulation runs continuously until paused. It reveals and probes five candidate paths, starts packet movement on the selected route, then repeats random traffic surges and link failures with automatic recovery. Telemetry, confidence, QoE, packet flow, video quality, and controller actions are simulated; no live Mininet or Floodlight connection is active.</p>
    </section>
  </section>;
};

export default CampusDemo;
