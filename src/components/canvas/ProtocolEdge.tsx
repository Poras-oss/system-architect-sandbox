import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import useStore from '../../store/useStore';

export default function ProtocolEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const protocol = data?.protocol || 'HTTP';
  const isAsync = data?.edgeType === 'async';

  // Make the edge slightly thicker if selected
  const edgeStyle = {
    ...style,
    strokeWidth: selected ? 3 : 2,
    stroke: selected ? 'hsl(var(--primary))' : 'hsl(218, 11%, 37%)',
    strokeDasharray: isAsync ? '5 5' : undefined,
  };

  const marker = selected ? { type: markerEnd?.type, color: 'hsl(var(--primary))' } : markerEnd;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={marker as any} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            // Only allow interaction via React Flow's native edge click handlers
            pointerEvents: 'none',
          }}
          className={`nopan nodrag text-[9px] px-1.5 py-0.5 rounded border font-semibold tracking-wider transition-colors ${
            selected
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-surface-1 text-muted-foreground border-border'
          }`}
        >
          {protocol}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
