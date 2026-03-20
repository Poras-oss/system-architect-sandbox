import { useMemo } from "react";
import useStore from "../../store/useStore";
import { getDefinition, categoryColorMap, categoryBgMap, CategoryId } from "../../data/nodeTypes";
import { ArrowLeft } from "lucide-react";

export default function NodePropertiesPanel() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const nodes = useStore((s) => s.nodes);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const deleteNode = useStore((s) => s.deleteNode);

  const node = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);
  const def = useMemo(() => node ? getDefinition(node.data?.componentId) : null, [node]);

  if (!node || !def) return null;

  const props = node.data?.properties || {};
  const category = def.category as CategoryId;
  const color = categoryColorMap[category];

  const updateProp = (key: string, value: any) => {
    updateNodeData(node.id, { properties: { ...props, [key]: value } });
  };

  const updateLabel = (label: string) => {
    updateNodeData(node.id, { label });
  };

  const renderField = (label: string, key: string, type: "text" | "number" | "select", options?: { value: string; label: string }[]) => (
    <div key={key} className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
      {type === "select" ? (
        <select
          value={props[key] || ""}
          onChange={(e) => updateProp(key, e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={props[key] ?? ""}
          onChange={(e) => updateProp(key, type === "number" ? Number(e.target.value) : e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  );

  const propertyFields = () => {
    const cid = node.data?.componentId;
    switch (cid) {
      case "load-balancer":
        return [
          renderField("Algorithm", "algorithm", "select", [
            { value: "round-robin", label: "Round Robin" },
            { value: "least-connections", label: "Least Connections" },
            { value: "ip-hash", label: "IP Hash" },
          ]),
          renderField("Type", "type", "select", [
            { value: "L4", label: "L4" },
            { value: "L7", label: "L7" },
          ]),
          renderField("Health Check Interval (s)", "healthCheckInterval", "number"),
        ];
      case "sql-db":
        return [
          renderField("Engine", "engine", "select", [
            { value: "PostgreSQL", label: "PostgreSQL" },
            { value: "MySQL", label: "MySQL" },
          ]),
          renderField("Type", "dbType", "select", [
            { value: "primary", label: "Primary" },
            { value: "replica", label: "Replica" },
            { value: "shard", label: "Shard" },
          ]),
          renderField("Read Replicas", "readReplicas", "number"),
          renderField("Storage (GB)", "storageGB", "number"),
          renderField("Replication Mode", "replicationMode", "select", [
            { value: "sync", label: "Synchronous" },
            { value: "async", label: "Asynchronous" },
          ]),
        ];
      case "nosql-db":
        return [
          renderField("Engine", "engine", "select", [
            { value: "DynamoDB", label: "DynamoDB" },
            { value: "MongoDB", label: "MongoDB" },
          ]),
          renderField("Storage (GB)", "storageGB", "number"),
          renderField("Read Capacity Units", "rcu", "number"),
          renderField("Write Capacity Units", "wcu", "number"),
        ];
      case "cache":
        return [
          renderField("Eviction Policy", "evictionPolicy", "select", [
            { value: "LRU", label: "LRU" },
            { value: "LFU", label: "LFU" },
            { value: "TTL", label: "TTL" },
          ]),
          renderField("Max Memory (MB)", "maxMemoryMB", "number"),
          renderField("Hit Rate Target (%)", "hitRateTarget", "number"),
          renderField("Nodes", "nodes", "number"),
        ];
      case "message-queue":
        return [
          renderField("Engine", "engine", "select", [
            { value: "Kafka", label: "Kafka" },
            { value: "RabbitMQ", label: "RabbitMQ" },
            { value: "SQS", label: "SQS" },
          ]),
          renderField("Max Throughput (msg/s)", "maxThroughput", "number"),
          renderField("Retention (hrs)", "retentionHrs", "number"),
          renderField("Consumer Groups", "consumerGroups", "number"),
        ];
      case "web-server":
      case "app-server":
      case "microservice":
        return [
          renderField("Instances", "instances", "number"),
          renderField("CPU Cores", "cpuCores", "number"),
          renderField("RAM (GB)", "ramGB", "number"),
          renderField("Max RPS/Instance", "maxRPS", "number"),
        ];
      case "serverless":
        return [
          renderField("Avg Execution Time (ms)", "avgExecTimeMs", "number"),
          renderField("Memory (MB)", "memoryMB", "number"),
          renderField("Concurrency Limit", "concurrencyLimit", "number"),
        ];
      case "cdn":
        return [
          renderField("Cache Hit Ratio (%)", "cacheHitRatio", "number"),
          renderField("Regions", "regions", "number"),
        ];
      case "rate-limiter":
        return [
          renderField("Max RPS", "maxRPS", "number"),
          renderField("Window Type", "windowType", "select", [
            { value: "fixed", label: "Fixed" },
            { value: "sliding", label: "Sliding" },
          ]),
        ];
      case "api-gateway":
        return [renderField("Rate Limit (RPS)", "rateLimit", "number")];
      case "worker":
        return [
          renderField("Instances", "instances", "number"),
          renderField("CPU Cores", "cpuCores", "number"),
          renderField("RAM (GB)", "ramGB", "number"),
        ];
      case "sticky-note":
        return [renderField("Note Text", "text", "text")];
      default:
        return [];
    }
  };

  const Icon = def.icon;

  return (
    <div className="h-full flex flex-col bg-surface-1 border-r border-border">
      <div className="px-3 py-3 border-b border-border flex items-center gap-2">
        <button
          onClick={() => setSelectedNode(null)}
          className="p-1 rounded hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft size={14} className="text-muted-foreground" />
        </button>
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ backgroundColor: categoryBgMap[category] }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        <h2 className="text-xs font-semibold text-foreground truncate">{node.data?.label}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Label */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Label</label>
          <input
            type="text"
            value={node.data?.label || ""}
            onChange={(e) => updateLabel(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Component-specific properties */}
        {propertyFields()}

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Notes</label>
          <textarea
            value={props.notes || ""}
            onChange={(e) => updateProp("notes", e.target.value)}
            rows={3}
            className="w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {/* Delete button */}
        <button
          onClick={() => { deleteNode(node.id); setSelectedNode(null); }}
          className="w-full mt-4 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          Delete Component
        </button>
      </div>
    </div>
  );
}
