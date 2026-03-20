import { Node, Edge } from "reactflow";
import { ValidationIssue } from "../store/useStore";
import { getDefinition } from "../data/nodeTypes";

export function validateDesign(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const adj = new Map<string, string[]>();
  const radj = new Map<string, string[]>();

  edges.forEach(e => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    if (!radj.has(e.target)) radj.set(e.target, []);
    radj.get(e.target)!.push(e.source);
  });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Client connected directly to DB
  for (const node of nodes) {
    const cid = node.data?.componentId;
    if (!["web-client", "mobile-client", "iot-device"].includes(cid)) continue;
    const targets = adj.get(node.id) || [];
    for (const tid of targets) {
      const target = nodeMap.get(tid);
      if (!target) continue;
      const tcid = target.data?.componentId;
      if (["sql-db", "nosql-db"].includes(tcid)) {
        issues.push({
          id: `client-db-${node.id}-${tid}`,
          severity: "warning",
          message: `Client "${node.data?.label}" connects directly to database "${target.data?.label}" — add an app server.`,
          nodeIds: [node.id, tid],
        });
      }
    }
  }

  // No cache for read-heavy
  const hasCache = nodes.some(n => n.data?.componentId === "cache");
  const hasDB = nodes.some(n => ["sql-db", "nosql-db"].includes(n.data?.componentId));
  if (!hasCache && hasDB && nodes.length > 3) {
    issues.push({
      id: "no-cache",
      severity: "warning",
      message: "No caching layer detected — consider adding Redis for read-heavy workloads.",
      nodeIds: nodes.filter(n => ["sql-db", "nosql-db"].includes(n.data?.componentId)).map(n => n.id),
    });
  }

  // Single DB with no replica (SPOF)
  for (const node of nodes) {
    const cid = node.data?.componentId;
    if (cid === "sql-db" && (node.data?.properties?.readReplicas || 0) === 0 && node.data?.properties?.dbType !== "replica") {
      issues.push({
        id: `spof-db-${node.id}`,
        severity: "warning",
        message: `Database "${node.data?.label}" has no replicas — single point of failure.`,
        nodeIds: [node.id],
      });
    }
  }

  // No load balancer with multiple servers
  const servers = nodes.filter(n => ["web-server", "app-server", "microservice"].includes(n.data?.componentId));
  const hasLB = nodes.some(n => n.data?.componentId === "load-balancer");
  if (servers.length > 1 && !hasLB) {
    issues.push({
      id: "no-lb",
      severity: "error",
      message: "Multiple servers detected with no load balancer.",
      nodeIds: servers.map(n => n.id),
    });
  }

  // Message queue with no dead-letter queue indication
  const queues = nodes.filter(n => n.data?.componentId === "message-queue");
  if (queues.length === 1) {
    issues.push({
      id: "no-dlq",
      severity: "info",
      message: "Consider adding a dead-letter queue for failed message handling.",
      nodeIds: queues.map(n => n.id),
    });
  }

  // Loop detection (simple cycle detection with DFS)
  const visited = new Set<string>();
  const inStack = new Set<string>();
  let hasCycle = false;
  const cycleNodes: string[] = [];

  function dfs(nid: string) {
    if (hasCycle) return;
    visited.add(nid);
    inStack.add(nid);
    for (const next of (adj.get(nid) || [])) {
      if (inStack.has(next)) {
        hasCycle = true;
        cycleNodes.push(nid, next);
        return;
      }
      if (!visited.has(next)) dfs(next);
    }
    inStack.delete(nid);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  if (hasCycle) {
    issues.push({
      id: "cycle-detected",
      severity: "error",
      message: "Loop detected in architecture graph — this may cause infinite request cycles.",
      nodeIds: [...new Set(cycleNodes)],
    });
  }

  return issues;
}
