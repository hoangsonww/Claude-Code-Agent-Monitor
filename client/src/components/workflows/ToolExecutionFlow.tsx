/**
 * @file ToolExecutionFlow.tsx
 * @description Defines the ToolExecutionFlow component that visualizes the flow of tool usage in agent workflows using a Sankey diagram. It processes the provided tool flow data, constructs a Sankey graph, and renders it using D3.js. The component also includes interactive tooltips for links and a legend for tool types. It handles responsiveness and edge cases such as empty data gracefully.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { SankeyGraph, SankeyNode, SankeyLink } from "d3-sankey";
import type { ToolFlowData } from "../../lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 140, bottom: 24, left: 140 };
const NODE_WIDTH = 14;
const NODE_PADDING = 18;
const MIN_NODE_HEIGHT = 6;
const LINK_OPACITY_DEFAULT = 0.15;
const LINK_OPACITY_HOVER = 0.45;

const TOOL_COLORS: Record<string, string> = {
  Read: "#3b82f6",
  Write: "#22c55e",
  Edit: "#eab308",
  Bash: "#ef4444",
  Grep: "#a855f7",
  Glob: "#ec4899",
  Agent: "#6366f1",
};
const COLOR_DEFAULT = "#64748b";

function toolColor(name: string): string {
  // Strip the _source / _target suffix we add internally
  const base = name.replace(/_(source|target)$/, "");
  return TOOL_COLORS[base] ?? COLOR_DEFAULT;
}

function toolLabel(name: string): string {
  return name.replace(/_(source|target)$/, "");
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodeExtra {
  id: string;
}

interface LinkExtra {
  uid: string;
}

type SNode = SankeyNode<NodeExtra, LinkExtra>;
type SLink = SankeyLink<NodeExtra, LinkExtra>;
type SGraph = SankeyGraph<NodeExtra, LinkExtra>;

interface TooltipState {
  x: number;
  y: number;
  content: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ToolExecutionFlowProps {
  data: ToolFlowData;
  filterAgentType?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * d3-sankey collapses self-loops and duplicate node references. To represent a
 * tool appearing as both source and target we suffix the node id with
 * `_source` or `_target` and deduplicate at the label layer.
 *
 * Strategy:
 * - A node that ONLY appears as a source keeps its plain name.
 * - A node that ONLY appears as a target keeps its plain name.
 * - A node that appears on BOTH sides gets `_source` / `_target` copies.
 */
