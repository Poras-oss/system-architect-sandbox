import { Node } from "reactflow";

export interface CostLineItem {
  nodeId: string;
  label: string;
  monthlyCost: number;
  breakdown: string;
}

export function calculateCosts(nodes: Node[]): { items: CostLineItem[]; total: number } {
  const items: CostLineItem[] = [];

  for (const node of nodes) {
    const cid = node.data?.componentId;
    const p = node.data?.properties || {};
    const label = node.data?.label || cid;
    let cost = 0;
    let breakdown = "";

    switch (cid) {
      case "web-server":
      case "app-server": {
        const instances = p.instances || 1;
        cost = 0.10 * instances * 730;
        breakdown = `$0.10/hr × ${instances} instances × 730 hrs`;
        break;
      }
      case "microservice": {
        const instances = p.instances || 1;
        cost = 0.05 * instances * 730;
        breakdown = `$0.05/hr × ${instances} instances × 730 hrs`;
        break;
      }
      case "sql-db": {
        const storage = p.storageGB || 100;
        const replicas = p.readReplicas || 0;
        cost = storage * 0.115 + 0.10 * 730 * (1 + replicas);
        breakdown = `${storage}GB × $0.115 + $0.10/hr × ${1 + replicas} nodes × 730 hrs`;
        break;
      }
      case "nosql-db": {
        const rcu = p.rcu || 100;
        const wcu = p.wcu || 50;
        cost = rcu * 0.25 + wcu * 1.25;
        breakdown = `${rcu} RCU × $0.25 + ${wcu} WCU × $1.25`;
        break;
      }
      case "cache": {
        const cacheNodes = p.nodes || 1;
        cost = 0.017 * cacheNodes * 730;
        breakdown = `$0.017/hr × ${cacheNodes} nodes × 730 hrs`;
        break;
      }
      case "cdn": {
        cost = 100 * 0.085;
        breakdown = `~100GB transfer × $0.085/GB`;
        break;
      }
      case "load-balancer": {
        cost = 16 + 0.008 * 730 * 10;
        breakdown = `$16/mo base + ~$58 LCU usage`;
        break;
      }
      case "message-queue": {
        const throughput = p.maxThroughput || 10000;
        const monthlyMsgs = throughput * 3600 * 730;
        cost = (monthlyMsgs / 1_000_000) * 0.40;
        breakdown = `~${(monthlyMsgs / 1e9).toFixed(1)}B msgs × $0.40/M`;
        break;
      }
      case "serverless": {
        const concurrency = p.concurrencyLimit || 1000;
        const execTime = p.avgExecTimeMs || 100;
        const memMB = p.memoryMB || 256;
        const invocations = concurrency * 3600 * 24 * 30 * 0.01;
        cost = (invocations / 1_000_000) * 0.20 + (invocations * (execTime / 1000) * (memMB / 1024) * 0.0000166);
        breakdown = `~${(invocations / 1e6).toFixed(1)}M invocations + compute`;
        break;
      }
      case "object-storage": {
        const storage = p.storageGB || 500;
        cost = storage * 0.023;
        breakdown = `${storage}GB × $0.023/GB`;
        break;
      }
      case "data-warehouse": {
        const tb = p.storageTB || 1;
        cost = tb * 5 * 30;
        breakdown = `~${tb}TB scanned/day × $5/TB × 30 days`;
        break;
      }
      case "search-engine": {
        const searchNodes = p.nodes || 3;
        cost = 0.12 * searchNodes * 730;
        breakdown = `$0.12/hr × ${searchNodes} nodes × 730 hrs`;
        break;
      }
      case "worker": {
        const instances = p.instances || 1;
        cost = 0.05 * instances * 730;
        breakdown = `$0.05/hr × ${instances} instances × 730 hrs`;
        break;
      }
      default:
        continue;
    }

    if (cost > 0) {
      items.push({ nodeId: node.id, label, monthlyCost: Math.round(cost * 100) / 100, breakdown });
    }
  }

  const total = items.reduce((sum, item) => sum + item.monthlyCost, 0);
  return { items, total: Math.round(total * 100) / 100 };
}
