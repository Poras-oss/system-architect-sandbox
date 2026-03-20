import { useState, DragEvent } from "react";
import {
  categories,
  componentDefinitions,
  getComponentsByCategory,
  categoryColorMap,
  categoryBgMap,
  CategoryId,
} from "../../data/nodeTypes";
import useStore from "../../store/useStore";
import NodePropertiesPanel from "./NodePropertiesPanel";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";

export default function LeftSidebar() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["client", "network", "compute", "data"]));

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const onDragStart = (e: DragEvent, componentId: string) => {
    e.dataTransfer.setData("application/system-component", componentId);
    e.dataTransfer.effectAllowed = "move";
  };

  if (selectedNodeId) {
    return <NodePropertiesPanel />;
  }

  // Also add sticky note at the end
  const stickyNote = componentDefinitions.find(c => c.id === "sticky-note")!;

  return (
    <div className="h-full flex flex-col bg-surface-1 border-r border-border">
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Components</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {categories.map((cat) => {
          const components = getComponentsByCategory(cat.id);
          const isExpanded = expandedCats.has(cat.id);
          const color = categoryColorMap[cat.id];

          return (
            <div key={cat.id}>
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium hover:bg-surface-2 transition-colors"
                style={{ color }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {cat.label}
                <span className="ml-auto text-muted-foreground text-[10px]">{components.length}</span>
              </button>

              {isExpanded && (
                <div className="ml-2 mt-0.5 space-y-0.5">
                  {components.map((comp) => {
                    const Icon = comp.icon;
                    return (
                      <div
                        key={comp.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, comp.id)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-surface-2 transition-colors group"
                      >
                        <GripVertical size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: categoryBgMap[cat.id] }}
                        >
                          <Icon size={11} style={{ color }} />
                        </div>
                        <span className="text-xs text-foreground truncate">{comp.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Sticky note */}
        <div className="pt-2 border-t border-border mt-2">
          <div
            draggable
            onDragStart={(e) => onDragStart(e, "sticky-note")}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-surface-2 transition-colors group"
          >
            <GripVertical size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            <stickyNote.icon size={13} className="text-cat-data" />
            <span className="text-xs text-foreground">Sticky Note</span>
          </div>
        </div>
      </div>
    </div>
  );
}
