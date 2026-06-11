import { useMemo, useState } from "react";
import useStore from "../../store/useStore";
import { runValidatedSimulation, SimValidationIssue } from "../../utils/simulationValidator";
import { calculateCosts, compareCostVsPerf } from "../../utils/costEstimator";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Play, DollarSign, Activity, Shield, TrendingUp, AlertTriangle, AlertCircle,
  ChevronDown, ChevronRight, Loader2, XCircle, Info,
} from "lucide-react";
import { MarkerType } from "reactflow";

export default function RightPanel() {
  const {
    nodes, edges, simulationConfig, simulationResult, isSimulating,
    setSimulationConfig, setSimulationResult, setIsSimulating,
    setCriticalPath, setSimHighlightsActive, clearSimHighlights, simHighlightsActive,
    baselineState, setBaseline, clearBaseline,
  } = useStore();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["sim-controls", "cost"]));
  const [simErrors, setSimErrors] = useState<SimValidationIssue[]>([]);
  const [simWarnings, setSimWarnings] = useState<SimValidationIssue[]>([]);
  const [unreachableCount, setUnreachableCount] = useState(0);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const costs = useMemo(() => calculateCosts(nodes), [nodes]);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimErrors([]);
    setSimWarnings([]);

    setTimeout(() => {
      let simNodes = [...nodes];
      let simEdges = [...edges];
      let simConfig = { ...config }; // mutable copy for per-run overrides

      if (config.preset === "db-failure") {
        simNodes = simNodes.filter(n => !(n.data?.componentId === "sql-db" && n.data?.properties?.dbType !== "replica"));
      } else if (config.preset === "cold-start") {
        simNodes = simNodes.map(n => n.data?.componentId === "cache" ? { ...n, data: { ...n.data, properties: { ...n.data.properties, hitRateTarget: 0 } } } : n);
      } else if (config.preset === "region-outage") {
        // Simulate cross-region failover: force cross-region network topology
        simConfig = { ...simConfig, networkTopology: "cross-region" };
      } else if (config.preset === "network-partition") {
        // Kill all async edges — message queues stop delivering
        simEdges = simEdges.filter(e => e.data?.edgeType !== "async");
      } else if (config.preset === "cascade-failure") {
        // Find and remove the highest-blast-radius node (simulate losing the most critical dependency)
        // We'll do a quick blast radius calculation here
        const syncRevAdj = new Map<string, string[]>();
        simEdges.forEach(e => {
          if (e.data?.edgeType !== "async") {
            if (!syncRevAdj.has(e.target)) syncRevAdj.set(e.target, []);
            syncRevAdj.get(e.target)!.push(e.source);
          }
        });
        const bfsCount = (startId: string) => {
          const visited = new Set<string>([startId]);
          const q = [startId];
          while (q.length > 0) {
            const cur = q.shift()!;
            for (const n of (syncRevAdj.get(cur) || [])) {
              if (!visited.has(n)) { visited.add(n); q.push(n); }
            }
          }
          return visited.size - 1;
        };
        let maxBlast = -1;
        let maxBlastId = "";
        simNodes.filter(n => !["web-client","mobile-client","iot-device"].includes(n.data?.componentId)).forEach(n => {
          const blast = bfsCount(n.id);
          if (blast > maxBlast) { maxBlast = blast; maxBlastId = n.id; }
        });
        if (maxBlastId) {
          simNodes = simNodes.filter(n => n.id !== maxBlastId);
          simEdges = simEdges.filter(e => e.source !== maxBlastId && e.target !== maxBlastId);
        }
      }

      const validated = runValidatedSimulation(simNodes, simEdges, simConfig);
      setUnreachableCount(validated.unreachableCount);

      if (validated.errors.length > 0) {
        setSimErrors(validated.errors);
        setSimulationResult(null);
        setCriticalPath([]);
        setSimHighlightsActive(false);
        setIsSimulating(false);
        return;
      }

      if (config.diffMode || baselineState) {
        const baseNodes = baselineState ? baselineState.nodes : nodes;
        const baseEdges = baselineState ? baselineState.edges : edges;
        const baseConfig = baselineState ? baselineState.config : config;
        
        const delta = compareCostVsPerf(baseNodes, simNodes, baseEdges, simEdges, baseConfig);
        if (delta && validated.result) {
          validated.result.diffDelta = delta;
        }
      }

      // Compute chaos impact for transient failure scenarios
      if (validated.result && config.preset !== "none") {
        const rps = config.rps;
        const hasReplica = simNodes.some(n => n.data?.componentId === "sql-db" && (n.data?.properties?.readReplicas || 0) > 0);
        const hasAsyncReplication = edges.some(e => e.data?.edgeType === "async" && simNodes.some(n => n.id === e.target && n.data?.componentId === "sql-db"));

        let chaosImpact: NonNullable<typeof validated.result.chaosImpact>;

        if (config.preset === "db-failure") {
          const failoverSec = hasReplica ? 45 : 300; // RDS failover ~45s, manual ~5min
          chaosImpact = {
            failoverDurationSec: failoverSec,
            requestsDroppedDuringFailover: Math.round(rps * failoverSec),
            dataLossRisk: hasAsyncReplication ? "low" : "none",
            transientErrorRate: hasReplica ? 30 : 100,
            description: hasReplica
              ? `DB failover takes ~${failoverSec}s. Expect ~${Math.round(rps * failoverSec).toLocaleString()} dropped requests and 30% error rate during switchover.`
              : `No replica available. Full outage until manual recovery (~5 min). All ${Math.round(rps * failoverSec).toLocaleString()} requests during that window will fail.`,
          };
        } else if (config.preset === "black-friday") {
          const ceiling = validated.result.capacityCeiling;
          const spikeRps = rps * 10;
          const errorRate = spikeRps > ceiling ? Math.min(((spikeRps - ceiling) / spikeRps) * 100, 95) : 0;
          chaosImpact = {
            failoverDurationSec: 0,
            requestsDroppedDuringFailover: 0,
            dataLossRisk: "none",
            transientErrorRate: Math.round(errorRate),
            description: spikeRps > ceiling
              ? `10× traffic (${spikeRps.toLocaleString()} RPS) exceeds capacity ceiling (${ceiling.toLocaleString()} RPS). ~${Math.round(errorRate)}% of requests will be rejected or timeout.`
              : `System handles 10× traffic (${spikeRps.toLocaleString()} RPS) within capacity. Latency will increase significantly but no errors expected.`,
          };
        } else if (config.preset === "cold-start") {
          const cacheNodes = nodes.filter(n => n.data?.componentId === "cache");
          const warmupSec = cacheNodes.length * 30; // ~30s per cache node to warm
          chaosImpact = {
            failoverDurationSec: warmupSec,
            requestsDroppedDuringFailover: 0,
            dataLossRisk: "none",
            transientErrorRate: 0,
            description: `Cache cold start: all ${cacheNodes.length} cache node(s) empty. Every read hits the database for ~${warmupSec}s until warmed. DB load will spike ${Math.round(100 / Math.max(1, 100 - (cacheNodes.length > 0 ? 95 : 0)))}×.`,
          };
        } else if (config.preset === "region-outage") {
          const failoverSec = 120; // DNS TTL + health check propagation
          chaosImpact = {
            failoverDurationSec: failoverSec,
            requestsDroppedDuringFailover: Math.round(rps * failoverSec),
            dataLossRisk: "low",
            transientErrorRate: 50,
            description: `Region failover takes ~${failoverSec}s (DNS TTL + health check propagation). ~${Math.round(rps * failoverSec).toLocaleString()} requests dropped. After recovery, cross-region latency applies (+70ms/hop).`,
          };
        } else if (config.preset === "network-partition") {
          const queueCount = nodes.filter(n => n.data?.componentId === "message-queue").length;
          chaosImpact = {
            failoverDurationSec: 0,
            requestsDroppedDuringFailover: 0,
            dataLossRisk: queueCount > 0 ? "high" : "none",
            transientErrorRate: 0,
            description: queueCount > 0
              ? `${queueCount} message queue(s) stopped delivering. Events produced during the partition will be re-delivered when recovered, potentially causing duplicate processing.`
              : `No async edges affected. Sync connections still work. Partition primarily affects eventual-consistency guarantees.`,
          };
        } else if (config.preset === "cascade-failure") {
          chaosImpact = {
            failoverDurationSec: 0,
            requestsDroppedDuringFailover: 0,
            dataLossRisk: "none",
            transientErrorRate: validated.result.availability < 95 ? 80 : 30,
            description: `Highest blast-radius node removed. Availability dropped to ${validated.result.availability}%. This simulates a cascading failure triggered by losing one critical dependency.`,
          };
        } else {
          chaosImpact = { failoverDurationSec: 0, requestsDroppedDuringFailover: 0, dataLossRisk: "none", transientErrorRate: 0, description: "" };
        }

        validated.result.chaosImpact = chaosImpact;
      }

      setSimWarnings(validated.warnings);
      setSimulationResult(validated.result);
      setCriticalPath(validated.criticalPath);

      // Apply edge highlights
      if (validated.result && validated.criticalPath.length > 0) {
        const critPathSet = new Set(validated.criticalPath);
        const store = useStore.getState();
        const updatedEdges = store.edges.map(e => {
          const onCritPath = critPathSet.has(e.source) && critPathSet.has(e.target);
          const isAsync = e.data?.edgeType === "async";
          const targetNode = nodes.find(n => n.id === e.target);
          const isQueueEdge = isAsync && targetNode?.data?.componentId === "message-queue";

          if (onCritPath && !isAsync) {
            return {
              ...e,
              style: { stroke: "#22c55e", strokeWidth: 2.5 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
            };
          }
          if (isAsync) {
            return {
              ...e,
              style: { stroke: "#a78bfa", strokeWidth: 2, strokeDasharray: "5 5" },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#a78bfa" },
            };
          }
          return e;
        });
        useStore.setState({ edges: updatedEdges });
        setSimHighlightsActive(true);
      }

      setIsSimulating(false);
    }, 600);
  };

  const config = simulationConfig;

  const SectionHeader = ({ id, icon: Icon, label, badge }: { id: string; icon: any; label: string; badge?: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
    >
      {expandedSections.has(id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <Icon size={12} />
      {label}
      {badge && <span className="ml-auto text-[10px] font-normal px-1.5 py-0.5 rounded bg-surface-2">{badge}</span>}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border overflow-y-auto">
      {/* Simulation Controls */}
      <SectionHeader id="sim-controls" icon={Play} label="Simulation" />
      {expandedSections.has("sim-controls") && (
        <>
          <div className="px-3 pb-3 space-y-3">
            <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Requests: {config.totalRequests.toLocaleString()}</label>
            <input type="range" min={1000} max={10000000} step={1000} value={config.totalRequests} onChange={(e) => setSimulationConfig({ totalRequests: Number(e.target.value) })} className="w-full accent-primary h-1" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">RPS: {config.rps.toLocaleString()}</label>
            <input type="range" min={1} max={500000} step={100} value={config.rps} onChange={(e) => setSimulationConfig({ rps: Number(e.target.value) })} className="w-full accent-primary h-1" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Read/Write: {config.readWriteMix.read}% / {config.readWriteMix.write}%</label>
            <input type="range" min={0} max={100} value={config.readWriteMix.read} onChange={(e) => { const read = Number(e.target.value); setSimulationConfig({ readWriteMix: { read, write: 100 - read } }); }} className="w-full accent-primary h-1" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={config.multiRegion} onChange={(e) => setSimulationConfig({ multiRegion: e.target.checked })} className="accent-primary w-3 h-3" /> Multi-region
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={config.diffMode} onChange={(e) => setSimulationConfig({ diffMode: e.target.checked })} className="accent-primary w-3 h-3" /> Diff Mode
            </label>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Network Topology</label>
            <select
              value={config.networkTopology}
              onChange={(e) => setSimulationConfig({ networkTopology: e.target.value as any })}
              className="w-full text-xs p-1.5 rounded bg-surface-2 border border-border text-foreground"
            >
              <option value="same-az">🏢 Same AZ (+0.5ms/hop)</option>
              <option value="cross-az">🏙️ Cross AZ (+2ms/hop)</option>
              <option value="cross-region">🌍 Cross Region (+70ms/hop)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scenario Preset</label>
            <select value={config.preset} onChange={(e) => setSimulationConfig({ preset: e.target.value as any })} className="w-full text-xs p-1.5 rounded bg-surface-2 border border-border text-foreground">
              <option value="none">None</option>
              <option value="black-friday">📈 Black Friday (10× traffic)</option>
              <option value="db-failure">🚨 DB Primary Failure</option>
              <option value="cold-start">❄️ Cold Start (Cache Flush)</option>
              <option value="region-outage">🌍 Region Outage (Failover)</option>
              <option value="network-partition">⚡ Network Partition (Async Dead)</option>
              <option value="cascade-failure">💥 Cascade Failure (Worst Node Down)</option>
            </select>
          </div>
        </div>
        
        <div className="p-3 bg-surface-1 border-t border-border mt-auto flex-shrink-0 space-y-2">
          {baselineState ? (
            <div className="flex items-center gap-2">
              <button
                onClick={clearBaseline}
                className="w-1/3 py-2 bg-surface-2 text-foreground font-medium rounded-md hover:bg-surface-3 transition-colors text-xs flex justify-center items-center gap-1.5"
              >
                Clear Baseline
              </button>
              <button
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="w-2/3 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-colors text-xs flex justify-center items-center gap-1.5"
              >
                {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Diff vs Baseline
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={setBaseline}
                className="w-1/3 py-2 bg-surface-2 text-foreground font-medium rounded-md hover:bg-surface-3 transition-colors text-xs flex justify-center items-center gap-1.5"
              >
                Set Baseline
              </button>
              <button
                onClick={handleRunSimulation}
                disabled={isSimulating || nodes.length === 0}
                className="w-2/3 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-colors text-xs flex justify-center items-center gap-1.5"
              >
                {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run Simulation
              </button>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            {simHighlightsActive && (
              <button
                onClick={clearSimHighlights}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground border border-border hover:bg-surface-2 transition-colors"
              >
                <XCircle size={12} /> Clear Simulation Highlights
              </button>
            )}
          </div>
        </div>
        </>
      )}

      {/* Validation Errors */}
      {simErrors.length > 0 && (
        <div className="px-3 py-3 space-y-2 border-b border-border">
          <div className="text-[10px] uppercase tracking-wider text-destructive font-semibold flex items-center gap-1">
            <AlertCircle size={11} /> Simulation Blocked
          </div>
          {simErrors.map((err, i) => (
            <div key={i} className="rounded-md px-2.5 py-2 text-[11px] leading-relaxed bg-destructive/10 text-destructive border border-destructive/20">
              {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Unreachable warning */}
      {unreachableCount > 0 && simulationResult && (
        <div className="px-3 py-2 border-b border-border">
          <div className="rounded-md px-2.5 py-2 text-[11px] leading-relaxed bg-cat-data/10 text-cat-data border border-cat-data/20 flex items-start gap-1.5">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            {unreachableCount} node{unreachableCount > 1 ? "s are" : " is"} disconnected from any client source and {unreachableCount > 1 ? "were" : "was"} excluded.
          </div>
        </div>
      )}

      {/* Soft Warnings */}
      {simWarnings.length > 0 && simulationResult && (
        <div className="px-3 py-3 space-y-2 border-b border-border">
          <div className="text-[10px] uppercase tracking-wider text-cat-data font-semibold flex items-center gap-1">
            <AlertTriangle size={11} /> Warnings
          </div>
          {simWarnings.map((w, i) => (
            <div key={i} className="rounded-md px-2.5 py-2 text-[11px] leading-relaxed bg-cat-data/10 text-cat-data border border-cat-data/20">
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Simulation Results */}
      {simulationResult && (
        <>
          <SectionHeader id="perf" icon={Activity} label="Performance" />
          {expandedSections.has("perf") && (
            <div className="px-3 pb-3 space-y-2 border-b border-border">
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="P50" value={`${simulationResult.p50}ms`} />
                <MetricCard label="P95" value={`${simulationResult.p95}ms`} />
                <MetricCard label="P99" value={`${simulationResult.p99}ms`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Throughput" value={`${simulationResult.throughputAchieved.toLocaleString()} RPS`} />
                <MetricCard label="Cache Hit" value={`${simulationResult.cacheHitRate}%`} />
              </div>
              {simulationResult.queueDepthPeak > 0 && (
                <MetricCard label="Queue Depth Peak" value={simulationResult.queueDepthPeak.toLocaleString()} />
              )}
              <div className="pt-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Timeline</div>
                <div className="h-[160px] -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationResult.timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={35} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--surface-2))", border: "1px solid hsl(var(--border))", borderRadius: "0.375rem", fontSize: "11px", color: "hsl(var(--foreground))" }} />
                      <Line type="monotone" dataKey="rps" stroke="hsl(221, 83%, 53%)" strokeWidth={1.5} dot={false} name="RPS" />
                      <Line type="monotone" dataKey="latency" stroke="hsl(38, 92%, 50%)" strokeWidth={1.5} dot={false} name="Latency" />
                      <Line type="monotone" dataKey="errorRate" stroke="hsl(0, 84%, 60%)" strokeWidth={1.5} dot={false} name="Error %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <SectionHeader id="reliability" icon={Shield} label="Reliability" />
          {expandedSections.has("reliability") && (
            <div className="px-3 pb-3 space-y-2 border-b border-border">
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Availability" value={`${simulationResult.availability}%`} color={simulationResult.availability >= 99.9 ? "green" : simulationResult.availability >= 99 ? "yellow" : "red"} />
                <MetricCard label="Redundancy" value={`${simulationResult.redundancyScore}/100`} />
                <MetricCard label="Observability" value={`${simulationResult.observabilityCoverage}%`} color={simulationResult.observabilityCoverage >= 80 ? "green" : "red"} />
              </div>
              {simulationResult.availabilityDowntime && (
                <div className="text-[10px] text-muted-foreground px-1">
                  {simulationResult.availability}% → {simulationResult.availabilityDowntime}
                </div>
              )}
              {simulationResult.spofs.length > 0 && (
                <div className="rounded-md px-2 py-2 text-[11px] space-y-1 bg-destructive/10">
                  <div className="font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle size={11} /> Single Points of Failure
                  </div>
                  {simulationResult.spofs.map((s, i) => (
                    <div key={i} className="text-muted-foreground">• {s}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <SectionHeader id="scalability" icon={TrendingUp} label="Scalability" />
          {expandedSections.has("scalability") && (
            <div className="px-3 pb-3 space-y-2 border-b border-border">
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Capacity Ceiling" value={`${simulationResult.capacityCeiling.toLocaleString()} RPS`} />
                <MetricCard label="Headroom" value={`${simulationResult.autoScalingHeadroom}%`} />
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Recommendations</div>
                {simulationResult.recommendations.map((r, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground leading-relaxed pl-3 relative">
                    <span className="absolute left-0 text-primary">•</span> {r}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Cost Estimator */}
      <SectionHeader id="cost" icon={DollarSign} label="Cost Estimate" badge={costs.total > 0 ? `$${costs.total.toLocaleString()}/mo` : undefined} />
      {expandedSections.has("cost") && (
        <div className="px-3 pb-3 space-y-2">
          {costs.items.length === 0 ? (
            <div className="text-[11px] text-muted-foreground py-2">Add components to see cost estimates.</div>
          ) : (
            <>
              {costs.items.map((item) => (
                <div key={item.nodeId} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-foreground">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground">{item.breakdown}</div>
                  </div>
                  <div className="text-[11px] font-medium text-foreground whitespace-nowrap">${item.monthlyCost.toLocaleString()}</div>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <div className="text-xs font-semibold text-foreground">Total Monthly</div>
                <div className="text-sm font-bold text-primary">${costs.total.toLocaleString()}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Diff Mode Report */}
      {((config.diffMode || baselineState) && simulationResult?.diffDelta) && (
        <>
          <SectionHeader id="diff" icon={Activity} label="Diff vs Original" />
          <div className="px-3 pb-3 space-y-2 border-b border-border">
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Comparing original architecture against mutated preset...
            </div>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <div className="rounded-md px-2 py-1.5 bg-surface-2 flex justify-between">
                <span className="text-[10px] text-muted-foreground">Latency (P95) Change</span>
                <span className={`text-[11px] font-semibold ${simulationResult.diffDelta.latencyDiff > 0 ? 'text-destructive' : simulationResult.diffDelta.latencyDiff < 0 ? 'text-green-500' : 'text-foreground'}`}>
                  {simulationResult.diffDelta.latencyDiff > 0 ? '+' : ''}{simulationResult.diffDelta.latencyDiff}ms
                </span>
              </div>
              <div className="rounded-md px-2 py-1.5 bg-surface-2 flex justify-between">
                <span className="text-[10px] text-muted-foreground">Availability Change</span>
                <span className={`text-[11px] font-semibold ${simulationResult.diffDelta.availabilityDiff < 0 ? 'text-destructive' : simulationResult.diffDelta.availabilityDiff > 0 ? 'text-green-500' : 'text-foreground'}`}>
                  {simulationResult.diffDelta.availabilityDiff > 0 ? '+' : ''}{simulationResult.diffDelta.availabilityDiff}%
                </span>
              </div>
              <div className="rounded-md px-2 py-1.5 bg-surface-2 flex justify-between">
                <span className="text-[10px] text-muted-foreground">Cost Change</span>
                <span className={`text-[11px] font-semibold ${simulationResult.diffDelta.costDiff > 0 ? 'text-destructive' : simulationResult.diffDelta.costDiff < 0 ? 'text-green-500' : 'text-foreground'}`}>
                  {simulationResult.diffDelta.costDiff > 0 ? '+$' : simulationResult.diffDelta.costDiff < 0 ? '-$' : '$'}{Math.abs(simulationResult.diffDelta.costDiff).toLocaleString()}/mo
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Chaos Impact Card */}
      {simulationResult?.chaosImpact && config.preset !== "none" && (
        <>
          <SectionHeader id="chaos" icon={AlertTriangle} label="Chaos Impact" />
          {expandedSections.has("chaos") && (
            <div className="px-3 pb-3 space-y-2 border-b border-border">
              <div className="rounded-md px-2.5 py-2.5 text-[11px] leading-relaxed bg-destructive/10 text-destructive border border-destructive/20 space-y-2">
                <div>{simulationResult.chaosImpact.description}</div>
                {simulationResult.chaosImpact.failoverDurationSec > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded bg-surface-2 px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground">Recovery Time</div>
                      <div className="font-semibold text-foreground">{simulationResult.chaosImpact.failoverDurationSec}s</div>
                    </div>
                    <div className="rounded bg-surface-2 px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground">Requests Dropped</div>
                      <div className="font-semibold text-foreground">{simulationResult.chaosImpact.requestsDroppedDuringFailover.toLocaleString()}</div>
                    </div>
                  </div>
                )}
                {simulationResult.chaosImpact.transientErrorRate > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded bg-surface-2 px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground">Error Rate</div>
                      <div className={`font-semibold ${simulationResult.chaosImpact.transientErrorRate > 50 ? 'text-destructive' : 'text-cat-data'}`}>
                        {simulationResult.chaosImpact.transientErrorRate}%
                      </div>
                    </div>
                    <div className="rounded bg-surface-2 px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground">Data Loss Risk</div>
                      <div className={`font-semibold capitalize ${
                        simulationResult.chaosImpact.dataLossRisk === 'high' ? 'text-destructive' :
                        simulationResult.chaosImpact.dataLossRisk === 'low' ? 'text-cat-data' : 'text-green-500'
                      }`}>{simulationResult.chaosImpact.dataLossRisk}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: "green" | "yellow" | "red" }) {
  const colorStyle = color === "green"
    ? { color: "hsl(142, 71%, 55%)" }
    : color === "red"
    ? { color: "hsl(0, 84%, 60%)" }
    : color === "yellow"
    ? { color: "hsl(38, 92%, 60%)" }
    : undefined;

  return (
    <div className="rounded-md px-2 py-1.5 bg-surface-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold text-foreground" style={colorStyle}>{value}</div>
    </div>
  );
}