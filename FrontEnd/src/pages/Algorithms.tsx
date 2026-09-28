type Algorithm = {
  number: string;
  name: string;
  role: string;
  abstract: string;
  explanation: string;
  usage: string;
  location: string;
  steps: string[];
};

const algorithms: Algorithm[] = [
  {
    number: "01",
    name: "Top-5 Shortest Path Enumeration",
    role: "Candidate route generation",
    abstract: "This algorithm finds several loop-free routes instead of considering only one shortest route. The alternatives are later evaluated using traffic and quality metrics.",
    explanation:
      "The system generates up to five simple paths between the source and destination and sorts them by hop count. This gives the routing engine multiple alternatives instead of forcing it to use only one shortest route.",
    usage:
      "For the current topology, the source is node 0 and the destination is node 9. The algorithm returns five unique candidate paths for comparison.",
    location: "backend/routing/topology.py -> shortest_paths()",
    steps: [
      "Start at the source node.",
      "Visit each connected neighbor that is not already in the current path.",
      "Save the path when the destination is reached.",
      "Sort all saved paths by hop count and return the first five.",
    ],
  },
  {
    number: "02",
    name: "Logistic Regression",
    role: "Traffic classification",
    abstract: "Logistic Regression estimates the probability that a candidate path belongs to the low-traffic or high-traffic class. Its probability output becomes the confidence used by the routing policy.",
    explanation:
      "The paper uses machine-learning models to classify network traffic as low or high. Logistic Regression is our selected initial model because it is simple, interpretable, and produces a confidence probability for every prediction.",
    usage:
      "For each candidate path, the future ML pipeline will use network features such as latency, throughput, packet loss, jitter, and utilization to predict whether the path is congested.",
    location: "Project design: SRS.md FR-06 to FR-09; future ML service",
    steps: [
      "Collect measured features for a candidate path.",
      "Apply the same preprocessing used during model training.",
      "Calculate the probability of low or high traffic.",
      "Return the predicted class and confidence to the routing engine.",
    ],
  },
  {
    number: "03",
    name: "QoE-Based Weighted Routing",
    role: "Quality-aware path selection",
    abstract: "QoE-based routing chooses the path most likely to provide a good multimedia experience by combining several network-quality measurements into one score.",
    explanation:
      "QoE means Quality of Experience. The path score combines throughput, latency, packet loss, jitter, and utilization after normalizing their values. High throughput improves the score, while high delay, loss, jitter, and utilization reduce it.",
    usage:
      "Our current weights are throughput 35%, latency 25%, packet loss 15%, jitter 10%, and utilization 15%. The path with the highest score becomes the fallback route.",
    location: "backend/routing/decision.py -> _with_qoe_scores()",
    steps: [
      "Read the telemetry values for every candidate path.",
      "Normalize each metric so different units can be compared.",
      "Apply the configured weight to each metric.",
      "Add the weighted values and select the highest QoE score.",
    ],
  },
  {
    number: "04",
    name: "Confidence-Aware Hybrid Routing",
    role: "Final ML or QoE decision",
    abstract: "This hybrid algorithm combines machine-learning prediction with QoE scoring. It uses ML when the model is sufficiently confident and uses measured network quality when the prediction is uncertain.",
    explanation:
      "This is the central AIRSDN decision algorithm. It trusts the ML-selected route only when the prediction confidence reaches the configured threshold. When confidence is low, it safely falls back to QoE scoring.",
    usage:
      "Our threshold is 90%. Confidence of at least 90% produces ML_ROUTING; confidence below 90% produces QOE_FALLBACK. This is demonstrated by the low-traffic and high-traffic scenarios.",
    location: "backend/routing/decision.py -> choose_route()",
    steps: [
      "Receive candidate paths and their predictions.",
      "Compare each eligible ML confidence with the 90% threshold.",
      "Use the highest-confidence eligible candidate for ML routing.",
      "If no candidate qualifies, use the highest QoE score as fallback.",
    ],
  },
];

const Algorithms = () => (
  <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 text-left md:px-8">
    <header className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
        AIRSDN algorithm design
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
        Algorithms used for intelligent routing
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        These four algorithms form our routing pipeline. Together they generate candidate paths, classify traffic, measure multimedia quality, and select the safest route.
      </p>
    </header>

    <div className="grid gap-5 lg:grid-cols-2">
      {algorithms.map((algorithm) => (
        <article
          key={algorithm.number}
          className="rounded-xl border border-zinc-400/30 bg-white/60 p-6 shadow-sm dark:bg-zinc-900/60"
        >
          <div className="flex items-start gap-4">
            <span className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-300">
              {algorithm.number}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {algorithm.role}
              </p>
              <h2 className="mt-1 text-xl font-bold">{algorithm.name}</h2>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
            <span className="font-semibold">Abstract: </span>{algorithm.abstract}
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
            {algorithm.explanation}
          </p>
          <div className="mt-4 rounded-lg bg-blue-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              How our group uses it
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
              {algorithm.usage}
            </p>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Step-by-step process
            </p>
            <ol className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
              {algorithm.steps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-4 border-t border-zinc-400/20 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Project location
            </p>
            <p className="mt-1 break-words font-mono text-xs text-zinc-700 dark:text-zinc-200">
              {algorithm.location}
            </p>
          </div>
        </article>
      ))}
    </div>

    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
      <h2 className="text-lg font-bold">Complete AIRSDN flow</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
        Top-5 shortest paths → Logistic Regression traffic prediction → confidence check → QoE weighted scoring when required → final route selection and flow installation.
      </p>
    </div>
  </section>
);

export default Algorithms;
