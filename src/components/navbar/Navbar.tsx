import { useState, useCallback, useRef, useEffect } from "react";
import useStore from "../../store/useStore";
import { validateDesign } from "../../utils/validation";
import { templates } from "../../data/templates";
import {
  Trash2, Download, Upload, FileJson, LayoutTemplate, PanelRightClose, PanelRightOpen,
  Grid3X3, AlertTriangle, AlertCircle, Info, X, Sun, Moon,
} from "lucide-react";
import { toPng } from "html-to-image";

export default function Navbar() {
  const {
    nodes, edges, clearCanvas, loadState, toggleRightPanel, rightPanelOpen,
    snapToGrid, setSnapToGrid, validationIssues, setValidationIssues,
  } = useStore();

  const [showTemplates, setShowTemplates] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const issues = validationIssues;

  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    const newDark = !html.classList.contains("dark");
    if (newDark) {
      html.classList.add("dark");
      localStorage.setItem("sds-theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("sds-theme", "light");
    }
    setIsDark(newDark);
  }, []);

  const handleShowIssues = () => {
    const newIssues = validateDesign(nodes, edges);
    setValidationIssues(newIssues);
    setShowIssues(!showIssues);
  };

  const handleExportPng = useCallback(async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    try {
      const bgColor = document.documentElement.classList.contains("dark") ? "#0c0c0e" : "#f4f4f5";
      const dataUrl = await toPng(el, { backgroundColor: bgColor });
      const link = document.createElement("a");
      link.download = "system-design.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, []);

  const handleSaveJson = useCallback(() => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.download = "system-design.json";
    link.href = URL.createObjectURL(blob);
    link.click();
  }, [nodes, edges]);

  const handleLoadJson = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.nodes && data.edges) loadState(data.nodes, data.edges);
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [loadState]);

  const handleLoadTemplate = (idx: number) => {
    const tpl = templates[idx];
    loadState(tpl.nodes, tpl.edges);
    setShowTemplates(false);
  };

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <>
      <div className="h-11 flex items-center justify-between px-3 bg-surface-1 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
            <Grid3X3 size={11} className="text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">System Design Sandbox</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors" title={isDark ? "Switch to light" : "Switch to dark"}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            <LayoutTemplate size={13} /> Templates
          </button>

          <button onClick={() => setSnapToGrid(!snapToGrid)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors ${snapToGrid ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"}`}>
            <Grid3X3 size={13} /> Snap
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          <NavBtn icon={Trash2} label="Clear" onClick={clearCanvas} />
          <NavBtn icon={Download} label="Export PNG" onClick={handleExportPng} />
          <NavBtn icon={FileJson} label="Save JSON" onClick={handleSaveJson} />
          <NavBtn icon={Upload} label="Load JSON" onClick={() => fileInputRef.current?.click()} />
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadJson} />

          <div className="w-px h-5 bg-border mx-1" />

          <button onClick={toggleRightPanel} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            {rightPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
      </div>

      {/* Bottom validation bar */}
      <div className="fixed bottom-0 left-[240px] right-0 z-30 h-7 bg-surface-1 border-t border-border flex items-center px-3 gap-3">
        <button onClick={handleShowIssues} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          {errorCount > 0 && <span className="flex items-center gap-1 text-destructive"><AlertCircle size={11} /> {errorCount}</span>}
          {warnCount > 0 && <span className="flex items-center gap-1 text-cat-data"><AlertTriangle size={11} /> {warnCount}</span>}
          {errorCount === 0 && warnCount === 0 && <span className="flex items-center gap-1"><Info size={11} /> No issues</span>}
          <span>Issues</span>
        </button>
        <div className="ml-auto text-[10px] text-muted-foreground">
          {nodes.length} components · {edges.length} connections
        </div>
      </div>

      {/* Issues panel */}
      {showIssues && issues.length > 0 && (
        <div className="fixed bottom-7 left-[240px] right-0 z-30 max-h-48 bg-surface-2 border-t border-border overflow-y-auto">
          <div className="px-3 py-2 flex items-center justify-between border-b border-border">
            <span className="text-xs font-semibold text-foreground">Design Issues</span>
            <button onClick={() => setShowIssues(false)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
          </div>
          {issues.map((issue) => (
            <div key={issue.id} className="px-3 py-1.5 flex items-start gap-2 text-[11px] border-b border-border/50">
              {issue.severity === "error" ? <AlertCircle size={12} className="text-destructive flex-shrink-0 mt-0.5" />
                : issue.severity === "warning" ? <AlertTriangle size={12} className="text-cat-data flex-shrink-0 mt-0.5" />
                : <Info size={12} className="text-cat-observability flex-shrink-0 mt-0.5" />}
              <span className="text-muted-foreground">{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowTemplates(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-2 border border-border rounded-lg p-5 w-[520px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Architecture Templates</h3>
              <button onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((tpl, idx) => (
                <button key={idx} onClick={() => handleLoadTemplate(idx)} className="text-left p-3 rounded-lg bg-surface-1 border border-border hover:border-primary/50 hover:bg-surface-2 transition-all active:scale-[0.98]">
                  <div className="text-xs font-medium text-foreground mb-1">{tpl.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">{tpl.description}</div>
                  {tpl.nodes.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1.5">{tpl.nodes.length} components · {tpl.edges.length} connections</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors active:scale-[0.97]">
      <Icon size={13} /> {label}
    </button>
  );
}