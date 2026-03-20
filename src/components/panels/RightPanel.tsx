import { useMemo, useState } from "react";
import useStore from "../../store/useStore";
import { runValidatedSimulation, SimValidationIssue } from "../../utils/simulationValidator";
import { calculateCosts } from "../../utils/costEstimator";
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
      const validated = runValidatedSimulation(nodes, edges, simulationConfig);
      setUnreachableCount(validated.unreachableCount);

      if (validated.errors.length > 0) {
        setSimErrors(validated.errors);
        setSimulationResult(null);
        setCriticalPath([]);
        setSimHighlightsActive(false);
        setIsSimulating(false);
        return;
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
        <div className="px-3 pb-3 space-y-3 border-b border-border">
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
              <input type="checkbox" checked={config.spikeEnabled} onChange={(e) => setSimulationConfig({ spikeEnabled: e.target.checked })} className="accent-primary w-3 h-3" /> 10x Spike
            </label>
          </div>
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating || nodes.length === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            {isSimulating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isSimulating ? "Simulating..." : "Run Simulation"}
          </button>

          {simHighlightsActive && (
            <button
              onClick={clearSimHighlights}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground border border-border hover:bg-surface-2 transition-colors"
            >
              <XCircle size={12} /> Clear Simulation Highlights
            </button>
          )}
        </div>
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
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Availability" value={`${simulationResult.availability}%`} color={simulationResult.availability >= 99.9 ? "green" : simulationResult.availability >= 99 ? "yellow" : "red"} />
                <MetricCard label="Redundancy" value={`${simulationResult.redundancyScore}/100`} />
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