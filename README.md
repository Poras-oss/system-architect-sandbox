# System Architect Sandbox

A learning playground where you design software systems and get real feedback on how good they actually are.

---

## Why This Exists

Most system design learning stays in theory. Whiteboards. Blog posts. Interview prep guides. You read about caching, replicas, and load balancers, but nothing ever tells you *"your design would cost $430/month and fail 0.3% of the time."*

That gap is what this project tries to close.

You drag and drop real system components onto a canvas, connect them, and run a simulation. Not vague feedback. Concrete numbers.

**The motto: Apply system design learnings. Get judged.**

---

## What You Can Do

- Drag and drop components onto a canvas (clients, servers, databases, caches, queues, CDNs, and more)
- Connect them with sync (solid) or async (dashed) edges
- Run a simulation that produces:
  - P50 / P95 / P99 latency in milliseconds
  - Throughput ceiling (max RPS your design can handle)
  - System availability (e.g. 99.87%) and expected downtime per month
  - Monthly infrastructure cost estimate
  - Single points of failure, bottlenecks, and a redundancy score
- Get warnings about design mistakes: missing cache layers, direct client-to-DB connections, synchronous fan-out, circular dependencies
- Stress-test with chaos scenarios: Black Friday (10x traffic), DB Primary Failure, Cold Start (zero cache hits)
- Compare designs side by side: "Cost +$73/mo, P99 latency -170ms, availability +0.09%"

---

## The Mission

> Make system design a skill you can *practice*, not just *read about*.

A good architect should be able to answer:
- What breaks if my payment service goes down?
- Does this architecture handle 10k RPS or does it fall over at 2k?
- Would I even notice an outage with this observability setup?
- How many "nines" does this topology actually give me?

This tool answers those questions from a diagram.

---

## How the Simulation Works

The platform models your design as a directed graph and runs several algorithms over it. Here is a plain summary of each one.

### 1. Graph Traversal: Building the Request Flow

Everything starts with your client nodes (Web, Mobile, IoT). The engine runs a **BFS (Breadth-First Search)** from those clients, following edges to find every node a real request can reach. Nodes with no path from a client are flagged as disconnected and skipped.

### 2. Critical Path: Where Does Latency Come From?

Every component has a base latency (API Gateway = 10ms, SQL DB = 10ms, Cache = 1ms). The engine finds the **longest latency path** from client to the deepest backend, following sync edges only. That path is your critical path, and it determines your P50.

### 3. Tail Latency Formula

```
P95 = P50 x (1 + 0.4 x serialHops x (1 - redundancyScore / 100))
P99 = P50 x (1 + 0.8 x serialHops x (1 - redundancyScore / 100))
```

More serial hops plus less redundancy equals fatter tails. This reflects what actually happens in production: variance compounds across every hop.

### 4. Availability: Proper Reliability Math

Each component type has a base SLA (a single App Server = 99.5%). Running 3 instances compounds correctly:

```
effectiveSLA = 1 - (1 - baseSLA)^instanceCount
```

System availability is the **series product** of all SLAs along the critical path. Adding a replica measurably improves the number.

### 5. Throughput Ceiling: What Is Your Bottleneck?

Every component has a max RPS (a web server handles ~500 RPS, a microservice handles ~2000). The engine walks the critical path and finds the **minimum throughput node**. That node is your bottleneck and your system's hard ceiling.

### 6. Fan-Out Amplification Detection

The engine counts how many downstream services each compute node calls **synchronously**. If a service fans out to more than 3 sync dependencies, your actual downstream load is `incomingRPS x N`. This is one of the most common microservice mistakes and one of the first things a senior engineer checks.

### 7. Blast Radius Scoring

For each node, the engine runs a **reverse BFS on sync edges** to count how many upstream nodes depend on it directly or through a chain. If that node fails, every ancestor loses the ability to serve requests. This gives each node a `blastRadius` score. The top 3 highest-risk nodes are surfaced in the results.

### 8. Observability Coverage

The engine checks whether your compute nodes are reachable from at least one **tracing** node, and whether your databases are reachable from at least one **metrics** node (using undirected BFS). It outputs a coverage score from 0 to 100%. Below 80%, you get a warning. Blind spots in observability mean silent outages.

### 9. CAP Theorem Topology Flags

