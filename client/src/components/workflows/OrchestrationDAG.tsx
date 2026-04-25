/**
 * @file OrchestrationDAG.tsx
 * @description Defines the OrchestrationDAG React component that visualizes orchestration data as a directed acyclic graph (DAG) using D3.js. The component takes in orchestration data, processes it to build a graph structure with nodes and edges, and renders it as an SVG. It includes interactive features such as tooltips on hover and click handlers for nodes. The graph is styled with gradients and colors to differentiate between different types of nodes and outcomes, providing a clear visual representation of the orchestration process.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { OrchestrationData } from "../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrchestrationDAGProps {
  data: OrchestrationData;
  onNodeClick?: (nodeType: string) => void;
  selectedNode?: string | null;
}

interface DAGNode {
  id: string;
  label: string;
  count: number;
  layer: number;
  kind: "session" | "main" | "subagent" | "nested" | "outcome";
  meta?: {
    completed?: number;
    errors?: number;
    subagent_type?: string;
    status?: string;
  };
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DAGEdge {
  source: string;
  target: string;
  weight: number;
  sourceNode?: DAGNode;
  targetNode?: DAGNode;
}

interface TooltipState {
  x: number;
  y: number;
  node: DAGNode;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_W = 136;
const NODE_H = 44;
const NODE_RX = 8;
const LAYER_GAP = 80;
const NODE_V_GAP = 8;
const PADDING_X = 8;
const PADDING_TOP = 44;
const PADDING_BOTTOM = 40;
const MAX_SUBAGENT_NODES = 7;
const MAX_EDGE_STROKE = 10;
const MIN_EDGE_STROKE = 1.5;
const BADGE_W = 28;
const BADGE_H = 14;

// Layer labels are now computed via i18n inside the component

const OUTCOME_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  completed: { fill: "#052e16", stroke: "#16a34a", text: "#4ade80" },
  error: { fill: "#1f0808", stroke: "#dc2626", text: "#f87171" },
  abandoned: { fill: "#1c1a04", stroke: "#ca8a04", text: "#facc15" },
};

const KIND_GRADIENTS: Record<
  DAGNode["kind"],
  { id: string; stops: Array<{ offset: string; color: string }> }
> = {
  session: {
    id: "grad-session",
    stops: [
      { offset: "0%", color: "#312e81" },
      { offset: "100%", color: "#4338ca" },
    ],
  },
  main: {
    id: "grad-main",
    stops: [
      { offset: "0%", color: "#1e3a5f" },
      { offset: "100%", color: "#1d4ed8" },
    ],
  },
  subagent: {
    id: "grad-subagent",
    stops: [
      { offset: "0%", color: "#052e16" },
      { offset: "100%", color: "#166534" },
    ],
  },
  nested: {
    id: "grad-nested",
    stops: [
      { offset: "0%", color: "#134e4a" },
      { offset: "100%", color: "#0f766e" },
    ],
  },
  outcome: {
    id: "grad-outcome",
    stops: [
      { offset: "0%", color: "#1e1b4b" },
      { offset: "100%", color: "#4338ca" },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEmpty(data: OrchestrationData): boolean {
  return (
    data.sessionCount === 0 &&
    data.mainCount === 0 &&
    data.subagentTypes.length === 0 &&
    data.outcomes.length === 0
  );
}

function successRate(completed: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((completed / total) * 100)}%`;
}

function outcomeColorSet(status: string) {
  return OUTCOME_COLORS[status] ?? { fill: "#1a1a28", stroke: "#363650", text: "#9ca3af" };
}

// ── Layout builder ────────────────────────────────────────────────────────────

function buildGraph(
  data: OrchestrationData,
  t: (key: string, options?: Record<string, unknown>) => string
): {
  nodes: DAGNode[];
  edges: DAGEdge[];
  svgWidth: number;
  svgHeight: number;
} {
  const rawNodes: Omit<DAGNode, "x" | "y">[] = [];

  // Layer 0 — sessions
  rawNodes.push({
    id: "sessions",
    label: t("orchestration.sessions"),
    count: data.sessionCount,
    layer: 0,
    kind: "session",
    width: NODE_W,
    height: NODE_H,
  });

  // Layer 1 — main agent
  rawNodes.push({
    id: "main",
    label: t("orchestration.mainAgent"),
    count: data.mainCount,
    layer: 1,
    kind: "main",
    width: NODE_W,
    height: NODE_H,
  });

  // Layer 2 — subagent types (deduplicated, capped at MAX_SUBAGENT_NODES)
  const subagentMap = new Map<string, { count: number; completed: number; errors: number }>();
  for (const s of data.subagentTypes) {
    const key = s.subagent_type || "unknown";
    const existing = subagentMap.get(key);
    if (existing) {
      existing.count += s.count;
      existing.completed += s.completed;
      existing.errors += s.errors;
    } else {
      subagentMap.set(key, { count: s.count, completed: s.completed, errors: s.errors });
    }
  }
  // Sort by count desc, take top N
  const sortedSubagents = [...subagentMap.entries()].sort((a, b) => b[1].count - a[1].count);
  const visible = sortedSubagents.slice(0, MAX_SUBAGENT_NODES);
  const overflow = sortedSubagents.slice(MAX_SUBAGENT_NODES);

  for (const [type, stats] of visible) {
    rawNodes.push({
      id: `subagent:${type}`,
      label: type.length > 14 ? type.slice(0, 12) + "..." : type,
      count: stats.count,
      layer: 2,
      kind: "subagent",
      width: NODE_W,
      height: NODE_H,
      meta: { completed: stats.completed, errors: stats.errors, subagent_type: type },
    });
  }
  if (overflow.length > 0) {
    const overflowTotal = overflow.reduce((s, [, v]) => s + v.count, 0);
    rawNodes.push({
      id: "subagent:__overflow",
      label: t("common:plusMore", { count: overflow.length }),
      count: overflowTotal,
      layer: 2,
      kind: "subagent",
      width: NODE_W,
      height: NODE_H,
      meta: {
        completed: 0,
        errors: 0,
        subagent_type: t("orchestration.otherTypes", { count: overflow.length }),
      },
    });
  }

  // Layer 3 — compactions (context compressions)
  const compactions = (data as unknown as { compactions?: { total: number; sessions: number } })
    .compactions;
  const compTotal = compactions?.total ?? 0;
  const compSessions = compactions?.sessions ?? 0;
  rawNodes.push({
    id: "compaction:total",
    label: t("orchestration.compactions"),
    count: compTotal,
    layer: 3,
    kind: "nested",
    width: NODE_W,
    height: NODE_H,
    meta: { subagent_type: "compaction" },
  });
  if (compSessions > 0) {
    rawNodes.push({
      id: "compaction:sessions",
      label: `${compSessions} sessions`,
      count: compSessions,
      layer: 3,
      kind: "nested",
      width: NODE_W,
      height: NODE_H,
      meta: { subagent_type: "compaction" },
    });
  }

  // Layer 4 — outcomes
  const outcomeMap = new Map<string, number>();
  for (const o of data.outcomes) {
    outcomeMap.set(o.status, (outcomeMap.get(o.status) ?? 0) + o.count);
  }
  if (outcomeMap.size === 0) {
    outcomeMap.set("completed", 0);
  }
  for (const [status, count] of outcomeMap) {
    rawNodes.push({
      id: `outcome:${status}`,
      label: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      layer: 4,
      kind: "outcome",
      width: NODE_W,
      height: NODE_H,
      meta: { status },
    });
  }

  // Compute per-layer node lists
  const layers: Omit<DAGNode, "x" | "y">[][] = [[], [], [], [], []];
  for (const n of rawNodes) {
    layers[n.layer]?.push(n);
  }

  // Compute SVG dimensions
  const numLayers = layers.length;
  const maxNodesInLayer = Math.max(...layers.map((l) => l.length));
  const svgWidth = PADDING_X * 2 + numLayers * NODE_W + (numLayers - 1) * LAYER_GAP;
  const naturalHeight =
    PADDING_TOP +
    PADDING_BOTTOM +
    maxNodesInLayer * NODE_H +
    Math.max(0, maxNodesInLayer - 1) * NODE_V_GAP;
  const svgHeight = Math.min(naturalHeight, 520);

  // Assign x/y positions
  const nodes: DAGNode[] = [];
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li] ?? [];
    const layerX = PADDING_X + li * (NODE_W + LAYER_GAP);
    const layerTotalH = layer.length * NODE_H + Math.max(0, layer.length - 1) * NODE_V_GAP;
    const layerStartY = PADDING_TOP + (svgHeight - PADDING_TOP - PADDING_BOTTOM - layerTotalH) / 2;

    for (let ni = 0; ni < layer.length; ni++) {
      const raw = layer[ni]!;
      nodes.push({
        ...raw,
        x: layerX,
        y: layerStartY + ni * (NODE_H + NODE_V_GAP),
      });
    }
  }

  // Build nodeMap for edge lookup
  const nodeMap = new Map<string, DAGNode>(nodes.map((n) => [n.id, n]));

  // Build edges from data.edges + synthetic structural edges
  const edgeSet = new Set<string>();
  const rawEdges: DAGEdge[] = [];

  const addEdge = (source: string, target: string, weight: number) => {
    const key = `${source}→${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const sn = nodeMap.get(source);
    const tn = nodeMap.get(target);
    if (sn && tn) {
      rawEdges.push({ source, target, weight, sourceNode: sn, targetNode: tn });
    }
  };

  // Sessions → Main
  addEdge("sessions", "main", data.mainCount || 1);

  // Main → each subagent type (use data.edges if available, else uniform)
  const subagentIds = nodes.filter((n) => n.kind === "subagent").map((n) => n.id);
  const compactionIds = nodes.filter((n) => n.kind === "nested").map((n) => n.id);
  const outcomeIds = nodes.filter((n) => n.kind === "outcome").map((n) => n.id);

  for (const edge of data.edges) {
    // Map source/target names to node IDs
    const srcId =
      edge.source === "main"
        ? "main"
        : edge.source === "sessions"
          ? "sessions"
          : (subagentIds.find((id) => id === `subagent:${edge.source}`) ??
            compactionIds.find((id) => id === `nested:${edge.source}`) ??
            `subagent:${edge.source}`);
    const tgtId =
      edge.target === "main"
        ? "main"
        : (outcomeIds.find((id) => id === `outcome:${edge.target}`) ??
          compactionIds.find((id) => id === `nested:${edge.target}`) ??
          subagentIds.find((id) => id === `subagent:${edge.target}`) ??
          `subagent:${edge.target}`);
    addEdge(srcId, tgtId, edge.weight);
  }

  // Structural fallbacks: main → subagents if no data edges cover them
  for (const sid of subagentIds) {
    const hasEdge = rawEdges.some((e) => e.target === sid);
    if (!hasEdge) {
      const subNode = nodeMap.get(sid);
      addEdge("main", sid, subNode?.count ?? 1);
    }
  }

  // Subagents → compaction nodes
  for (const cid of compactionIds) {
    const cNode = nodeMap.get(cid);
    const weight = Math.max(1, cNode?.count ?? 1);
    // Connect from each subagent to compaction
    for (const sid of subagentIds) {
      addEdge(sid, cid, Math.max(0.5, Math.round(weight / Math.max(subagentIds.length, 1))));
    }
  }

  // Compaction → outcomes
  for (const cid of compactionIds) {
    for (const oid of outcomeIds) {
      const outcomeNode = nodeMap.get(oid);
      const perComp = Math.max(
        0.5,
        Math.round((outcomeNode?.count ?? 1) / Math.max(compactionIds.length, 1))
      );
      addEdge(cid, oid, perComp);
    }
  }

  // Also connect subagents directly to outcomes
  for (const sid of subagentIds) {
    for (const oid of outcomeIds) {
      const outcomeNode = nodeMap.get(oid);
      const perSub = Math.max(
        0.5,
        Math.round((outcomeNode?.count ?? 1) / Math.max(subagentIds.length, 1))
      );
      addEdge(sid, oid, perSub);
    }
  }

  return { nodes, edges: rawEdges, svgWidth, svgHeight };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrchestrationDAG({ data, onNodeClick, selectedNode }: OrchestrationDAGProps) {
  const { t } = useTranslation("workflows");
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mounted, setMounted] = useState(false);

  const layerLabels = [
    t("orchestration.layers.origin"),
    t("orchestration.layers.mainAgent"),
    t("orchestration.layers.subagentTypes"),
    t("orchestration.layers.compactions"),
    t("orchestration.layers.outcomes"),
  ];

  const graph = useMemo(() => buildGraph(data, t), [data, t]);

  const handleNodeClick = useCallback(
    (node: DAGNode) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  // Fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const { nodes, edges, svgHeight } = graph;
    const currentLayerLabels = layerLabels;

    const root = d3.select(svg);
    root.selectAll("*").remove();

    // ── Defs ──────────────────────────────────────────────────────────────────

    const defs = root.append("defs");

    // Gradients
    for (const kind of Object.keys(KIND_GRADIENTS) as DAGNode["kind"][]) {
      const g = KIND_GRADIENTS[kind];
      const grad = defs
        .append("linearGradient")
        .attr("id", g.id)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
      for (const stop of g.stops) {
        grad.append("stop").attr("offset", stop.offset).attr("stop-color", stop.color);
      }
    }

    // Outcome-specific gradients
    for (const [status, colors] of Object.entries(OUTCOME_COLORS)) {
      const grad = defs
        .append("linearGradient")
        .attr("id", `grad-outcome-${status}`)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", colors.fill);
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colors.stroke + "55");
    }

    // Glow filter for selected node
    const glowFilter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-30%")
      .attr("y", "-30%")
      .attr("width", "160%")
      .attr("height", "160%");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Edge shadow filter
    const edgeFilter = defs
      .append("filter")
      .attr("id", "edge-glow")
      .attr("x", "-10%")
      .attr("y", "-50%")
      .attr("width", "120%")
      .attr("height", "200%");
    edgeFilter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "blur");
    const edgeMerge = edgeFilter.append("feMerge");
    edgeMerge.append("feMergeNode").attr("in", "blur");
    edgeMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Layer labels ──────────────────────────────────────────────────────────

    const labelLayer = root.append("g").attr("class", "layer-labels");
    const layerXPositions = [0, 1, 2, 3, 4].map(
      (li) => PADDING_X + li * (NODE_W + LAYER_GAP) + NODE_W / 2
    );

    labelLayer
      .selectAll("text")
      .data(currentLayerLabels)
      .join("text")
      .attr("x", (_, i) => layerXPositions[i] ?? 0)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("letter-spacing", "0.08em")
      .attr("text-transform", "uppercase")
      .text((d) => d.toUpperCase());

    // ── Layer separator lines ──────────────────────────────────────────────────

    const sepLayer = root.append("g").attr("class", "layer-separators");
    for (let li = 1; li < 5; li++) {
      const sepX = PADDING_X + li * (NODE_W + LAYER_GAP) - LAYER_GAP / 2;
      sepLayer
        .append("line")
        .attr("x1", sepX)
        .attr("y1", 32)
        .attr("x2", sepX)
        .attr("y2", svgHeight - PADDING_BOTTOM + 8)
        .attr("stroke", "#1f1f30")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 4");
    }

    // ── Edges ─────────────────────────────────────────────────────────────────

    const weightExtent = d3.extent(edges, (e) => e.weight) as [number, number];
    const strokeScale = d3
      .scaleLinear()
      .domain([Math.max(0.1, weightExtent[0] ?? 0.1), Math.max(1, weightExtent[1] ?? 1)])
      .range([MIN_EDGE_STROKE, MAX_EDGE_STROKE])
      .clamp(true);

    const edgeLayer = root.append("g").attr("class", "edges");

    for (const edge of edges) {
      const sn = edge.sourceNode;
      const tn = edge.targetNode;
      if (!sn || !tn) continue;

      const sx = sn.x + sn.width;
      const sy = sn.y + sn.height / 2;
      const tx = tn.x;
      const ty = tn.y + tn.height / 2;
      const cx = (sx + tx) / 2;

      const path = `M ${sx},${sy} C ${cx},${sy} ${cx},${ty} ${tx},${ty}`;
      const stroke = strokeScale(edge.weight);
      const isZero = edge.weight <= 0.5;

      // Shadow pass
      edgeLayer
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#6366f1")
        .attr("stroke-width", stroke + 2)
        .attr("stroke-opacity", isZero ? 0 : 0.08)
        .attr("filter", "url(#edge-glow)");

      // Main edge
      edgeLayer
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", isZero ? "#2a2a3d" : "#4f46e5")
        .attr("stroke-width", isZero ? 1 : stroke)
        .attr("stroke-opacity", isZero ? 0.3 : 0.55)
        .attr("stroke-linecap", "round");
    }

    // ── Nodes ─────────────────────────────────────────────────────────────────

    const nodeLayer = root.append("g").attr("class", "nodes");

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, DAGNode>("g.node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("cursor", "pointer")
      .attr("role", "button")
      .attr("aria-label", (d) => `${d.label}: ${d.count}`)
      .on("click", (_event, d) => {
        handleNodeClick(d);
      })
      .on("mouseenter", (event: MouseEvent, d: DAGNode) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d });
        d3.select(event.currentTarget as SVGGElement)
          .select("rect.node-bg")
          .attr("stroke-opacity", 0.9);
      })
      .on("mousemove", (event: MouseEvent) => {
        setTooltip((prev) => prev && { ...prev, x: event.clientX, y: event.clientY });
      })
      .on("mouseleave", (event: MouseEvent, d: DAGNode) => {
        setTooltip(null);
        const opacity = selectedNode === d.id ? 0.9 : 0.4;
        d3.select(event.currentTarget as SVGGElement)
          .select("rect.node-bg")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .attr("stroke-opacity", opacity as any);
      });

    // Outer glow ring for selected node
    nodeGroups
      .filter((d) => d.id === selectedNode)
      .append("rect")
      .attr("x", -3)
      .attr("y", -3)
      .attr("width", (d) => d.width + 6)
      .attr("height", (d) => d.height + 6)
      .attr("rx", NODE_RX + 3)
      .attr("fill", "none")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 2)
      .attr("filter", "url(#glow)")
      .attr("opacity", 0.8);

    // Background rect — outcome nodes use per-status fill
    nodeGroups
      .append("rect")
      .attr("class", "node-bg")
      .attr("width", (d) => d.width)
      .attr("height", (d) => d.height)
      .attr("rx", NODE_RX)
      .attr("fill", (d) => {
        if (d.kind === "outcome" && d.meta?.status) {
          return `url(#grad-outcome-${d.meta.status})`;
        }
        return `url(#${KIND_GRADIENTS[d.kind].id})`;
      })
      .attr("stroke", (d) => {
        if (d.id === selectedNode) return "#6366f1";
        if (d.kind === "outcome" && d.meta?.status) {
          return outcomeColorSet(d.meta.status).stroke;
        }
        return borderColorForKind(d.kind);
      })
      .attr("stroke-width", (d) => (d.id === selectedNode ? 1.5 : 1))
      .attr("stroke-opacity", (d) => (d.id === selectedNode ? 0.9 : 0.4));

    // Label text
    nodeGroups
      .append("text")
      .attr("x", 10)
      .attr("y", NODE_H / 2 - 3)
      .attr("dominant-baseline", "middle")
      .attr("fill", (d) => {
        if (d.kind === "outcome" && d.meta?.status) return outcomeColorSet(d.meta.status).text;
        return textColorForKind(d.kind);
      })
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("font-family", "Inter, sans-serif")
      .text((d) => d.label);

    // Count badge background
    nodeGroups
      .append("rect")
      .attr("x", (d) => d.width - (BADGE_W + 8))
      .attr("y", NODE_H / 2 - BADGE_H / 2)
      .attr("width", BADGE_W)
      .attr("height", BADGE_H)
      .attr("rx", 7)
      .attr("fill", (d) => badgeBgForKind(d.kind, d.meta?.status))
      .attr("opacity", 0.9);

    // Count badge text
    nodeGroups
      .append("text")
      .attr("x", (d) => d.width - (BADGE_W / 2 + 8))
      .attr("y", NODE_H / 2 + 1)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", (d) => {
        if (d.kind === "outcome" && d.meta?.status) return outcomeColorSet(d.meta.status).text;
        return textColorForKind(d.kind);
      })
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("font-family", "Inter, sans-serif")
      .text((d) => fmtCount(d.count));
  }, [graph, selectedNode, handleNodeClick, layerLabels]);

  if (isEmpty(data)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-4 flex items-center justify-center mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-6 h-6 text-gray-500"
          >
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="18" cy="18" r="2" />
            <line x1="8" y1="11" x2="16" y2="7" />
            <line x1="8" y1="13" x2="16" y2="17" />
          </svg>
        </div>
        <h3 className="text-base font-medium text-gray-300 mb-2">{t("orchestration.noData")}</h3>
        <p className="text-sm text-gray-500 max-w-sm">{t("orchestration.noDataDesc")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.4s ease-out",
      }}
    >
      {/* SVG DAG */}
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${graph.svgWidth} ${graph.svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: "100%",
            minWidth: graph.svgWidth,
            height: graph.svgHeight,
            display: "block",
          }}
          aria-label={t("orchestration.ariaLabel")}
          role="img"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 mt-4">
        <span className="text-[10px] text-gray-600 uppercase tracking-widest font-medium mr-1">
          {t("orchestration.legend")}
        </span>
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: item.color, border: `1px solid ${item.border}` }}
            />
            <span className="text-[11px] text-gray-500">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <span
            className="inline-block h-[2px] w-8 rounded flex-shrink-0"
            style={{ background: "linear-gradient(to right, #312e81, #4f46e5)" }}
          />
          <span className="text-[11px] text-gray-500">{t("orchestration.edgeWeight")}</span>
        </div>
      </div>

      {/* Tooltip — rendered in React DOM, not D3 */}
      {tooltip && <DAGTooltip tooltip={tooltip} />}
    </div>
  );
}

