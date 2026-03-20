import { Node, Edge } from "reactflow";
import { getDefinition, CategoryId } from "../data/nodeTypes";
import { SimulationConfig, SimulationResult } from "../store/useStore";

// --- Types ---

export interface SimValidationIssue {
  severity: "error" | "warning";
  message: string;
  nodeIds: string[];
}

export interface ValidatedSimResult {
  errors: SimValidationIssue[];
  warnings: SimValidationIssue[];
  result: SimulationResult | null;
  criticalPath: string[];
  unreachableCount: number;
}

// --- Helpers ---

function getCategory(node: Node): CategoryId | null {
  const def = getDefinition(node.data?.componentId);
  return def ? def.category as CategoryId : null;
}

function isClient(node: Node) {
  return ["web-client", "mobile-client", "iot-device"].includes(node.data?.componentId);
}

function isCompute(node: Node) {
  return getCategory(node) === "compute";
}

function isData(node: Node) {
  return getCategory(node) === "data";
}

function buildAdj(edges: Edge[]) {
  const adj = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });
  return adj;
}

function buildEdgeMap(edges: Edge[]) {
  const map = new Map<string, Edge>();
  edges.forEach(e => {
    map.set(`${e.source}->${e.target}`, e);
  });
  return map;
}

function bfsReachable(startIds: string[], adj: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [...startIds];
  startIds.forEach(id => visited.add(id));
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of (adj.get(current) || [])) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

// --- Hard validation (blocks simulation) ---

