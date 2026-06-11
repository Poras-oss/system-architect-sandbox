import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import {
  Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges,
  NodeChange, EdgeChange, MarkerType,
} from "reactflow";

export interface SimulationConfig {
  totalRequests: number;
  rps: number;
  readWriteMix: { read: number; write: number };
  multiRegion: boolean;
  preset: "none" | "black-friday" | "db-failure" | "cold-start" | "region-outage" | "network-partition" | "cascade-failure";
  diffMode: boolean;
  networkTopology: "same-az" | "cross-az" | "cross-region";
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
  nodeBlastRadius: Record<string, number>;
  observabilityCoverage: number;
  diffDelta?: {
    costDiff: number;
    latencyDiff: number;
    availabilityDiff: number;
  };
  chaosImpact?: {
    failoverDurationSec: number;          // How long until recovery
    requestsDroppedDuringFailover: number; // Requests lost in the window
    dataLossRisk: "none" | "low" | "high"; // Based on replication mode
    transientErrorRate: number;           // Error rate during the event (0-100)
    description: string;                  // Human-readable summary
  };
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
  selectedEdgeId: string | null;
  rightPanelOpen: boolean;
  baselineState: { nodes: Node[]; edges: Edge[]; config: SimulationConfig } | null;
  simulationConfig: SimulationConfig;
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  validationIssues: ValidationIssue[];
  snapToGrid: boolean;
  bgVariant: BgVariant;
  criticalPath: string[];
  simHighlightsActive: boolean;
  theme: "light" | "dark";

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  updateEdgeData: (edgeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  cloneNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  toggleRightPanel: () => void;
  setSimulationConfig: (config: Partial<SimulationConfig>) => void;
  setBaseline: () => void;
  clearBaseline: () => void;
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
  toggleTheme: () => void;
}

const savedBg = (localStorage.getItem("sds-bg") || "dots") as BgVariant;
const initialTheme = (localStorage.getItem("sds-theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) as "light" | "dark";
if (initialTheme === "dark") document.documentElement.classList.add("dark");
else document.documentElement.classList.remove("dark");

const useStore = create<AppState>()(
  temporal(
    persist(
      (set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  rightPanelOpen: true,
  baselineState: null,
  simulationConfig: {
    totalRequests: 100000,
    rps: 1000,
    readWriteMix: { read: 80, write: 20 },
    multiRegion: false,
    preset: "none",
    diffMode: false,
    networkTopology: "same-az",
  },
  simulationResult: null,
  isSimulating: false,
  validationIssues: [],
  snapToGrid: true,
  bgVariant: savedBg,
  criticalPath: [],
  simHighlightsActive: false,
  theme: initialTheme,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: "protocolEdge",
      animated: false,
      style: { stroke: "hsl(218, 11%, 37%)", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(218, 11%, 37%)" },
      data: { edgeType: "sync", protocol: "HTTP" },
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
  updateEdgeData: (edgeId, data) =>
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
      ),
    }),
  deleteNode: (nodeId) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    }),
  deleteEdge: (edgeId) =>
    set({
      edges: get().edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: get().selectedEdgeId === edgeId ? null : get().selectedEdgeId,
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
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
  setSelectedEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  setSimulationConfig: (config) =>
    set({ simulationConfig: { ...get().simulationConfig, ...config } }),
  setBaseline: () => set({ baselineState: { nodes: get().nodes, edges: get().edges, config: get().simulationConfig } }),
  clearBaseline: () => set({ baselineState: null }),
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
  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null, simulationResult: null, criticalPath: [], simHighlightsActive: false }),
  loadState: (nodes, edges) => {
    // Map loaded edges to protocolEdge if they are "default"
    const mappedEdges = edges.map(e => ({ ...e, type: e.type === "default" ? "protocolEdge" : e.type }));
    set({ nodes, edges: mappedEdges, selectedNodeId: null, selectedEdgeId: null, simulationResult: null, criticalPath: [], simHighlightsActive: false });
  },
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
  toggleTheme: () => {
    const newTheme = get().theme === "light" ? "dark" : "light";
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("sds-theme", newTheme);
    set({ theme: newTheme });
  },
}),
      {
        name: "sds-store",
        partialize: (state) => ({ nodes: state.nodes, edges: state.edges, simulationConfig: state.simulationConfig }),
      }
    ),
    {
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges, simulationConfig: state.simulationConfig }),
    }
  )
);

export default useStore;