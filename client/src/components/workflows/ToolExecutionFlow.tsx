/**
 * @file ToolExecutionFlow.tsx
 * @description Defines the ToolExecutionFlow component that visualizes the flow of tool usage in agent workflows using a Sankey diagram. It processes the provided tool flow data, constructs a Sankey graph, and renders it using D3.js. The component also includes interactive tooltips for links and a legend for tool types. It handles responsiveness and edge cases such as empty data gracefully.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/ToolExecutionFlow.tsx`
 * **Purpose:** Workflow analytics visualization built on D3; consumes aggregated session/run metrics from the workflows API.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../../lib/types`
 *
 * ## Public surface
 * - `ToolExecutionFlow` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **ToolExecutionFlow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { SankeyGraph, SankeyNode, SankeyLink } from "d3-sankey";
import { useTranslation } from "react-i18next";
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

interface NodeTipPayload {
  kind: "node";
  rawName: string;
  count: number;
  shareOfTotal: number;
}

interface LinkTipPayload {
  kind: "link";
  source: string;
  target: string;
  count: number;
  shareOfSource: number;
  shareOfTarget: number;
}

type TipPayload = NodeTipPayload | LinkTipPayload;

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
  const { t } = useTranslation("workflows");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
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

  const hideTip = useCallback(() => {
    const tip = tipRef.current;
    if (tip) tip.style.opacity = "0";
  }, []);
  const localizeToolLabel = useCallback(
    (name: string) => {
      const lower = name.toLowerCase();
      switch (lower) {
        case "read":
        case "write":
        case "edit":
        case "bash":
        case "grep":
        case "glob":
        case "agent":
        case "other":
          return t(`errors:toolLegend.${lower}`);
        default:
          return name;
      }
    },
    [t]
  );

  const showTip = useCallback(
    (payload: TipPayload, anchorEl: SVGGraphicsElement) => {
      const tip = tipRef.current;
      if (!tip) return;
      buildToolFlowTooltip(tip, payload, localizeToolLabel, t);

      // Position
      const r = anchorEl.getBoundingClientRect();
      tip.style.opacity = "0";
      tip.style.display = "block";
      const tipW = tip.offsetWidth || 280;
      const tipH = tip.offsetHeight || 160;

      const margin = 8;
      let left = r.left + r.width / 2 - tipW / 2;
      if (left < margin) left = margin;
      if (left + tipW > window.innerWidth - margin) left = window.innerWidth - tipW - margin;

      let top = r.top - tipH - 10;
      if (top < margin) top = r.bottom + 10;

      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.opacity = "1";
    },
    [localizeToolLabel, t]
  );

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

    // Pre-compute outgoing/incoming totals per node so we can show share-of-source
    // and share-of-target percentages in the tooltip.
    const outgoingByNode = new Map<string, number>();
    const incomingByNode = new Map<string, number>();
    for (const link of graph.links as SLink[]) {
      const src = (link.source as SNode).id;
      const tgt = (link.target as SNode).id;
      outgoingByNode.set(src, (outgoingByNode.get(src) ?? 0) + (link.value ?? 0));
      incomingByNode.set(tgt, (incomingByNode.get(tgt) ?? 0) + (link.value ?? 0));
    }

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
      .on("mouseenter", function (_event: MouseEvent, d: SLink) {
        d3.select(this).attr("stroke-opacity", LINK_OPACITY_HOVER);
        const src = (d.source as SNode).id;
        const tgt = (d.target as SNode).id;
        const srcOut = outgoingByNode.get(src) ?? 0;
        const tgtIn = incomingByNode.get(tgt) ?? 0;
        showTip(
          {
            kind: "link",
            source: toolLabel(src),
            target: toolLabel(tgt),
            count: d.value ?? 0,
            shareOfSource: srcOut > 0 ? (d.value ?? 0) / srcOut : 0,
            shareOfTarget: tgtIn > 0 ? (d.value ?? 0) / tgtIn : 0,
          },
          this as SVGGraphicsElement
        );
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-opacity", LINK_OPACITY_DEFAULT);
        hideTip();
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
      .attr("fill-opacity", 0.9)
      .style("cursor", "default")
      .on("mouseenter", function (_event: MouseEvent, d: SNode) {
        const rawName = toolLabel(d.id);
        const countEntry = data.toolCounts.find((c) => c.tool_name === rawName);
        const count = countEntry?.count ?? 0;
        showTip(
          {
            kind: "node",
            rawName,
            count,
            shareOfTotal: totalUsage > 0 ? count / totalUsage : 0,
          },
          this as SVGGraphicsElement
        );
      })
      .on("mouseleave", function () {
        hideTip();
      });

    // ── Node labels ────────────────────────────────────────────────────────
    nodeGs.each(function (d: SNode) {
      const g = d3.select(this);
      const nodeX0 = d.x0 ?? 0;
      const nodeX1 = d.x1 ?? 0;
      const nodeY0 = d.y0 ?? 0;
      const nodeY1 = d.y1 ?? 0;
      const nodeH = nodeY1 - nodeY0;
      const midY = nodeY0 + nodeH / 2;

      const rawLabel = toolLabel(d.id);
      const label = localizeToolLabel(rawLabel);
      const isRightSide = (nodeX0 + nodeX1) / 2 > innerW / 2;

      // Percentage of total
      const countEntry = data.toolCounts.find((c) => c.tool_name === rawLabel);
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

    // Hide any stale tooltip when the chart re-renders so it cannot get stuck.
    hideTip();
  }, [data, dimensions, isEmpty, localizeToolLabel, t, totalUsage, showTip, hideTip]);

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
    <div className="relative" ref={containerRef} onMouseLeave={hideTip}>
      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height: dimensions.height }}>
          <span className="text-sm text-gray-500">{t("toolFlow.noData")}</span>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: dimensions.height }}
          onMouseLeave={hideTip}
        />
      )}
      <Legend />
      <div
        ref={tipRef}
        role="tooltip"
        aria-hidden="true"
        className="fixed z-50 px-3 py-2 rounded-lg shadow-2xl pointer-events-none"
        style={{
          display: "none",
          opacity: 0,
          left: 0,
          top: 0,
          background: "#12121f",
          border: "1px solid #2a2a4a",
          color: "#e2e8f0",
          minWidth: 240,
          maxWidth: 320,
          transition: "opacity 120ms ease-out",
        }}
      />
    </div>
  );
}

// ── Tooltip DOM builder ───────────────────────────────────────────────────────

function fmtPct(v: number): string {
  if (v <= 0) return "-";
  if (v < 0.01) return "<1%";
  return `${(v * 100).toFixed(1)}%`;
}

function appendTipRow(parent: HTMLElement, label: string, value: string) {
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;justify-content:space-between;gap:16px;font-size:11px;line-height:1.6";
  const lbl = document.createElement("span");
  lbl.style.color = "#64748b";
  lbl.textContent = label;
  const val = document.createElement("span");
  val.style.cssText = "color:#cbd5e1;font-weight:500;font-variant-numeric:tabular-nums";
  val.textContent = value;
  row.appendChild(lbl);
  row.appendChild(val);
  parent.appendChild(row);
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function buildToolFlowTooltip(
  el: HTMLDivElement,
  payload: TipPayload,
  localizeToolLabel: (name: string) => string,
  t: TFn
) {
  while (el.firstChild) el.removeChild(el.firstChild);

  if (payload.kind === "node") {
    const name = localizeToolLabel(payload.rawName);

    const title = document.createElement("p");
    title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0";
    title.textContent = name;
    el.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.style.cssText =
      "font-size:10px;color:#64748b;margin:2px 0 8px;text-transform:uppercase;letter-spacing:0.05em";
    subtitle.textContent = t("toolFlow.tooltip.node");
    el.appendChild(subtitle);

    appendTipRow(el, t("toolFlow.tooltip.totalCalls"), payload.count.toLocaleString());
    appendTipRow(el, t("toolFlow.tooltip.shareOfAll"), fmtPct(payload.shareOfTotal));

    const desc = document.createElement("p");
    desc.style.cssText =
      "font-size:11px;color:#94a3b8;line-height:1.45;border-top:1px solid #2a2a4a;padding-top:8px;margin:8px 0 0";
    desc.textContent = t("toolFlow.tooltip.nodeDescFmt", { name });
    el.appendChild(desc);
    return;
  }

  // Link tooltip
  const src = localizeToolLabel(payload.source);
  const tgt = localizeToolLabel(payload.target);

  const title = document.createElement("p");
  title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0";
  const tspanArrow = document.createElement("span");
  tspanArrow.style.color = "#64748b";
  tspanArrow.textContent = " → ";
  title.appendChild(document.createTextNode(src));
  title.appendChild(tspanArrow);
  title.appendChild(document.createTextNode(tgt));
  el.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.style.cssText =
    "font-size:10px;color:#64748b;margin:2px 0 8px;text-transform:uppercase;letter-spacing:0.05em";
  subtitle.textContent = t("toolFlow.tooltip.link");
  el.appendChild(subtitle);

  appendTipRow(el, t("toolFlow.tooltip.transitionsObserved"), payload.count.toLocaleString());
  appendTipRow(
    el,
    t("toolFlow.tooltip.shareOfSourceFmt", { source: src }),
    fmtPct(payload.shareOfSource)
  );
  appendTipRow(
    el,
    t("toolFlow.tooltip.shareOfTargetFmt", { target: tgt }),
    fmtPct(payload.shareOfTarget)
  );

  const desc = document.createElement("p");
  desc.style.cssText =
    "font-size:11px;color:#94a3b8;line-height:1.45;border-top:1px solid #2a2a4a;padding-top:8px;margin:8px 0 0";
  desc.textContent = t("toolFlow.tooltip.linkDescFmt", { source: src, target: tgt });
  el.appendChild(desc);
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND_ITEMS: Array<{ key: string; color: string }> = [
  { key: "read", color: "#3b82f6" },
  { key: "write", color: "#22c55e" },
  { key: "edit", color: "#eab308" },
  { key: "bash", color: "#ef4444" },
  { key: "grep", color: "#a855f7" },
  { key: "glob", color: "#ec4899" },
  { key: "agent", color: "#6366f1" },
  { key: "other", color: "#64748b" },
];

function Legend() {
  const { t } = useTranslation("errors");
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
      {LEGEND_ITEMS.map(({ key, color }) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            style={{ background: color, opacity: 0.9 }}
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
          />
          <span className="text-xs text-gray-400">{t(`toolLegend.${key}`)}</span>
        </div>
      ))}
    </div>
  );
}
