import { useCallback, useRef, useState, useMemo, DragEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import useStore from "../../store/useStore";
import SystemNode from "./SystemNode";
import { getDefinition } from "../../data/nodeTypes";

const nodeTypes: NodeTypes = { systemNode: SystemNode };

function CanvasInner() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    setSelectedNode, deleteNode, cloneNode, toggleEdgeType, snapToGrid,
  } = useStore();
  const addNode = useStore((s) => s.addNode);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const componentId = e.dataTransfer.getData("application/system-component");
    if (!componentId) return;
    const def = getDefinition(componentId);
    if (!def) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode = {
      id: `${componentId}-${Date.now()}`,
      type: "systemNode",
      position,
      data: {
        componentId,
        label: def.label,
        properties: { ...def.defaultProperties },
      },
    };
    addNode(newNode);
  }, [screenToFlowPosition, addNode]);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node.id);
    setContextMenu(null);
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, [setSelectedNode]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const onEdgeClick = useCallback((_: any, edge: any) => {
    toggleEdgeType(edge.id);
  }, [toggleEdgeType]);

  return (
    <div ref={reactFlowWrapper} className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        className="bg-surface-0"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(240, 5%, 12%)" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => {
            const def = getDefinition(n.data?.componentId);
            if (!def) return "#333";
            const colors: Record<string, string> = {
              client: "#3b82f6", network: "#8b5cf6", compute: "#10b981",
              data: "#f59e0b", infra: "#ef4444", observability: "#06b6d4",
            };
            return colors[def.category] || "#333";
          }}
          maskColor="rgba(0,0,0,0.7)"
          style={{ backgroundColor: "hsl(240, 5%, 8%)" }}
        />
      </ReactFlow>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="context-menu fixed z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                const node = nodes.find(n => n.id === contextMenu.nodeId);
                if (node) {
                  const newLabel = prompt("Edit label:", node.data?.label);
                  if (newLabel) {
                    useStore.getState().updateNodeData(contextMenu.nodeId, { label: newLabel });
                  }
                }
                setContextMenu(null);
              }}
            >
              Edit Label
            </div>
            <div
              className="context-menu-item"
              onClick={() => { cloneNode(contextMenu.nodeId); setContextMenu(null); }}
            >
              Clone
            </div>
            <div
              className="context-menu-item"
              style={{ color: "hsl(0, 84%, 60%)" }}
              onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null); }}
            >
              Delete
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DesignCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