function runHardValidation(nodes: Node[], edges: Edge[], adj: Map<string, string[]>, reachable: Set<string>): SimValidationIssue[] {
  const errors: SimValidationIssue[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edgeMap = buildEdgeMap(edges);

  // RULE 1: No client node
  const clients = nodes.filter(isClient);
  if (clients.length === 0) {
    errors.push({
      severity: "error",
      message: "Add at least one client node (Web, Mobile, or IoT) to start a request flow.",
      nodeIds: [],
    });
    return errors; // Can't check further without clients
  }

  // RULE 2: No compute node reachable
  const reachableNodes = [...reachable].map(id => nodeMap.get(id)).filter(Boolean) as Node[];
  if (!reachableNodes.some(isCompute)) {
    errors.push({
      severity: "error",
      message: "Requests have no compute destination. Connect your client to a server or function.",
      nodeIds: clients.map(n => n.id),
    });
  }

  // RULE 3: Client directly wired to database
  for (const client of clients) {
    for (const targetId of (adj.get(client.id) || [])) {
      const target = nodeMap.get(targetId);
      if (target && isData(target)) {
        errors.push({
          severity: "error",
          message: `Client → Database direct connection is not valid. Route through an App Server, API Gateway, or Microservice.`,
          nodeIds: [client.id, targetId],
        });
      }
    }
  }

  // RULE 4: Circular sync dependency (DFS on sync-only edges)
  const syncAdj = new Map<string, string[]>();
  edges.forEach(e => {
    if (e.data?.edgeType !== "async") {
      if (!syncAdj.has(e.source)) syncAdj.set(e.source, []);
      syncAdj.get(e.source)!.push(e.target);
    }
  });

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleMembers: string[] = [];

  function dfs(nid: string) {
    visited.add(nid);
    inStack.add(nid);
    for (const next of (syncAdj.get(nid) || [])) {
      if (inStack.has(next)) {
        cycleMembers.push(nid, next);
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    inStack.delete(nid);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  if (cycleMembers.length > 0) {
    const unique = [...new Set(cycleMembers)];
    const names = unique.map(id => nodeMap.get(id)?.data?.label || id).join(", ");
    errors.push({
      severity: "error",
      message: `Circular synchronous dependency detected between: ${names}. This would cause infinite blocking. Use async edges or remove the cycle.`,
      nodeIds: unique,
    });
  }

  // RULE 5: Load balancer with only one backend
  for (const node of nodes) {
    if (node.data?.componentId === "load-balancer") {
      const outgoing = (adj.get(node.id) || []);
      if (outgoing.length === 1) {
        errors.push({
          severity: "error",
          message: `Load Balancer "${node.data?.label}" has only one backend. It has no effect with a single target. Add more server nodes or remove the load balancer.`,
          nodeIds: [node.id, outgoing[0]],
        });
      }
    }
  }

  // RULE 6: Message queue with no consumer
  for (const node of nodes) {
    if (node.data?.componentId === "message-queue") {
      const outgoing = (adj.get(node.id) || []);
      if (outgoing.length === 0) {
        errors.push({
          severity: "error",
          message: `Message Queue "${node.data?.label}" has no consumers. Messages would pile up indefinitely. Connect a Worker or Microservice to consume from it.`,
          nodeIds: [node.id],
        });
      }
    }
  }

  // RULE 7: Database with no app layer writing to it (warning-level but in hard pass)
  // Actually this is non-blocking, we'll handle it in soft validation

  return errors;
}

// --- Soft validation (warnings, sim still runs) ---

function runSoftValidation(nodes: Node[], edges: Edge[], adj: Map<string, string[]>, reachable: Set<string>, config: SimulationConfig): SimValidationIssue[] {
  const warnings: SimValidationIssue[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const reverseAdj = new Map<string, string[]>();
  edges.forEach(e => {
    if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, []);
    reverseAdj.get(e.target)!.push(e.source);
  });

  // RULE 7 (from hard section): DB with no writers
  for (const node of nodes) {
    if (["sql-db", "nosql-db"].includes(node.data?.componentId)) {
      const incomers = (reverseAdj.get(node.id) || []).map(id => nodeMap.get(id)).filter(Boolean) as Node[];
      if (!incomers.some(isCompute)) {
        warnings.push({
          severity: "warning",
          message: `Database "${node.data?.label}" has no writers connected. Is this intentional (read replica scenario)?`,
          nodeIds: [node.id],
        });
      }
    }
  }

  // WARN 1: Missing cache on read-heavy path
  if (config.readWriteMix.read > 60) {
    const hasCacheReachable = [...reachable].some(id => nodeMap.get(id)?.data?.componentId === "cache");
    if (!hasCacheReachable && nodes.some(n => ["sql-db", "nosql-db"].includes(n.data?.componentId))) {
      warnings.push({
        severity: "warning",
        message: "High read traffic with no cache layer. Your database will receive full read load. Consider adding Redis/Memcached before the DB.",
        nodeIds: nodes.filter(n => ["sql-db", "nosql-db"].includes(n.data?.componentId)).map(n => n.id),
      });
    }
  }

  // WARN 2: Single database, no replica
  const dbs = nodes.filter(n => ["sql-db", "nosql-db"].includes(n.data?.componentId));
  if (dbs.length === 1) {
    const db = dbs[0];
    const dbTargets = (adj.get(db.id) || []).map(id => nodeMap.get(id)).filter(Boolean) as Node[];
    const dbSources = (reverseAdj.get(db.id) || []).map(id => nodeMap.get(id)).filter(Boolean) as Node[];
    const hasConnectedDB = [...dbTargets, ...dbSources].some(n => ["sql-db", "nosql-db"].includes(n.data?.componentId));
    if (!hasConnectedDB) {
      warnings.push({
        severity: "warning",
        message: "Single database with no replica. Any DB failure causes full downtime. Add a replica node and connect it with an async edge.",
        nodeIds: [db.id],
      });
    }
  }

  // WARN 3: No rate limiter on public entry point
  const clients = nodes.filter(isClient);
  for (const client of clients) {
    const firstHops = (adj.get(client.id) || []);
    for (const hopId of firstHops) {
      const hop = nodeMap.get(hopId);
      if (hop && ["load-balancer", "api-gateway"].includes(hop.data?.componentId)) {
        // Check if rate limiter is between client and this hop
        const rateLimiterInPath = firstHops.some(id => nodeMap.get(id)?.data?.componentId === "rate-limiter");
        if (!rateLimiterInPath) {
          // Also check if rate-limiter feeds into the LB/GW
          const lbSources = (reverseAdj.get(hopId) || []).map(id => nodeMap.get(id)).filter(Boolean) as Node[];
          const hasRL = lbSources.some(n => n.data?.componentId === "rate-limiter");
          if (!hasRL) {
            warnings.push({
              severity: "warning",
              message: "No rate limiter detected on the public entry path. Your system is vulnerable to traffic floods and abuse.",
              nodeIds: [client.id, hopId],
            });
            break; // One warning is enough
          }
        }
      }
    }
  }

  // WARN 4: Thundering herd risk (cache with no DB fallback)
  const caches = nodes.filter(n => n.data?.componentId === "cache");
  for (const cache of caches) {
    const cacheTargets = (adj.get(cache.id) || []).map(id => nodeMap.get(id)).filter(Boolean) as Node[];
    const hasDBFallback = cacheTargets.some(n => ["sql-db", "nosql-db"].includes(n.data?.componentId));
    if (!hasDBFallback) {
      warnings.push({
        severity: "warning",
        message: `Cache has no DB fallback edge. On a cold start or cache flush, all requests will hit the DB simultaneously (thundering herd).`,
        nodeIds: [cache.id],
      });
    }
  }

  // WARN 5: Cascading failure risk (single compute path)
  for (const client of clients) {
    const paths = allPaths(client.id, adj, nodeMap, 10);
    const computeOnPaths = paths.map(p => p.filter(id => {
      const n = nodeMap.get(id);
      return n && isCompute(n);
    }));
    // If all paths go through the same single compute node
    if (computeOnPaths.length > 0) {
      const firstPathCompute = computeOnPaths[0];
      for (const cid of firstPathCompute) {
        const node = nodeMap.get(cid);
        if (node && (node.data?.properties?.instances || 1) <= 1) {
          const allPathsUseThis = computeOnPaths.every(p => p.includes(cid));
          if (allPathsUseThis) {
            warnings.push({
              severity: "warning",
              message: `Single point of compute — if "${node.data?.label}" fails, all requests fail. Consider adding a redundant instance or circuit breaker.`,
              nodeIds: [cid],
            });
            break;
          }
        }
      }
    }
  }

  // WARN 6: Sync call to message queue
  edges.forEach(e => {
    if (e.data?.edgeType !== "async") {
      const target = nodeMap.get(e.target);
      const source = nodeMap.get(e.source);
      if (target?.data?.componentId === "message-queue" && source && isCompute(source)) {
        warnings.push({
          severity: "warning",
          message: `Synchronous call to Message Queue "${target.data?.label}" defeats the purpose of async decoupling. Change this edge to async (dashed).`,
          nodeIds: [e.source, e.target],
        });
      }
    }
  });

  // WARN 7: CDN with no origin
  for (const node of nodes) {
    if (node.data?.componentId === "cdn") {
      const targets = (adj.get(node.id) || []).map(id => nodeMap.get(id)).filter(Boolean) as Node[];
      const hasOrigin = targets.some(n => isCompute(n) || n.data?.componentId === "object-storage");
      if (!hasOrigin) {
        warnings.push({
          severity: "warning",
          message: `CDN "${node.data?.label}" has no origin connected. It has nothing to cache or proxy to.`,
          nodeIds: [node.id],
        });
      }
    }
  }

  // WARN 8: Deep sync chain with no circuit breaker
  const syncAdj = new Map<string, string[]>();
  edges.forEach(e => {
    if (e.data?.edgeType !== "async") {
      if (!syncAdj.has(e.source)) syncAdj.set(e.source, []);
      syncAdj.get(e.source)!.push(e.target);
    }
  });

  for (const client of clients) {
    const syncPaths = allPaths(client.id, syncAdj, nodeMap, 15);
    for (const path of syncPaths) {
      const computeHops = path.filter(id => {
        const n = nodeMap.get(id);
        return n && isCompute(n);
      });
      if (computeHops.length >= 4) {
        const hasCB = path.some(id => nodeMap.get(id)?.data?.componentId === "circuit-breaker");
        if (!hasCB) {
          warnings.push({
            severity: "warning",
            message: "Deep synchronous call chain detected (4+ hops) with no circuit breaker. A failure deep in the chain will cascade upstream and cause timeouts across all callers.",
            nodeIds: computeHops.slice(0, 4),
          });
          break;
        }
      }
    }
  }

  return warnings;
}

// Simple BFS-based path finder (limited depth)
function allPaths(start: string, adj: Map<string, string[]>, nodeMap: Map<string, Node>, maxDepth: number): string[][] {
  const results: string[][] = [];
  const queue: { path: string[] }[] = [{ path: [start] }];

  while (queue.length > 0 && results.length < 50) {
    const { path } = queue.shift()!;
    if (path.length > maxDepth) continue;
    const current = path[path.length - 1];
    const neighbors = adj.get(current) || [];
    if (neighbors.length === 0) {
      results.push(path);
    } else {
      for (const next of neighbors) {
        if (!path.includes(next)) {
          queue.push({ path: [...path, next] });
        }
      }
    }
  }

  return results.length > 0 ? results : [[start]];
}

// --- Simulation math ---

const simBaseLatency: Record<string, number> = {
  "cdn": 5, "load-balancer": 2, "api-gateway": 10, "dns": 5,
  "reverse-proxy": 2, "firewall": 1,
  "web-server": 20, "app-server": 20, "microservice": 15,
  "serverless": 50, "worker": 20,
  "cache": 1, "sql-db": 10, "nosql-db": 5,
  "message-queue": 3, "object-storage": 15,
  "search-engine": 20, "data-warehouse": 500,
  "stream-processor": 5,
  "rate-limiter": 1, "circuit-breaker": 1, "service-discovery": 2,
  "config-service": 2, "secret-manager": 3,
  "log-aggregator": 0, "metrics": 0, "tracing": 1, "alerting": 0,
  "web-client": 0, "mobile-client": 0, "iot-device": 0,
  "sticky-note": 0,
};

const simBaseSLA: Record<string, number> = {
  "cdn": 99.99, "load-balancer": 99.99, "api-gateway": 99.95,
  "cache": 99.9, "message-queue": 99.9, "serverless": 99.95,
  "sql-db": 99.9, "nosql-db": 99.99,
  "web-server": 99.5, "app-server": 99.5, "microservice": 99.5,
  "search-engine": 99.9, "data-warehouse": 99.9, "stream-processor": 99.9,
  "object-storage": 99.99, "worker": 99.5,
};

function getNodeMaxRPS(node: Node): number {
  const d = node.data?.properties || {};
  const cid = node.data?.componentId;
  switch (cid) {
    case "web-server":
    case "app-server":
      return (d.maxRPS || 500) * (d.instances || 1);
    case "microservice":
      return (d.maxRPS || 2000) * (d.instances || 1);
    case "serverless":
      return d.concurrencyLimit || 1000;
    case "load-balancer":
      return 100000;
    case "api-gateway":
      return d.rateLimit || 10000;
    case "cache":
      return 100000 * (d.nodes || 1);
    case "sql-db":
      return 5000 * (1 + (d.readReplicas || 0));
    case "nosql-db":
      return (d.rcu || 100) * 50 + (d.wcu || 50) * 50;
    case "message-queue":
      return d.maxThroughput || 10000;
    case "rate-limiter":
      return d.maxRPS || 10000;
    default:
      return 999999;
  }
}

function getNodeSLA(node: Node): number {
  const cid = node.data?.componentId;
  const d = node.data?.properties || {};
  let base = simBaseSLA[cid] || 99.9;

  // Adjust for redundancy
  if (["web-server", "app-server", "microservice"].includes(cid)) {
    base = (d.instances || 1) >= 2 ? 99.95 : 99.5;
  }
  if (cid === "sql-db" && (d.readReplicas || 0) > 0) {
    base = 99.99;
  }

  return base;
}

function findCriticalPath(clientIds: string[], adj: Map<string, string[]>, nodeMap: Map<string, Node>, edges: Edge[]): string[] {
  // Sync-only adjacency for critical path
  const syncAdj = new Map<string, string[]>();
  edges.forEach(e => {
    if (e.data?.edgeType !== "async") {
      if (!syncAdj.has(e.source)) syncAdj.set(e.source, []);
      syncAdj.get(e.source)!.push(e.target);
    }
  });

  let longestPath: string[] = [];
  let maxLatency = 0;

  for (const clientId of clientIds) {
    const paths = allPaths(clientId, syncAdj, nodeMap, 20);
    for (const path of paths) {
      let lat = 0;
      for (const nid of path) {
        const node = nodeMap.get(nid);
        if (!node) continue;
        lat += simBaseLatency[node.data?.componentId] || 5;
      }
      if (lat > maxLatency) {
        maxLatency = lat;
        longestPath = path;
      }
    }
  }

  return longestPath;
}

function downtimeString(avail: number): string {
  const downMinutesPerMonth = (1 - avail / 100) * 30 * 24 * 60;
  if (downMinutesPerMonth < 1) return `~${Math.round(downMinutesPerMonth * 60)}s downtime/month`;
  if (downMinutesPerMonth < 60) return `~${Math.round(downMinutesPerMonth)} minutes downtime/month`;
  return `~${Math.round(downMinutesPerMonth / 60)} hours downtime/month`;
}

function computeSimulation(
  nodes: Node[], edges: Edge[], config: SimulationConfig,
  reachableIds: Set<string>, criticalPath: string[]
): SimulationResult {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const reachableNodes = nodes.filter(n => reachableIds.has(n.id));

  // P50 = sum of base latencies on critical path
  let p50 = 0;
  for (const nid of criticalPath) {
    const node = nodeMap.get(nid);
    if (!node) continue;
    const cid = node.data?.componentId;

    // Serverless: warm vs cold
    if (cid === "serverless") {
      p50 += 8; // warm start for P50
    } else if (cid === "cache") {
      // Cache hit path for P50
      const hitRate = (node.data?.properties?.hitRateTarget || 95) / 100;
      p50 += 1; // cache lookup
      // Add weighted DB latency for misses (simplified)
      p50 += (1 - hitRate) * 10;
    } else {
      p50 += simBaseLatency[cid] || 5;
    }
  }
  p50 = Math.round(p50);

  const p95 = Math.round(p50 * 1.8);
  let p99 = Math.round(p50 * 3.2);
  if (config.spikeEnabled) p99 = Math.round(p99 * 2.5);

  // Throughput ceiling = min capacity on critical path
  let bottleneckId: string | null = null;
  let minTP = Infinity;
  for (const nid of criticalPath) {
    const node = nodeMap.get(nid);
    if (!node) continue;
    const tp = getNodeMaxRPS(node);
    if (tp < minTP) {
      minTP = tp;
      bottleneckId = nid;
    }
  }
  const capacityCeiling = minTP === Infinity ? 0 : minTP;
  const effectiveRPS = Math.min(config.rps, capacityCeiling);

  // Cache hit rate
  const cacheNodes = reachableNodes.filter(n => n.data?.componentId === "cache");
  const cacheHitRate = cacheNodes.length > 0
    ? Math.round(cacheNodes.reduce((s, n) => s + (n.data?.properties?.hitRateTarget || 95), 0) / cacheNodes.length)
    : 0;

  // Queue depth
  const spikeRPS = config.spikeEnabled ? config.rps * 10 : config.rps;
  const spikeThroughput = Math.min(spikeRPS, capacityCeiling);
  const queueNodes = reachableNodes.filter(n => n.data?.componentId === "message-queue");
  const queueDepthPeak = queueNodes.length > 0
    ? Math.round(Math.max(0, (spikeRPS - spikeThroughput) * 2))
    : 0;

  // Availability (series composition along critical path)
  let availability = 1;
  for (const nid of criticalPath) {
    const node = nodeMap.get(nid);
    if (!node) continue;
    const sla = getNodeSLA(node) / 100;
    availability *= sla;
  }
  availability = Math.round(availability * 10000) / 100;

  // SPOFs
  const spofs: string[] = [];
  for (const node of reachableNodes) {
    const d = node.data?.properties || {};
    const cid = node.data?.componentId;
    if (["sql-db", "nosql-db"].includes(cid) && (d.readReplicas || 0) === 0 && d.dbType !== "replica") {
      spofs.push(node.data?.label || cid);
    }
    if (["web-server", "app-server", "microservice"].includes(cid) && (d.instances || 1) <= 1) {
      spofs.push(node.data?.label || cid);
    }
  }

  // Redundancy score
  const totalComponents = reachableNodes.filter(n => n.data?.componentId !== "sticky-note").length;
  const redundantCount = reachableNodes.filter(n => {
    const d = n.data?.properties || {};
    return (d.instances || 1) > 1 || (d.readReplicas || 0) > 0 || (d.nodes || 1) > 1;
  }).length;
  const redundancyScore = totalComponents > 0 ? Math.round((redundantCount / totalComponents) * 100) : 0;

  const autoScalingHeadroom = effectiveRPS > 0
    ? Math.max(0, Math.round(((capacityCeiling - effectiveRPS) / effectiveRPS) * 100))
    : 0;

  // Recommendations
  const adj = buildAdj(edges);
  const recommendations: string[] = [];
  if (cacheNodes.length === 0 && config.readWriteMix.read > 50) {
    recommendations.push("Add a caching layer (Redis) to reduce database load for read-heavy traffic.");
  }
  if (spofs.length > 0) {
    recommendations.push(`Eliminate single points of failure: ${spofs.slice(0, 2).join(", ")}.`);
  }
  if (bottleneckId) {
    const bn = nodeMap.get(bottleneckId);
    if (bn) recommendations.push(`Bottleneck detected at "${bn.data?.label}". Scale horizontally or increase capacity.`);
  }
  if (!reachableNodes.some(n => n.data?.componentId === "load-balancer")) {
    const serverCount = reachableNodes.filter(n => ["web-server", "app-server", "microservice"].includes(n.data?.componentId)).length;
    if (serverCount > 1) recommendations.push("Add a load balancer to distribute traffic across your servers.");
  }
  if (queueNodes.length === 0 && config.rps > 5000) {
    recommendations.push("Consider adding a message queue to buffer traffic spikes and decouple services.");
  }
  if (config.multiRegion && !reachableNodes.some(n => n.data?.componentId === "cdn")) {
    recommendations.push("Add a CDN for multi-region deployments to reduce latency for global users.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Architecture looks well-balanced for the current load profile.");
  }

  // Timeline data
  const duration = Math.min(config.totalRequests / config.rps, 60);
  const steps = 20;
  const timelineData = Array.from({ length: steps }, (_, i) => {
    const t = (i / (steps - 1)) * duration;
    const isMidpoint = config.spikeEnabled && i >= steps / 2 - 2 && i <= steps / 2 + 2;
    const currentRPS = isMidpoint ? Math.min(spikeRPS, capacityCeiling * 1.2) : effectiveRPS;
    const currentLatency = isMidpoint ? p95 * 1.5 : p50 * (0.8 + Math.random() * 0.4);
    const errorRate = currentRPS > capacityCeiling ? Math.min(((currentRPS - capacityCeiling) / currentRPS) * 100, 50) : Math.random() * 0.5;
    return {
      time: Math.round(t * 10) / 10,
      rps: Math.round(currentRPS),
      latency: Math.round(currentLatency),
      errorRate: Math.round(errorRate * 100) / 100,
    };
  });

  return {
    p50, p95, p99,
    throughputAchieved: effectiveRPS,
    cacheHitRate,
    queueDepthPeak,
    bottleneckNodeId: bottleneckId,
    availability,
    availabilityDowntime: downtimeString(availability),
    spofs,
    redundancyScore,
    capacityCeiling,
    autoScalingHeadroom,
    recommendations,
    timelineData,
  };
}

// --- Main entry ---

export function runValidatedSimulation(
  nodes: Node[], edges: Edge[], config: SimulationConfig
): ValidatedSimResult {
  if (nodes.length === 0) {
    return {
      errors: [{ severity: "error", message: "Add components to the canvas to run a simulation.", nodeIds: [] }],
      warnings: [],
      result: null,
      criticalPath: [],
      unreachableCount: 0,
    };
  }

  const adj = buildAdj(edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const clients = nodes.filter(isClient);
  const clientIds = clients.map(n => n.id);

  // BFS reachability from clients
  const reachable = clientIds.length > 0 ? bfsReachable(clientIds, adj) : new Set<string>();
  const nonStickyNodes = nodes.filter(n => n.data?.componentId !== "sticky-note");
  const unreachableCount = nonStickyNodes.filter(n => !reachable.has(n.id) && !isClient(n)).length;

  // Hard validation
  const errors = runHardValidation(nodes, edges, adj, reachable);
  if (errors.length > 0) {
    return { errors, warnings: [], result: null, criticalPath: [], unreachableCount };
  }

  // Soft validation
  const warnings = runSoftValidation(nodes, edges, adj, reachable, config);

  // Find critical path
  const criticalPath = findCriticalPath(clientIds, adj, nodeMap, edges);

  // Compute simulation
  const result = computeSimulation(nodes, edges, config, reachable, criticalPath);

  return { errors: [], warnings, result, criticalPath, unreachableCount };
}