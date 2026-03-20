import { create } from "zustand";
import {
  Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges,
  NodeChange, EdgeChange, MarkerType,
} from "reactflow";

export interface SimulationConfig {
  totalRequests: number;
  rps: number;
  readWriteMix: { read: number; write: number };
  multiRegion: boolean;
  spikeEnabled: boolean;
}

export interface SimulationResult {
  p50: number;
  p95: number;
  p99: number;
  throughputAchieved: number;
  cacheHitRate: number;
  queueDepthPeak: number;
  bottleneckNodeId: string | null;
  availability: number;
  availabilityDowntime?: string;
  spofs: string[];
  redundancyScore: number;
  capacityCeiling: number;
  autoScalingHeadroom: number;
  recommendations: string[];
  timelineData: { time: number; rps: number; latency: number; errorRate: number }[];
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  nodeIds: string[];
}

export type BgVariant = "dots" | "lines" | "none";

interface AppState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  rightPanelOpen: boolean;
  simulationConfig: SimulationConfig;
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  validationIssues: ValidationIssue[];
  snapToGrid: boolean;
  bgVariant: BgVariant;
  criticalPath: string[];
  simHighlightsActive: boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;
  cloneNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  toggleRightPanel: () => void;
  setSimulationConfig: (config: Partial<SimulationConfig>) => void;
  setSimulationResult: (result: SimulationResult | null) => void;
  setIsSimulating: (v: boolean) => void;
  setValidationIssues: (issues: ValidationIssue[]) => void;
  toggleEdgeType: (edgeId: string) => void;
  clearCanvas: () => void;
  loadState: (nodes: Node[], edges: Edge[]) => void;
  setSnapToGrid: (v: boolean) => void;
  setBgVariant: (v: BgVariant) => void;
  setCriticalPath: (path: string[]) => void;
  setSimHighlightsActive: (v: boolean) => void;
  clearSimHighlights: () => void;
}

const savedBg = (localStorage.getItem("sds-bg") || "dots") as BgVariant;

const useStore = create<AppState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  rightPanelOpen: true,
  simulationConfig: {
    totalRequests: 100000,
    rps: 1000,
    readWriteMix: { read: 80, write: 20 },
    multiRegion: false,
    spikeEnabled: false,
  },
  simulationResult: null,
  isSimulating: false,
  validationIssues: [],
  snapToGrid: true,
  bgVariant: savedBg,
  criticalPath: [],
  simHighlightsActive: false,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: "default",
      animated: false,
      style: { stroke: "hsl(218, 11%, 37%)", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(218, 11%, 37%)" },
      data: { edgeType: "sync" },
    } as Edge;
    set({ edges: addEdge(newEdge, get().edges) });
  },
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  updateNodeData: (nodeId, data) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }),
  deleteNode: (nodeId) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    }),
  cloneNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newNode: Node = {
      ...node,
      id: `${node.data.componentId}-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
    };
    set({ nodes: [...get().nodes, newNode] });
  },
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  setSimulationConfig: (config) =>
    set({ simulationConfig: { ...get().simulationConfig, ...config } }),
  setSimulationResult: (result) => set({ simulationResult: result }),
  setIsSimulating: (v) => set({ isSimulating: v }),
  setValidationIssues: (issues) => set({ validationIssues: issues }),
  toggleEdgeType: (edgeId) => {
    set({
      edges: get().edges.map((e) => {
        if (e.id !== edgeId) return e;
        const isAsync = e.data?.edgeType === "async";
        const newType = isAsync ? "sync" : "async";
        return {
          ...e,
          animated: newType === "async",
          style: {
            ...e.style,
            strokeDasharray: newType === "async" ? "5 5" : undefined,
          },
          data: { ...e.data, edgeType: newType },
        };
      }),
    });
  },
  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null, simulationResult: null, criticalPath: [], simHighlightsActive: false }),
  loadState: (nodes, edges) => set({ nodes, edges, selectedNodeId: null, simulationResult: null, criticalPath: [], simHighlightsActive: false }),
  setSnapToGrid: (v) => set({ snapToGrid: v }),
  setBgVariant: (v) => {
    localStorage.setItem("sds-bg", v);
    set({ bgVariant: v });
  },
  setCriticalPath: (path) => set({ criticalPath: path }),
  setSimHighlightsActive: (v) => set({ simHighlightsActive: v }),
  clearSimHighlights: () => {
    const { edges } = get();
    // Reset edge styles
    const resetEdges = edges.map(e => ({
      ...e,
      style: {
        stroke: "hsl(218, 11%, 37%)",
        strokeWidth: 2,
        strokeDasharray: e.data?.edgeType === "async" ? "5 5" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(218, 11%, 37%)" },
    }));
    set({ simHighlightsActive: false, criticalPath: [], simulationResult: null, edges: resetEdges });
  },
}));

export default useStore;