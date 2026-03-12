import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import { NodeTooltip } from "./NodeTooltip";
import type { GraphNode, GraphEdge } from "../../types";

const LOGO_TOKEN = "pk_WIjkoWXQRRuTLaos66jxRQ";

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedSectors: Set<string>;
  resetKey: number;
}

interface SimNode extends d3.SimulationNodeDatum, GraphNode {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  label: string;
  strength: number;
  direction: "positive" | "negative";
}

// Sector colors - vibrant but not overwhelming
const SECTOR_PALETTE: Record<string, string> = {
  Technology: "#8b5cf6",
  Finance: "#3b82f6",
  Energy: "#f59e0b",
  Healthcare: "#10b981",
  "Consumer Discretionary": "#ec4899",
  "Consumer Staples": "#14b8a6",
  Industrials: "#6366f1",
  Materials: "#a855f7",
  Utilities: "#06b6d4",
  "Real Estate": "#f43f5e",
  Communication: "#0ea5e9",
  Defense: "#64748b",
};

const TYPE_COLORS: Record<string, string> = {
  sector: "#3b82f6",
  event: "#f59e0b",
  stock: "#94a3b8",
  news: "#8b5cf6",
};

const SIGNAL_COLORS: Record<string, string> = {
  bullish: "#22c55e",
  bearish: "#ef4444",
  neutral: "#64748b",
};