// ── Tooltip component ─────────────────────────────────────────────────────────

function DAGTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { t } = useTranslation("workflows");
  const { x, y, node } = tooltip;
  const nearRight = typeof window !== "undefined" && x > window.innerWidth - 220;

  const lines: Array<{ label: string; value: string }> = [
    { label: t("orchestration.count"), value: String(node.count) },
  ];

  if (node.kind === "subagent" && node.meta) {
    const { completed = 0, errors = 0 } = node.meta;
    lines.push({
      label: t("common:status.completed", { defaultValue: "Completed" }),
      value: String(completed),
    });
    lines.push({
      label: t("common:status.error", { defaultValue: "Errors" }),
      value: String(errors),
    });
    lines.push({
      label: t("effectiveness.success", { defaultValue: "Success rate" }),
      value: successRate(completed, node.count),
    });
  }

  if (node.kind === "nested" && node.meta?.subagent_type) {
    lines.push({
      label: t("common:type"),
      value: node.meta.subagent_type,
    });
  }

  if (node.kind === "outcome" && node.meta?.status) {
    lines.push({
      label: t("common:statusLabel"),
      value: t(`common:status.${node.meta.status}`, { defaultValue: node.meta.status }),
    });
  }

  return (
    <div
      className="fixed z-50 px-3 py-2 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl pointer-events-none"
      style={{
        left: nearRight ? x - 16 : x + 16,
        top: y - 8,
        transform: nearRight ? "translateX(-100%)" : undefined,
        minWidth: 160,
      }}
    >
      <p className="text-xs font-semibold text-gray-200 mb-1.5">{node.label}</p>
      <div className="space-y-0.5">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-gray-500">{line.label}</span>
            <span className="text-gray-300 font-medium tabular-nums">{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Utility functions ─────────────────────────────────────────────────────────

function borderColorForKind(kind: DAGNode["kind"]): string {
  switch (kind) {
    case "session":
      return "#6366f1";
    case "main":
      return "#3b82f6";
    case "subagent":
      return "#22c55e";
    case "nested":
      return "#14b8a6";
    case "outcome":
      return "#6366f1";
  }
}

function textColorForKind(kind: DAGNode["kind"]): string {
  switch (kind) {
    case "session":
      return "#a5b4fc";
    case "main":
      return "#93c5fd";
    case "subagent":
      return "#86efac";
    case "nested":
      return "#5eead4";
    case "outcome":
      return "#c4b5fd";
  }
}

function badgeBgForKind(kind: DAGNode["kind"], status?: string): string {
  if (kind === "outcome" && status) {
    return outcomeColorSet(status).stroke + "33";
  }
  switch (kind) {
    case "session":
      return "rgba(99,102,241,0.25)";
    case "main":
      return "rgba(59,130,246,0.25)";
    case "subagent":
      return "rgba(34,197,94,0.25)";
    case "nested":
      return "rgba(20,184,166,0.25)";
    case "outcome":
      return "rgba(99,102,241,0.25)";
  }
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

// ── Legend data ───────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: "Sessions", color: "#312e81", border: "#6366f1" },
  { label: "Main Agent", color: "#1e3a5f", border: "#3b82f6" },
  { label: "Subagent Types", color: "#052e16", border: "#22c55e" },
  { label: "Compactions", color: "#134e4a", border: "#14b8a6" },
  { label: "Completed", color: "#052e16", border: "#16a34a" },
  { label: "Error", color: "#1f0808", border: "#dc2626" },
  { label: "Abandoned", color: "#1c1a04", border: "#ca8a04" },
];
