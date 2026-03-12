import { useState, useEffect } from "react";
import { Network, GitBranch, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "../ui/Button";
import { ForceGraph } from "../graph/ForceGraph";
import { CauseChainGraph } from "../graph/CauseChainGraph";
import { CauseChainDetailPanel } from "../graph/CauseChainDetailPanel";
import { GraphControls } from "../graph/GraphControls";
import type { GraphNode, GraphEdge, CauseChainAnalysis, CauseChainNode, MarketRegion } from "../../types";

interface GraphReportProps {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  causechain: CauseChainAnalysis | null;
  defaultMode?: "graph" | "causechain";
  markets?: MarketRegion[];
}

export function GraphReport({
  graph,
  causechain,
  defaultMode = "graph",
  markets,
}: GraphReportProps) {
  const [mode, setMode] = useState<"graph" | "causechain">(defaultMode);
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(
    new Set(),
  );
  const [resetKey, setResetKey] = useState(0);
  const [selectedCauseChainNode, setSelectedCauseChainNode] =
    useState<CauseChainNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFullscreen(false);
        setResetKey((k) => k + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Extract unique sectors from graph nodes
  const sectors =
    graph?.nodes
      .filter((n) => n.type === "sector")
      .map((n) => n.label) ?? [];

  function handleSectorToggle(sector: string) {
    setSelectedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  }

  function handleResetZoom() {
    setResetKey((k) => k + 1);
  }

  function handleNodeSelect(node: CauseChainNode) {
    setSelectedCauseChainNode((prev) =>
      prev?.id === node.id ? null : node,
    );
  }

  function handleCloseDetail() {
    setSelectedCauseChainNode(null);
  }

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
    setResetKey((k) => k + 1);
  }

  const noData =
    (mode === "graph" && !graph) ||
    (mode === "causechain" && !causechain);

  const modeToggles = (
    <>
      <Button
        variant={mode === "graph" ? "primary" : "secondary"}
        size="sm"
        icon={<Network className="w-4 h-4" />}
        onClick={() => {
          setMode("graph");
          setSelectedCauseChainNode(null);
        }}
      >
        Impact Graph
      </Button>
      <Button
        variant={mode === "causechain" ? "primary" : "secondary"}
        size="sm"
        icon={<GitBranch className="w-4 h-4" />}
        onClick={() => setMode("causechain")}
      >
        Cause Chain
      </Button>
    </>
  );

  const graphContent = noData ? (
    <div className="text-center py-12 text-text-muted text-sm">
      No data available for this visualization yet.
    </div>
  ) : (
    <>
      {mode === "graph" && (
        <GraphControls
          sectors={sectors}
          selectedSectors={selectedSectors}
          onToggleSector={handleSectorToggle}
          onResetZoom={handleResetZoom}
        />
      )}

      <div
        className={
          isFullscreen
            ? "overflow-hidden flex flex-1"
            : "rounded-xl border border-border bg-surface-raised overflow-hidden flex"
        }
      >
        <div className="flex-1 overflow-auto">
          {mode === "graph" && graph && (
            <ForceGraph
              nodes={graph.nodes}
              edges={graph.edges}
              selectedSectors={selectedSectors}
              resetKey={resetKey}
            />
          )}
          {mode === "causechain" && causechain && (
            <CauseChainGraph
              data={causechain}
              resetKey={resetKey}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedCauseChainNode?.id}
            />
          )}
        </div>

        {/* Detail panel for cause chain */}
        {mode === "causechain" && (
          <CauseChainDetailPanel
            node={selectedCauseChainNode}
            onClose={handleCloseDetail}
          />
        )}
      </div>
    </>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0d0f14] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {modeToggles}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">Press ESC to exit</span>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {graphContent}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Mode toggle + fullscreen button */}
      <div className="flex items-center gap-2 mb-4">
        {modeToggles}
        <button
          onClick={toggleFullscreen}
          className="ml-auto p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
          title="Toggle fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {graphContent}
    </div>
  );
}
