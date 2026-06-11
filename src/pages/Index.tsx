import { useEffect } from "react";
import DesignCanvas from "../components/canvas/DesignCanvas";
import LeftSidebar from "../components/sidebar/LeftSidebar";
import RightPanel from "../components/panels/RightPanel";
import Navbar from "../components/navbar/Navbar";
import useStore from "../store/useStore";
import { runValidatedSimulation } from "../utils/simulationValidator";

export default function Index() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const rightPanelOpen = useStore((s) => s.rightPanelOpen);
  const setValidationIssues = useStore((s) => s.setValidationIssues);

  // Auto-validate on changes using the primary simulation validator (single source of truth)
  useEffect(() => {
    const { errors, warnings } = runValidatedSimulation(nodes, edges, {
      totalRequests: 100000, rps: 1000,
      readWriteMix: { read: 80, write: 20 },
      multiRegion: false, networkTopology: "same-az",
      preset: "none", diffMode: false,
    });
    const issues = [
      ...errors.map((e, i) => ({ id: `err-${i}`, severity: "error" as const, message: e.message, nodeIds: e.nodeIds })),
      ...warnings.map((w, i) => ({ id: `warn-${i}`, severity: "warning" as const, message: w.message, nodeIds: w.nodeIds })),
    ];
    setValidationIssues(issues);
  }, [nodes, edges, setValidationIssues]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[240px] flex-shrink-0">
          <LeftSidebar />
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <DesignCanvas />
        </div>

        {/* Right Panel */}
        {rightPanelOpen && (
          <div className="w-[300px] flex-shrink-0">
            <RightPanel />
          </div>
        )}
      </div>
    </div>
  );
}
