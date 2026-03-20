import { useEffect } from "react";
import DesignCanvas from "../components/canvas/DesignCanvas";
import LeftSidebar from "../components/sidebar/LeftSidebar";
import RightPanel from "../components/panels/RightPanel";
import Navbar from "../components/navbar/Navbar";
import useStore from "../store/useStore";
import { validateDesign } from "../utils/validation";

export default function Index() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const rightPanelOpen = useStore((s) => s.rightPanelOpen);
  const setValidationIssues = useStore((s) => s.setValidationIssues);

  // Auto-validate on changes
  useEffect(() => {
    const issues = validateDesign(nodes, edges);
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
