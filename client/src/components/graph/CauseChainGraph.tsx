import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import { NodeTooltip } from "./NodeTooltip";
import type { CauseChainAnalysis, CauseChainNode, CauseChainLink } from "../../types";

interface CauseChainGraphProps {
  data: CauseChainAnalysis;
  resetKey: number;
  onNodeSelect?: (node: CauseChainNode) => void;
  selectedNodeId?: string;
}

const TYPE_COLORS: Record<string, string> = {
  news_source: "#8b5cf6",
  cause: "#f59e0b",
  effect: "#3b82f6",
  stock_impact: "#22c55e",
};

const TYPE_LABELS: Record<string, string> = {
  news_source: "Source",
  cause: "Cause",
  effect: "Effect",
  stock_impact: "Impact",
};

const COLUMN_X: Record<string, number> = {
  news_source: 0,
  cause: 1,
  effect: 2,
  stock_impact: 3,
};

interface LayoutNode extends CauseChainNode {
  x: number;
  y: number;
  chainIndex: number;
}

export function CauseChainGraph({
  data,
  resetKey,
  onNodeSelect,
  selectedNodeId,
}: CauseChainGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
    data: { label: string; type: string; description?: string; impactScore?: number } | null;
  }>({ x: 0, y: 0, visible: false, data: null });

  const buildGraph = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current?.parentElement;
    if (!container) return;

    const chains = data.chains || [];
    if (chains.length === 0) return;

    // Layout parameters
    const colWidth = 250;
    const nodeHeight = 50;
    const nodeWidth = 180;
    const chainGap = 30;
    const paddingX = 80;
    const paddingY = 60;

    // Compute layout nodes
    const layoutNodes: LayoutNode[] = [];
    const nodeMap = new Map<string, LayoutNode>();

    // Group nodes by column per chain
    let currentY = paddingY;

    chains.forEach((chain, ci) => {
      const columns: Map<number, CauseChainNode[]> = new Map();

      chain.nodes.forEach((n) => {
        const col = COLUMN_X[n.type] ?? 1;
        if (!columns.has(col)) columns.set(col, []);
        columns.get(col)!.push(n);
      });

      let maxRowsInChain = 0;
      columns.forEach((nodes) => {
        maxRowsInChain = Math.max(maxRowsInChain, nodes.length);
      });

      columns.forEach((nodes, col) => {
        const colX = paddingX + col * colWidth;
        nodes.forEach((n, ri) => {
          const rowOffset =
            (maxRowsInChain - nodes.length) * (nodeHeight + 10) * 0.5;
          const y = currentY + ri * (nodeHeight + 10) + rowOffset;
          const ln: LayoutNode = { ...n, x: colX, y, chainIndex: ci };
          layoutNodes.push(ln);
          nodeMap.set(n.id, ln);
        });
      });

      currentY += maxRowsInChain * (nodeHeight + 10) + chainGap;
    });

    const width = Math.max(paddingX * 2 + colWidth * 4, container.clientWidth);
    const height = Math.max(currentY + paddingY, 400);

    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    // Zoom
    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Defs for gradients and glow
    const defs = svg.append("defs");

    // Glow filter
    const filter = defs.append("filter").attr("id", "glow");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Chain background groups
    chains.forEach((chain, ci) => {
      const chainNodes = layoutNodes.filter((n) => n.chainIndex === ci);
      if (chainNodes.length === 0) return;

      const minY = Math.min(...chainNodes.map((n) => n.y)) - 15;
      const maxY = Math.max(...chainNodes.map((n) => n.y)) + nodeHeight + 15;

      g.append("rect")
        .attr("x", paddingX - 30)
        .attr("y", minY)
        .attr("width", width - paddingX * 2 + 60)
        .attr("height", maxY - minY)
        .attr("rx", 12)
        .attr("fill", ci % 2 === 0 ? "#1a1d27" : "#161923")
        .attr("stroke", "#2d3148")
        .attr("stroke-opacity", 0.3);

      // Chain source label
      g.append("text")
        .text(chain.newsSource)
        .attr("x", paddingX - 20)
        .attr("y", minY - 4)
        .attr("fill", "#8b5cf6")
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .attr("opacity", 0.8);
    });

    // Column headers
    Object.entries(COLUMN_X).forEach(([type, col]) => {
      const x = paddingX + col * colWidth + nodeWidth / 2;
      g.append("text")
        .text(TYPE_LABELS[type])
        .attr("x", x)
        .attr("y", paddingY - 30)
        .attr("text-anchor", "middle")
        .attr("fill", TYPE_COLORS[type])
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("text-transform", "uppercase")
        .attr("letter-spacing", "0.1em")
        .attr("opacity", 0.7);
    });

    // Draw links with curved bezier paths
    const allLinks: (CauseChainLink & { chainIndex: number })[] = [];
    chains.forEach((chain, ci) => {
      chain.links.forEach((link) => {
        allLinks.push({ ...link, chainIndex: ci });
      });
    });

    allLinks.forEach((link) => {
      const src = nodeMap.get(link.source);
      const tgt = nodeMap.get(link.target);
      if (!src || !tgt) return;

      const x1 = src.x + nodeWidth;
      const y1 = src.y + nodeHeight / 2;
      const x2 = tgt.x;
      const y2 = tgt.y + nodeHeight / 2;

      const midX = (x1 + x2) / 2;
      const isPositive = link.direction === "positive";
      const color = isPositive ? "#22c55e" : "#ef4444";
      const thickness = Math.max(1.5, link.impactScore * 0.4);
      const highImpact = link.impactScore >= 7;

      // Gradient per link
      const gradId = `grad-${link.source}-${link.target}`.replace(/[^a-zA-Z0-9-]/g, "_");
      const grad = defs
        .append("linearGradient")
        .attr("id", gradId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.2);
      grad.append("stop").attr("offset", "50%").attr("stop-color", color).attr("stop-opacity", 0.6);
      grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.2);

      // Path
      g.append("path")
        .attr("d", `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`)
        .attr("fill", "none")
        .attr("stroke", `url(#${gradId})`)
        .attr("stroke-width", thickness)
        .style("filter", highImpact ? "url(#glow)" : "none");

      // Impact score badge on link midpoint
      const badgeX = midX;
      const badgeY = (y1 + y2) / 2;

      const badgeG = g.append("g").attr("transform", `translate(${badgeX},${badgeY})`);

      badgeG
        .append("rect")
        .attr("x", -14)
        .attr("y", -10)
        .attr("width", 28)
        .attr("height", 20)
        .attr("rx", 10)
        .attr("fill", "#0f1117")
        .attr("stroke", color)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5);

      badgeG
        .append("text")
        .text(link.impactScore.toString())
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", color)
        .attr("font-size", "9px")
        .attr("font-weight", "700");
    });

    // Draw nodes
    const nodeG = g
      .selectAll<SVGGElement, LayoutNode>("g.chain-node")
      .data(layoutNodes)
      .join("g")
      .attr("class", "chain-node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Node rectangle
    nodeG
      .append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("rx", 8)
      .attr("fill", (d) => {
        const c = TYPE_COLORS[d.type];
        return c + "15"; // low opacity hex
      })
      .attr("stroke", (d) => TYPE_COLORS[d.type])
      .attr("stroke-width", (d) => (d.id === selectedNodeId ? 2.5 : 1.5))
      .attr("stroke-opacity", (d) => (d.id === selectedNodeId ? 1 : 0.4));

    // Node icon indicator (small colored dot)
    nodeG
      .append("circle")
      .attr("cx", 14)
      .attr("cy", nodeHeight / 2)
      .attr("r", 4)
      .attr("fill", (d) => TYPE_COLORS[d.type])
      .attr("opacity", 0.8);

    // Node label
    nodeG
      .append("text")
      .text((d) => (d.label.length > 20 ? d.label.slice(0, 20) + "..." : d.label))
      .attr("x", 26)
      .attr("y", nodeHeight / 2 - 4)
      .attr("dy", "0.35em")
      .attr("fill", "#f1f5f9")
      .attr("font-size", "11px")
      .attr("font-weight", "500");

    // Link icon overlay for news_source nodes with referenceUrl
    nodeG
      .filter((d) => d.type === "news_source" && Boolean(d.referenceUrl))
      .append("text")
      .text("\u{1F517}") // link emoji
      .attr("x", nodeWidth - 16)
      .attr("y", 14)
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("opacity", 0.6);

    // Hover and click interactions
    nodeG
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          visible: true,
          data: {
            label: d.label,
            type: d.type,
            description: d.description,
          },
        });
        // Highlight node
        d3.select(event.currentTarget)
          .select("rect")
          .attr("stroke-opacity", 1)
          .attr("stroke-width", 2.5);
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => ({ ...prev, x: event.clientX, y: event.clientY }));
      })
      .on("mouseleave", (event, d) => {
        setTooltip((prev) => ({ ...prev, visible: false }));
        const isSelected = d.id === selectedNodeId;
        d3.select(event.currentTarget)
          .select("rect")
          .attr("stroke-opacity", isSelected ? 1 : 0.4)
          .attr("stroke-width", isSelected ? 2.5 : 1.5);
      })
      .on("click", (_event, d) => {
        if (onNodeSelect) {
          onNodeSelect(d);
        }
      });
  }, [data, selectedNodeId, onNodeSelect]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph, resetKey]);

  useEffect(() => {
    const handleResize = () => buildGraph();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [buildGraph]);

  return (
    <div className="relative overflow-auto">
      <svg ref={svgRef} className="w-full" style={{ minHeight: 400 }} />
      <NodeTooltip {...tooltip} />
    </div>
  );
}