function buildSankeyInput(data: ToolFlowData): {
  nodes: NodeExtra[];
  links: Array<{ source: string; target: string; value: number; uid: string }>;
} {
  const { transitions } = data;
  if (transitions.length === 0) return { nodes: [], links: [] };

  const sourcesSet = new Set(transitions.map((t) => t.source));
  const targetsSet = new Set(transitions.map((t) => t.target));

  // Nodes that appear on both sides need splitting
  const bothSides = new Set<string>();
  for (const s of sourcesSet) {
    if (targetsSet.has(s)) bothSides.add(s);
  }

  const nodeIdSet = new Set<string>();

  function sourceId(name: string): string {
    return bothSides.has(name) ? `${name}_source` : name;
  }

  function targetId(name: string): string {
    return bothSides.has(name) ? `${name}_target` : name;
  }

  const links = transitions.map((t, i) => ({
    source: sourceId(t.source),
    target: targetId(t.target),
    value: Math.max(1, t.value),
    uid: `link-${i}`,
  }));

  for (const l of links) {
    nodeIdSet.add(l.source);
    nodeIdSet.add(l.target);
  }

  const nodes: NodeExtra[] = Array.from(nodeIdSet).map((id) => ({ id }));

  return { nodes, links };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ToolExecutionFlow({
  data,
  filterAgentType: _filterAgentType,
}: ToolExecutionFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 420 });

  // Track container width for responsiveness
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) {
        setDimensions((prev) => ({
          ...prev,
          width: w,
        }));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isEmpty = data.transitions.length === 0 || data.transitions.every((t) => t.value === 0);

  const totalUsage = data.toolCounts.reduce((s, c) => s + c.count, 0);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || isEmpty) return;

    const { width, height } = dimensions;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    if (innerW <= 0 || innerH <= 0) return;

    // Clear previous render
    d3.select(svgEl).selectAll("*").remove();

    const { nodes: rawNodes, links: rawLinks } = buildSankeyInput(data);
    if (rawNodes.length === 0) return;

    // Build sankey layout
    const sankeyGen = sankey<NodeExtra, LinkExtra>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeSort(null) // preserve insertion order
      .extent([
        [0, 0],
        [innerW, innerH],
      ]);

    let graph: SGraph;
    try {
      graph = sankeyGen({
        nodes: rawNodes.map((n) => ({ ...n })),
        links: rawLinks.map((l) => ({ ...l })),
      });
    } catch {
      // If layout fails (e.g., cycles), bail gracefully
      return;
    }

    // Enforce minimum node height by adjusting y0/y1
    for (const node of graph.nodes) {
      const n = node as SNode;
      if (n.y0 !== undefined && n.y1 !== undefined) {
        const h = n.y1 - n.y0;
        if (h < MIN_NODE_HEIGHT) {
          const mid = (n.y0 + n.y1) / 2;
          n.y0 = mid - MIN_NODE_HEIGHT / 2;
          n.y1 = mid + MIN_NODE_HEIGHT / 2;
        }
      }
    }

    // Re-run update step so links follow the adjusted node positions
    sankeyGen.update(graph);

    const svg = d3
      .select(svgEl)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const root = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // ── Gradient defs ──────────────────────────────────────────────────────
    const defs = svg.append("defs");

    (graph.links as SLink[]).forEach((link, i) => {
      const sourceNode = link.source as SNode;
      const targetNode = link.target as SNode;
      const gradId = `link-grad-${i}`;

      const grad = defs
        .append("linearGradient")
        .attr("id", gradId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", sourceNode.x1 ?? 0)
        .attr("x2", targetNode.x0 ?? 0);

      const srcColor = toolColor(sourceNode.id);
      const tgtColor = toolColor(targetNode.id);

      grad.append("stop").attr("offset", "0%").attr("stop-color", srcColor);
      grad.append("stop").attr("offset", "100%").attr("stop-color", tgtColor);

      (link as SLink & { _gradId: string })._gradId = gradId;
    });

    // ── Links ──────────────────────────────────────────────────────────────
    const linkPath = sankeyLinkHorizontal();

    const linkGroup = root.append("g").attr("class", "links");

    linkGroup
      .selectAll<SVGPathElement, SLink>("path")
      .data(graph.links as SLink[])
      .join("path")
      .attr("d", (d) => linkPath(d) ?? "")
      .attr("stroke", (d, i) => {
        const gradId = (graph.links[i] as SLink & { _gradId?: string })._gradId;
        return gradId ? `url(#${gradId})` : toolColor((d.source as SNode).id);
      })
      .attr("stroke-width", (d) => Math.max(1, d.width ?? 1))
      .attr("fill", "none")
      .attr("stroke-opacity", LINK_OPACITY_DEFAULT)
      .style("cursor", "default")
      .on("mouseenter", function (event: MouseEvent, d: SLink) {
        d3.select(this).attr("stroke-opacity", LINK_OPACITY_HOVER);
        const srcName = toolLabel((d.source as SNode).id);
        const tgtName = toolLabel((d.target as SNode).id);
        const count = d.value;
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          content: `${srcName} \u2192 ${tgtName}: ${count.toLocaleString()} transition${count !== 1 ? "s" : ""}`,
        });
      })
      .on("mousemove", function (event: MouseEvent) {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-opacity", LINK_OPACITY_DEFAULT);
        setTooltip(null);
      });

    // ── Nodes ──────────────────────────────────────────────────────────────
    const nodeGroup = root.append("g").attr("class", "nodes");

    const nodeGs = nodeGroup
      .selectAll<SVGGElement, SNode>("g")
      .data(graph.nodes as SNode[])
      .join("g");

    nodeGs
      .append("rect")
      .attr("x", (d) => d.x0 ?? 0)
      .attr("y", (d) => d.y0 ?? 0)
      .attr("width", (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr("height", (d) => Math.max(MIN_NODE_HEIGHT, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", (d) => toolColor(d.id))
      .attr("stroke-width", 0)
      .attr("fill-opacity", 0.9);

    // ── Node labels ────────────────────────────────────────────────────────
    nodeGs.each(function (d: SNode) {
      const g = d3.select(this);
      const nodeX0 = d.x0 ?? 0;
      const nodeX1 = d.x1 ?? 0;
      const nodeY0 = d.y0 ?? 0;
      const nodeY1 = d.y1 ?? 0;
      const nodeH = nodeY1 - nodeY0;
      const midY = nodeY0 + nodeH / 2;

      const label = toolLabel(d.id);
      const isRightSide = (nodeX0 + nodeX1) / 2 > innerW / 2;

      // Percentage of total
      const countEntry = data.toolCounts.find((c) => c.tool_name === label);
      const pct =
        countEntry && totalUsage > 0
          ? ` ${((countEntry.count / totalUsage) * 100).toFixed(1)}%`
          : "";

      const textX = isRightSide ? nodeX1 + 8 : nodeX0 - 8;
      const anchor = isRightSide ? "start" : "end";

      const text = g
        .append("text")
        .attr("x", textX)
        .attr("y", midY)
        .attr("dy", "0.35em")
        .attr("text-anchor", anchor)
        .style("font-size", "12px")
        .style("font-family", "Inter, -apple-system, sans-serif")
        .style("fill", "#e2e8f0")
        .style("pointer-events", "none")
        .style("user-select", "none");

      text.append("tspan").text(label).style("font-weight", "500");

      if (pct) {
        text.append("tspan").text(pct).style("fill", "#64748b").style("font-size", "11px");
      }
    });
  }, [data, dimensions, isEmpty, totalUsage]);

  // Adapt SVG height based on node count so tall graphs don't crush
  useEffect(() => {
    const nodeCount = new Set(data.transitions.flatMap((t) => [t.source, t.target])).size;
    const estimatedH = Math.max(
      320,
      Math.min(600, nodeCount * (NODE_PADDING + 20) + MARGIN.top + MARGIN.bottom)
    );
    setDimensions((prev) => ({ ...prev, height: estimatedH }));
  }, [data.transitions]);

  return (
    <div className="relative" ref={containerRef}>
      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height: dimensions.height }}>
          <span className="text-sm text-gray-500">No tool flow data</span>
        </div>
      ) : (
        <>
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", width: "100%", height: dimensions.height }}
          />
          {tooltip && <Tooltip x={tooltip.x} y={tooltip.y} content={tooltip.content} />}
        </>
      )}
      <Legend />
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ x, y, content }: { x: number; y: number; content: string }) {
  const nearRight = typeof window !== "undefined" && x > window.innerWidth - 220;
  return (
    <div
      className="fixed z-50 px-2.5 py-1.5 text-xs rounded shadow-xl pointer-events-none whitespace-nowrap"
      style={{
        left: nearRight ? x - 12 : x + 12,
        top: y - 10,
        transform: nearRight ? "translateX(-100%)" : undefined,
        background: "#12121f",
        border: "1px solid #2a2a4a",
        color: "#e2e8f0",
      }}
    >
      {content}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND_ITEMS: Array<{ label: string; color: string }> = [
  { label: "Read", color: "#3b82f6" },
  { label: "Write", color: "#22c55e" },
  { label: "Edit", color: "#eab308" },
  { label: "Bash", color: "#ef4444" },
  { label: "Grep", color: "#a855f7" },
  { label: "Glob", color: "#ec4899" },
  { label: "Agent", color: "#6366f1" },
  { label: "Other", color: "#64748b" },
];

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
      {LEGEND_ITEMS.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            style={{ background: color, opacity: 0.9 }}
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
          />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  );
}