function getSectorColor(label: string): string {
  for (const [key, color] of Object.entries(SECTOR_PALETTE)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#3b82f6";
}

function logoUrl(domain: string): string {
  return `https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=64&format=png`;
}

function getInitials(label: string): string {
  return label
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

// Size config by type
const NODE_SIZE = {
  sector: { w: 140, h: 48, r: 12 },
  event: { w: 130, h: 42, r: 10 },
  news: { w: 130, h: 42, r: 10 },
  stock: { w: 120, h: 54, r: 12 },
};

export function ForceGraph({
  nodes,
  edges,
  selectedSectors,
  resetKey,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
    data: {
      label: string;
      type: string;
      signal?: string;
      impactScore?: number;
      domain?: string;
      market?: string;
    } | null;
  }>({ x: 0, y: 0, visible: false, data: null });

  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  const buildGraph = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current?.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = 650;

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Filter by sector
    const sectorFilter = selectedSectors.size > 0;
    const filteredNodes: SimNode[] = nodes
      .filter((n) => {
        if (!sectorFilter) return true;
        if (n.type === "sector") return selectedSectors.has(n.label);
        return true;
      })
      .map((n) => ({ ...n }));

    const visibleIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges: SimEdge[] = edges
      .filter(
        (e) => visibleIds.has(e.source as string) && visibleIds.has(e.target as string),
      )
      .map((e) => ({ ...e }));

    // Layers
    const g = svg.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Defs
    const defs = svg.append("defs");

    // Glow filter for high-impact
    const glowFilter = defs.append("filter").attr("id", "node-glow");
    glowFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "blur");
    const merge = glowFilter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // Shadow filter
    const shadowFilter = defs.append("filter").attr("id", "card-shadow");
    shadowFilter
      .append("feDropShadow")
      .attr("dx", "0")
      .attr("dy", "2")
      .attr("stdDeviation", "4")
      .attr("flood-color", "#000000")
      .attr("flood-opacity", "0.4");

    // Edge end dot markers (subtle, no triangles)
    ["positive", "negative"].forEach((dir) => {
      defs
        .append("marker")
        .attr("id", `dot-${dir}`)
        .attr("viewBox", "0 0 6 6")
        .attr("refX", 3)
        .attr("refY", 3)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .append("circle")
        .attr("cx", 3)
        .attr("cy", 3)
        .attr("r", 3)
        .attr("fill", dir === "positive" ? "#22c55e" : "#ef4444")
        .attr("opacity", 0.5);
    });

    // Clip paths for logos
    filteredNodes.forEach((n) => {
      if (n.type === "stock" && n.domain) {
        defs
          .append("clipPath")
          .attr("id", `clip-${n.id.replace(/[^a-zA-Z0-9]/g, "_")}`)
          .append("circle")
          .attr("r", 18)
          .attr("cx", 0)
          .attr("cy", 0);
      }
    });

    // Hierarchical Y forces: events top, sectors middle, stocks bottom
    const yBands: Record<string, number> = {
      event: height * 0.15,
      news: height * 0.15,
      sector: height * 0.45,
      stock: height * 0.75,
    };

    // Simulation
    const simulation = d3
      .forceSimulation<SimNode>(filteredNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(filteredEdges)
          .id((d) => d.id)
          .distance(140)
          .strength((d) => d.strength * 0.08),
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force(
        "y",
        d3.forceY<SimNode>((d) => yBands[d.type] || height / 2).strength(0.3),
      )
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => {
          const sz = NODE_SIZE[d.type] || NODE_SIZE.stock;
          return Math.max(sz.w, sz.h) / 2 + 15;
        }),
      );

    // Band labels
    const bands = [
      { label: "EVENTS & NEWS", y: 30, color: "#f59e0b" },
      { label: "SECTORS", y: height * 0.32, color: "#3b82f6" },
      { label: "STOCKS", y: height * 0.6, color: "#94a3b8" },
    ];
    bands.forEach((b) => {
      g.append("text")
        .text(b.label)
        .attr("x", 16)
        .attr("y", b.y)
        .attr("fill", b.color)
        .attr("font-size", "9px")
        .attr("font-weight", "700")
        .attr("letter-spacing", "0.15em")
        .attr("opacity", 0.3)
        .style("pointer-events", "none");
    });

    // --- EDGES ---
    const linkGroup = g.append("g");
    const link = linkGroup
      .selectAll<SVGPathElement, SimEdge>("path")
      .data(filteredEdges)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d) =>
        d.direction === "positive" ? "#22c55e" : "#ef4444",
      )
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", (d) => Math.max(1, d.strength * 0.5))
      .attr("marker-end", (d) => `url(#dot-${d.direction})`)
      .style("stroke-dasharray", (d) =>
        d.strength < 4 ? "4 4" : "none",
      );

    // Edge labels (on hover — hidden by default)
    const edgeLabelGroup = g.append("g").attr("class", "edge-labels");

    // --- NODES ---
    const nodeGroup = g.append("g");
    const node = nodeGroup
      .selectAll<SVGGElement, SimNode>("g")
      .data(filteredNodes)
      .join("g")
      .style("cursor", "pointer");

    // Render each node based on type
    node.each(function (d) {
      const el = d3.select(this);
      const sz = NODE_SIZE[d.type] || NODE_SIZE.stock;

      if (d.type === "sector") {
        const sectorColor = getSectorColor(d.label);

        // Rounded rect card
        el.append("rect")
          .attr("x", -sz.w / 2)
          .attr("y", -sz.h / 2)
          .attr("width", sz.w)
          .attr("height", sz.h)
          .attr("rx", sz.r)
          .attr("fill", "#1a1d27")
          .attr("stroke", sectorColor)
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.6)
          .style("filter", "url(#card-shadow)");

        // Color accent bar on left
        el.append("rect")
          .attr("x", -sz.w / 2)
          .attr("y", -sz.h / 2)
          .attr("width", 4)
          .attr("height", sz.h)
          .attr("rx", 2)
          .attr("fill", sectorColor);

        // Label
        el.append("text")
          .text(d.label)
          .attr("x", 0)
          .attr("y", 1)
          .attr("text-anchor", "middle")
          .attr("fill", "#f1f5f9")
          .attr("font-size", "11px")
          .attr("font-weight", "600")
          .style("pointer-events", "none");
      } else if (d.type === "event" || d.type === "news") {
        const color = TYPE_COLORS[d.type];

        // Rounded rect
        el.append("rect")
          .attr("x", -sz.w / 2)
          .attr("y", -sz.h / 2)
          .attr("width", sz.w)
          .attr("height", sz.h)
          .attr("rx", sz.r)
          .attr("fill", color + "12")
          .attr("stroke", color)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.5)
          .attr("stroke-dasharray", d.type === "news" ? "4 2" : "none");

        // Icon dot
        el.append("circle")
          .attr("cx", -sz.w / 2 + 14)
          .attr("cy", 0)
          .attr("r", 3)
          .attr("fill", color)
          .attr("opacity", 0.8);

        // Label
        const truncatedLabel =
          d.label.length > 18 ? d.label.slice(0, 18) + "..." : d.label;
        el.append("text")
          .text(truncatedLabel)
          .attr("x", -sz.w / 2 + 24)
          .attr("y", 1)
          .attr("dy", "0.35em")
          .attr("fill", "#f1f5f9")
          .attr("font-size", "10px")
          .attr("font-weight", "500")
          .style("pointer-events", "none");
      } else {
        // Stock node — card with logo
        const signalColor =
          SIGNAL_COLORS[d.signal || "neutral"] || SIGNAL_COLORS.neutral;

        // Card bg
        el.append("rect")
          .attr("x", -sz.w / 2)
          .attr("y", -sz.h / 2)
          .attr("width", sz.w)
          .attr("height", sz.h)
          .attr("rx", sz.r)
          .attr("fill", "#1a1d27")
          .attr("stroke", signalColor)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.5)
          .style("filter", "url(#card-shadow)");

        // Logo or initials
        if (d.domain) {
          const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
          const logoGroup = el.append("g").attr("transform", `translate(${-sz.w / 2 + 22}, 0)`);

          // Circle bg
          logoGroup
            .append("circle")
            .attr("r", 18)
            .attr("fill", "#242836")
            .attr("stroke", signalColor)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.3);

          // Logo image with fallback
          logoGroup
            .append("image")
            .attr("href", logoUrl(d.domain))
            .attr("x", -14)
            .attr("y", -14)
            .attr("width", 28)
            .attr("height", 28)
            .attr("clip-path", `url(#${clipId})`)
            .attr("preserveAspectRatio", "xMidYMid slice")
            .on("error", function () {
              // Fallback to initials
              d3.select(this).remove();
              logoGroup
                .append("text")
                .text(getInitials(d.label))
                .attr("text-anchor", "middle")
                .attr("dy", "0.35em")
                .attr("fill", signalColor)
                .attr("font-size", "11px")
                .attr("font-weight", "700");
            });
        } else {
          // No domain — show initials circle
          const initGroup = el.append("g").attr("transform", `translate(${-sz.w / 2 + 22}, 0)`);
          initGroup
            .append("circle")
            .attr("r", 18)
            .attr("fill", signalColor + "20")
            .attr("stroke", signalColor)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.4);
          initGroup
            .append("text")
            .text(getInitials(d.label))
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", signalColor)
            .attr("font-size", "11px")
            .attr("font-weight", "700");
        }

        // Ticker label
        const tickerLabel =
          d.label.length > 10 ? d.label.slice(0, 10) + ".." : d.label;
        el.append("text")
          .text(tickerLabel)
          .attr("x", -sz.w / 2 + 48)
          .attr("y", -6)
          .attr("fill", "#f1f5f9")
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .style("pointer-events", "none");

        // Signal + market badge
        const badgeText = [
          d.signal ? d.signal.charAt(0).toUpperCase() + d.signal.slice(1) : "",
          d.market || "",
        ]
          .filter(Boolean)
          .join(" · ");

        if (badgeText) {
          el.append("text")
            .text(badgeText)
            .attr("x", -sz.w / 2 + 48)
            .attr("y", 10)
            .attr("fill", signalColor)
            .attr("font-size", "8px")
            .attr("font-weight", "500")
            .attr("opacity", 0.8)
            .style("pointer-events", "none");
        }

        // Signal arrow (↑/↓) at right side of card
        const arrowChar = d.signal === "bullish" ? "▲" : d.signal === "bearish" ? "▼" : "●";
        el.append("text")
          .text(arrowChar)
          .attr("x", sz.w / 2 - 14)
          .attr("y", -6)
          .attr("text-anchor", "middle")
          .attr("fill", signalColor)
          .attr("font-size", "12px")
          .style("pointer-events", "none");

        // Impact score below arrow
        if (d.impactScore) {
          el.append("text")
            .text(d.impactScore.toString())
            .attr("x", sz.w / 2 - 14)
            .attr("y", 10)
            .attr("text-anchor", "middle")
            .attr("fill", signalColor)
            .attr("font-size", "9px")
            .attr("font-weight", "600")
            .attr("opacity", 0.7)
            .style("pointer-events", "none");
        }
      }
    });

    // Drag
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(drag);

    // Click to highlight connections
    node.on("click", (_event, d) => {
      setHighlightedNode((prev) => (prev === d.id ? null : d.id));
    });

    // Hover
    node
      .on("mouseenter", (event, d) => {
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          visible: true,
          data: {
            label: d.label,
            type: d.type,
            signal: d.signal,
            impactScore: d.impactScore,
            domain: d.domain,
            market: d.market,
          },
        });
        // Dim non-connected nodes
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        filteredEdges.forEach((e) => {
          const src =
            typeof e.source === "object" ? (e.source as SimNode).id : e.source;
          const tgt =
            typeof e.target === "object" ? (e.target as SimNode).id : e.target;
          if (src === d.id) connectedIds.add(tgt);
          if (tgt === d.id) connectedIds.add(src);
        });
        node.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.15));
        link.attr("stroke-opacity", (e) => {
          const src =
            typeof e.source === "object" ? (e.source as SimNode).id : e.source;
          const tgt =
            typeof e.target === "object" ? (e.target as SimNode).id : e.target;
          return src === d.id || tgt === d.id ? 0.6 : 0.03;
        });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => ({ ...prev, x: event.clientX, y: event.clientY }));
      })
      .on("mouseleave", () => {
        setTooltip((prev) => ({ ...prev, visible: false }));
        node.attr("opacity", 1);
        link.attr("stroke-opacity", 0.2);
      });

    // Tick — use curved paths for edges
    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const sx = (d.source as SimNode).x!;
        const sy = (d.source as SimNode).y!;
        const tx = (d.target as SimNode).x!;
        const ty = (d.target as SimNode).y!;
        const dx = tx - sx;
        const dy = ty - sy;
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.8;
        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
      });

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, selectedSectors]);

  useEffect(() => {
    const cleanup = buildGraph();
    return cleanup;
  }, [buildGraph, resetKey]);

  useEffect(() => {
    const handleResize = () => buildGraph();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [buildGraph]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="w-full rounded-lg"
        style={{ minHeight: 650, background: "#0d0f14" }}
      />
      <NodeTooltip {...tooltip} />
    </div>
  );
}
