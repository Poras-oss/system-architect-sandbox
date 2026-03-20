import { memo, useMemo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { getDefinition, categoryColorMap, categoryBgMap, CategoryId } from "../../data/nodeTypes";
import useStore from "../../store/useStore";

function SystemNode({ id, data, selected }: NodeProps) {
  const def = useMemo(() => getDefinition(data.componentId), [data.componentId]);
  const simulationResult = useStore((s) => s.simulationResult);
  const criticalPath = useStore((s) => s.criticalPath);
  const simHighlightsActive = useStore((s) => s.simHighlightsActive);

  const isBottleneck = simulationResult?.bottleneckNodeId === id;
  const isOnCriticalPath = criticalPath.includes(id);
  const isDimmed = simHighlightsActive && !isOnCriticalPath && !isBottleneck;

  if (!def) return null;

  const category = def.category as CategoryId;
  const color = categoryColorMap[category];
  const bgColor = categoryBgMap[category];

  if (data.componentId === "sticky-note") {
    return (
      <div
        className={`rounded-lg px-3 py-2 min-w-[140px] max-w-[200px] text-xs ${isDimmed ? "sim-dimmed" : "sim-normal"}`}
        style={{
          backgroundColor: "hsla(38, 92%, 50%, 0.08)",
          border: "1px solid hsla(38, 92%, 50%, 0.2)",
          color: "hsl(38, 92%, 70%)",
        }}
      >
        <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
        <div className="font-medium mb-1">{data.label || "Note"}</div>
        <div className="opacity-70" style={{ whiteSpace: "pre-wrap" }}>{data.properties?.text || "..."}</div>
      </div>
    );
  }

  const IconComp = def.icon;

  return (
    <div
      className={`rounded-lg px-3 py-2.5 min-w-[140px] transition-all duration-200 ${isBottleneck ? "bottleneck-node" : ""} ${isDimmed ? "sim-dimmed" : "sim-normal"}`}
      style={{
        backgroundColor: "hsl(var(--canvas-node-bg))",
        border: `1px solid ${selected ? color : isBottleneck ? "hsl(0, 84%, 60%)" : "hsl(var(--canvas-node-border))"}`,
        boxShadow: selected
          ? `0 0 0 1px ${color}, 0 4px 12px rgba(0,0,0,0.3)`
          : isBottleneck
          ? "0 0 12px hsla(0, 84%, 60%, 0.3)"
          : "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !border-2"
        style={{ borderColor: "hsl(var(--canvas-node-bg))", width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !border-2"
        style={{ borderColor: "hsl(var(--canvas-node-bg))", width: 8, height: 8 }}
      />

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
          <IconComp size={15} style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate text-foreground">{data.label || def.label}</div>
          <div className="text-[10px] truncate text-muted-foreground">{def.description}</div>
        </div>
      </div>

      {data.properties?.instances > 1 && (
        <div className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: bgColor, color }}>
          ×{data.properties.instances} instances
        </div>
      )}
      {data.componentId === "load-balancer" && data.properties?.type && (
        <div className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded inline-block ml-1" style={{ backgroundColor: bgColor, color }}>
          {data.properties.type}
        </div>
      )}

      {isBottleneck && (
        <div className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: "hsla(0, 84%, 60%, 0.15)", color: "hsl(0, 84%, 70%)" }}>
          ⚠ Bottleneck
        </div>
      )}
      {simHighlightsActive && isOnCriticalPath && !isBottleneck && (
        <div className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: "hsla(142, 71%, 45%, 0.1)", color: "hsl(142, 71%, 55%)" }}>
          ✓ Critical Path
        </div>
      )}
    </div>
  );
}

export default memo(SystemNode);