import { Node, Edge } from "reactflow";
import { SimulationConfig, SimulationResult } from "../store/useStore";
import { getDefinition, CategoryId } from "../data/nodeTypes";

// Base latencies per component type (ms)
const baseLatency: Record<string, number> = {
  "web-client": 0, "mobile-client": 0, "iot-device": 0,
  "load-balancer": 2, "api-gateway": 5, "cdn": 1, "dns": 5,
  "reverse-proxy": 2, "firewall": 1,
  "web-server": 10, "app-server": 15, "microservice": 8,
  "serverless": 50, "worker": 20,
  "sql-db": 5, "nosql-db": 3, "cache": 1, "message-queue": 2,
  "object-storage": 15, "search-engine": 10, "data-warehouse": 200,
  "stream-processor": 5,
  "rate-limiter": 1, "circuit-breaker": 1, "service-discovery": 2,
  "config-service": 2, "secret-manager": 3,
  "log-aggregator": 0, "metrics": 0, "tracing": 1, "alerting": 0,
  "sticky-note": 0,
};

// Base SLA per component
const baseSLA: Record<string, number> = {
  "load-balancer": 99.99, "api-gateway": 99.95, "cdn": 99.9,
  "web-server": 99.9, "app-server": 99.9, "microservice": 99.9,
  "serverless": 99.95, "worker": 99.5,
  "sql-db": 99.95, "nosql-db": 99.99, "cache": 99.99,
  "message-queue": 99.95, "object-storage": 99.99,
  "search-engine": 99.9, "data-warehouse": 99.9, "stream-processor": 99.9,
};

function getNodeThroughput(node: Node): number {
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

function bfsFromClients(nodes: Node[], edges: Edge[]): string[][] {
  const clientNodes = nodes.filter(n => {
    const cat = getDefinition(n.data?.componentId)?.category;
    return cat === "client";
  });

  const adj = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });

  const paths: string[][] = [];

  for (const client of clientNodes) {
    const queue: string[][] = [[client.id]];
    const visited = new Set<string>([client.id]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      const neighbors = adj.get(current) || [];

      if (neighbors.length === 0) {
        paths.push(path);
      } else {
        for (const next of neighbors) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push([...path, next]);
          }
        }
      }
    }
  }

  return paths.length > 0 ? paths : [nodes.map(n => n.id)];
}

