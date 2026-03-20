import { useMemo, useState } from "react";
import useStore from "../../store/useStore";
import { runSimulation } from "../../utils/simulation";
import { calculateCosts } from "../../utils/costEstimator";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Play, DollarSign, Activity, Shield, TrendingUp, AlertTriangle,
  ChevronDown, ChevronRight, Loader2,
} from "lucide-react";

export default function RightPanel() {
  const {
    nodes, edges, simulationConfig, simulationResult, isSimulating,
    setSimulationConfig, setSimulationResult, setIsSimulating,
  } = useStore();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["sim-controls", "cost"])
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const costs = useMemo(() => calculateCosts(nodes), [nodes]);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    // Small timeout for visual feedback
    setTimeout(() => {
      const result = runSimulation(nodes, edges, simulationConfig);
      setSimulationResult(result);
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
      {badge && (
        <span className="ml-auto text-[10px] font-normal px-1.5 py-0.5 rounded bg-surface-2">{badge}</span>
      )}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border overflow-y-auto">
      {/* Simulation Controls */}
      <SectionHeader id="sim-controls" icon={Play} label="Simulation" />
      {expandedSections.has("sim-controls") && (
        <div className="px-3 pb-3 space-y-3 border-b border-border">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Requests: {config.totalRequests.toLocaleString()}
            </label>
            <input
              type="range"
              min={1000}
              max={10000000}
              step={1000}
              value={config.totalRequests}
              onChange={(e) => setSimulationConfig({ totalRequests: Number(e.target.value) })}
              className="w-full accent-primary h-1"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              RPS: {config.rps.toLocaleString()}
            </label>
            <input
              type="range"
              min={1}
              max={500000}
              step={100}
              value={config.rps}
              onChange={(e) => setSimulationConfig({ rps: Number(e.target.value) })}
              className="w-full accent-primary h-1"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Read/Write: {config.readWriteMix.read}% / {config.readWriteMix.write}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={config.readWriteMix.read}
              onChange={(e) => {
                const read = Number(e.target.value);
                setSimulationConfig({ readWriteMix: { read, write: 100 - read } });
              }}
              className="w-full accent-primary h-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={config.multiRegion}
                onChange={(e) => setSimulationConfig({ multiRegion: e.target.checked })}
                className="accent-primary w-3 h-3"
              />
              Multi-region
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={config.spikeEnabled}
                onChange={(e) => setSimulationConfig({ spikeEnabled: e.target.checked })}
                className="accent-primary w-3 h-3"
              />
              10x Spike
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

              {/* Timeline chart */}
              <div className="pt-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Timeline</div>
                <div className="h-[160px] -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationResult.timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 4%, 16%)" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(240, 5%, 46%)" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(240, 5%, 46%)" }} tickLine={false} axisLine={false} width={35} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(240, 5%, 11%)",
                          border: "1px solid hsl(240, 4%, 18%)",
                          borderRadius: "0.375rem",
                          fontSize: "11px",
                          color: "hsl(240, 5%, 84%)",
                        }}
                      />
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
              {simulationResult.spofs.length > 0 && (
                <div className="rounded-md px-2 py-2 text-[11px] space-y-1" style={{ backgroundColor: "hsla(0, 84%, 60%, 0.08)" }}>
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
                    <span className="absolute left-0 text-primary">•</span>
                    {r}
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
                  <div className="text-[11px] font-medium text-foreground whitespace-nowrap">
                    ${item.monthlyCost.toLocaleString()}
                  </div>
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
    : { color: "hsl(240, 5%, 84%)" };

  return (
    <div className="rounded-md px-2 py-1.5 bg-surface-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold" style={colorStyle}>{value}</div>
    </div>
  );
}