When you connect two SQL databases with an edge, the engine checks whether it is async or sync:
- **Async replication** flags as AP (Available, Partition-tolerant): reads may lag behind writes
- **Sync replication** flags as CP (Consistent, Partition-tolerant): write latency goes up

### 10. Cost Estimation

Every node contributes to a monthly cost estimate based on its configuration (instance count, storage, throughput). Costs are modeled after real cloud pricing (AWS/GCP approximations). The `compareCostVsPerf()` function can run two configurations back-to-back and output the delta: what you gain and what you pay for it.

### 11. Chaos Scenarios

Before running the simulation, you can select a preset that temporarily changes the graph:
- **Black Friday**: 10x traffic, fatter tail latency
- **DB Primary Failure**: removes primary SQL DB nodes, traffic routes to replicas only
- **Cold Start**: zeroes out all cache hit rates, every request hits the database

Combined with Diff Mode, you see exactly how your architecture behaves under stress compared to the happy path.

---

## Hard Validation Rules (Blocks Simulation)

| Rule | Why |
|------|-----|
| No client node | Nothing to generate traffic from |
| No reachable compute | Requests have nowhere to go |
| Client directly wired to database | No app layer means no auth, no business logic |
| Circular synchronous dependency | Infinite blocking, deadlock |
| Load balancer with only one backend | Load balancer has no purpose |
| Message queue with no consumers | Messages pile up indefinitely |

## Soft Validation Warnings

| Warning | What It Catches |
|---------|-----------------|
| High read traffic, no cache | DB takes the hit on every read |
| Single database, no replica | One node failing means full downtime |
| No rate limiter on public entry | Open to traffic floods |
| Fan-out over 3 sync downstream calls | Downstream fleet gets amplified RPS |
| Async replication to a replica | Eventual consistency risk |
| Sync replication to a replica | Write latency penalty |
| Observability coverage under 80% | Blind spots in production monitoring |
| High blast radius nodes | Risk of cascading failure |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React + TypeScript |
| Graph Canvas | ReactFlow |
| State Management | Zustand |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Build Tool | Vite |

---

## Contributing

The codebase is organized around these key files:

```
src/
  utils/
    simulationValidator.ts   <- All graph algorithms and simulation math
    costEstimator.ts          <- Cost models and compareCostVsPerf()
    validation.ts             <- Static design rule checks
  store/
    useStore.ts               <- Global state (SimulationConfig, SimulationResult)
  components/
    panels/RightPanel.tsx     <- Simulation controls, results UI, diff mode
    canvas/                   <- The drag-and-drop node canvas
  data/
    nodeTypes.ts              <- Component definitions and categories
```

### Good First Contributions

- **Add a new component type**: add it to `nodeTypes.ts`, give it a base latency in `simulationValidator.ts`, and a cost model in `costEstimator.ts`
- **Add a new soft validation rule**: extend `runSoftValidation()` in `simulationValidator.ts`
- **Add a new chaos preset**: add it to the `SimulationConfig.preset` union type and handle it in `RightPanel.tsx`'s `handleRunSimulation`
- **Improve cost accuracy**: update the pricing in `costEstimator.ts` for a specific cloud provider
- **Add a new UI section**: the right panel renders collapsible sections; follow the existing `SectionHeader` and `MetricCard` pattern

### Coding Conventions

- All simulation logic lives in `utils/`. No simulation math in React components.
- `SimulationResult` is the single output type. If you compute a new metric, add it there.
- Sync edges = blocking calls. Async edges (dashed) = fire-and-forget. This distinction is central to every algorithm.
- Use seeded randomness only (`seededRandom(hashGraph(nodes, edges))`). Never use `Math.random()` in simulation output.

---

## Algorithm Complexity

| Algorithm | Time | Space |
|-----------|------|-------|
| BFS reachability | O(n + e) | O(n) |
| All-paths enumeration | O(paths x depth) | O(n) |
| Critical path | O(paths x n) | O(n) |
| Cycle detection (DFS) | O(n + e) | O(n) |
| Blast radius (reverse BFS) | O(n x (n + e)) | O(n) |
| Cost estimation | O(n) | O(n) |

where `n` = number of nodes, `e` = number of edges.

---

## License

MIT. Build on it, fork it, use it for teaching, use it to practice for your next system design interview.