export function runSimulation(
  nodes: Node[],
  edges: Edge[],
  config: SimulationConfig
): SimulationResult {
  if (nodes.length === 0) {
    return {
      p50: 0, p95: 0, p99: 0, throughputAchieved: 0,
      cacheHitRate: 0, queueDepthPeak: 0, bottleneckNodeId: null,
      availability: 0, spofs: [], redundancyScore: 0,
      capacityCeiling: 0, autoScalingHeadroom: 0,
      recommendations: ["Add components to the canvas to run a simulation."],
      timelineData: [],
    };
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const paths = bfsFromClients(nodes, edges);

  // Find critical path (longest latency)
  let criticalPath: string[] = [];
  let maxPathLatency = 0;

  for (const path of paths) {
    let lat = 0;
    for (const nid of path) {
      const node = nodeMap.get(nid);
      if (!node) continue;
      const cid = node.data?.componentId || "";
      lat += baseLatency[cid] || 5;
    }
    if (lat > maxPathLatency) {
      maxPathLatency = lat;
      criticalPath = path;
    }
  }

  // Find bottleneck
  let bottleneckId: string | null = null;
  let minThroughput = Infinity;

  for (const path of paths) {
    for (const nid of path) {
      const node = nodeMap.get(nid);
      if (!node) continue;
      const tp = getNodeThroughput(node);
      if (tp < minThroughput) {
        minThroughput = tp;
        bottleneckId = nid;
      }
    }
  }

  const effectiveRPS = Math.min(config.rps, minThroughput);
  const spikeRPS = config.spikeEnabled ? config.rps * 10 : config.rps;
  const spikeThroughput = Math.min(spikeRPS, minThroughput);

  // Cache hit rate
  const cacheNodes = nodes.filter(n => n.data?.componentId === "cache");
  const cacheHitRate = cacheNodes.length > 0
    ? cacheNodes.reduce((sum, n) => sum + (n.data?.properties?.hitRateTarget || 95), 0) / cacheNodes.length
    : 0;

  // Queue depth
  const queueNodes = nodes.filter(n => n.data?.componentId === "message-queue");
  const queueDepthPeak = queueNodes.length > 0
    ? Math.max(0, (spikeRPS - spikeThroughput) * 2)
    : 0;

  // Latency calculations
  const readFactor = config.readWriteMix.read / 100;
  const cacheBenefit = cacheHitRate > 0 ? readFactor * (cacheHitRate / 100) * 0.7 : 0;
  const p50 = Math.round(maxPathLatency * (1 - cacheBenefit) * (1 + (effectiveRPS / minThroughput) * 0.3));
  const p95 = Math.round(p50 * 2.5);
  const p99 = Math.round(p50 * 5);

  // Availability (series composition)
  let availability = 100;
  const inPath = new Set(criticalPath);
  for (const nid of inPath) {
    const node = nodeMap.get(nid);
    if (!node) continue;
    const cid = node.data?.componentId || "";
    const sla = baseSLA[cid] || 99.9;
    const instances = node.data?.properties?.instances || 1;
    const replicas = node.data?.properties?.readReplicas || 0;
    const effectiveSLA = 1 - Math.pow(1 - sla / 100, Math.max(instances, 1 + replicas));
    availability *= effectiveSLA;
  }
  availability = Math.round(availability * 10000) / 100;

  // SPOFs
  const spofs: string[] = [];
  for (const node of nodes) {
    const d = node.data?.properties || {};
    const cid = node.data?.componentId;
    const instances = d.instances || 1;
    const replicas = d.readReplicas || 0;
    if (["sql-db", "nosql-db"].includes(cid) && replicas === 0 && d.dbType !== "replica") {
      spofs.push(node.data?.label || cid);
    }
    if (["web-server", "app-server", "microservice"].includes(cid) && instances <= 1) {
      spofs.push(node.data?.label || cid);
    }
  }

  // Redundancy score
  const totalComponents = nodes.filter(n => !["sticky-note"].includes(n.data?.componentId)).length;
  const redundantCount = nodes.filter(n => {
    const d = n.data?.properties || {};
    return (d.instances || 1) > 1 || (d.readReplicas || 0) > 0 || (d.nodes || 1) > 1;
  }).length;
  const redundancyScore = totalComponents > 0 ? Math.round((redundantCount / totalComponents) * 100) : 0;

  // Capacity ceiling
  const capacityCeiling = minThroughput;
  const autoScalingHeadroom = effectiveRPS > 0
    ? Math.round(((capacityCeiling - effectiveRPS) / effectiveRPS) * 100)
    : 0;

  // Recommendations
  const recommendations: string[] = [];
  if (cacheNodes.length === 0 && config.readWriteMix.read > 50) {
    recommendations.push("Add a caching layer (Redis) to reduce database load for read-heavy traffic.");
  }
  if (spofs.length > 0) {
    recommendations.push(`Eliminate single points of failure: ${spofs.slice(0, 2).join(", ")}.`);
  }
  if (bottleneckId) {
    const bn = nodeMap.get(bottleneckId);
    if (bn) {
      recommendations.push(`Bottleneck detected at "${bn.data?.label}". Scale horizontally or increase capacity.`);
    }
  }
  if (!nodes.some(n => n.data?.componentId === "load-balancer")) {
    const serverCount = nodes.filter(n => ["web-server", "app-server", "microservice"].includes(n.data?.componentId)).length;
    if (serverCount > 1) recommendations.push("Add a load balancer to distribute traffic across your servers.");
  }
  if (queueNodes.length === 0 && config.rps > 5000) {
    recommendations.push("Consider adding a message queue to buffer traffic spikes and decouple services.");
  }
  if (config.multiRegion && !nodes.some(n => n.data?.componentId === "cdn")) {
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
    cacheHitRate: Math.round(cacheHitRate),
    queueDepthPeak: Math.round(queueDepthPeak),
    bottleneckNodeId: bottleneckId,
    availability,
    spofs,
    redundancyScore,
    capacityCeiling,
    autoScalingHeadroom: Math.max(0, autoScalingHeadroom),
    recommendations,
    timelineData,
  };
}
