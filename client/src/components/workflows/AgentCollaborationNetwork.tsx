/**
 * @file AgentCollaborationNetwork.tsx
 * @description Defines the AgentCollaborationNetwork React component that visualizes the collaboration between different agent types in a directed graph format using D3.js. The component takes in effectiveness data and interaction edges, renders an interactive force-directed graph, and keeps data-driven legend labels bounded through pagination.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/AgentCollaborationNetwork.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * Defines the AgentCollaborationNetwork React component that visualizes the collaboration between
 * different agent types in a directed graph format using D3.js. The component takes in
 * effectiveness data and interaction edges, renders an interactive force-directed graph, and keeps
 * data-driven legend labels bounded through pagination.
 *
 * ## Architectural boundary
 * - Transforms workflow analytics into an explanatory visualization without redefining the server's
 *   aggregate semantics.
 * - Layout geometry, interaction state, and rendering adapters stay local; canonical workflow types
 *   stay in shared contracts.
 * - Every graphical encoding needs a readable textual label or surrounding explanation for
 *   accessibility and debugging.
 *
 * ## Local dependency edges
 * - `../PaginatedLegend` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `d3` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `AgentCollaborationNetwork` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `AgentCollaborationNetworkProps` (interface) — exported contract; search downstream imports and
 *   tests before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `AgentCollaborationNetwork` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `AgentCollaborationNetworkProps` (interface) — top-level declaration that helps orient code
 *   review and focused test selection.
 * - `appendTooltipDescription` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `appendTooltipRow` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `describeNodeRole` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MAX_R` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `MIN_R` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PALETTE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PipelineLink` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PipelineNode` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `positionTooltipAt` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `showTooltip` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `STROKE_PALETTE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TFn` (type) — top-level declaration that helps orient code review and focused test selection.
 *
 * ## React and framework hooks
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `workflows` — visible copy resolves through this namespace; key and interpolation parity
 *   applies to every supported locale.
 *
 * ## Area invariants
 * - Use stable entity identifiers for nodes, links, colors, selections, legends, and React keys.
 * - Treat missing timestamps, models, token values, parents, and terminal states as expected
 *   partial-data cases.
 * - Keep scales and domains deterministic so identical data does not jump between renders.
 * - Bound SVG/canvas dimensions and event listeners; resize observers and D3 selections require
 *   cleanup.
 * - Do not silently discard filtered records when a visual limit is applied; explain truncation in
 *   the UI.
 * - Keep tooltip and legend values aligned with the exact encoding shown in the chart.
 * - Preserve keyboard and screen-reader paths to information that is otherwise available only by
 *   pointer hover.
 * - Avoid mutating API-owned arrays while sorting, grouping, or assigning visualization
 *   coordinates.
 * - Keep provider and model labels canonical through shared formatting helpers.
 * - Snapshot tests should assert stable structure, while focused unit tests own geometry and
 *   derivation edge cases.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/AgentCollaborationNetwork.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/AgentCollaborationNetwork.tsx`
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
 * ## Public surface
 * - `AgentCollaborationNetworkProps` — exported API; see TSDoc on the symbol for behavior.
 * - `AgentCollaborationNetwork` — exported API; see TSDoc on the symbol for behavior.
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
 * **AgentCollaborationNetworkProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AgentCollaborationNetwork**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import { PaginatedLegend } from "../PaginatedLegend";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Props for {@link AgentCollaborationNetwork}. */
export interface AgentCollaborationNetworkProps {
  /** Per-subagent-type statistics; each type becomes a node. */
  effectiveness: Array<{
    subagent_type: string;
    total: number;
    completed: number;
    errors: number;
    sessions: number;
    successRate: number;
  }>;
  /**
   * How often one subagent type was followed by another within a session; each becomes a directed
   * link.
   */
  edges: Array<{ source: string; target: string; weight: number }>;
}

/** One subagent type in the force-directed pipeline graph. */
interface PipelineNode extends d3.SimulationNodeDatum {
  /** Subagent type name. */
  id: string;
  /** Times the type was spawned; drives the node radius. */
  total: number;
  /** Distinct sessions the type appeared in. */
  sessions: number;
  /** Success rate as a percentage. */
  successRate: number;
  /** Index into {@link PALETTE} and {@link STROKE_PALETTE}. */
  colorIndex: number;
}

/** A directed link between two subagent types. */
interface PipelineLink extends d3.SimulationLinkDatum<PipelineNode> {
  /** How many times the transition happened; drives the stroke width. */
  weight: number;
  /** Edge label, for example `3x`. */
  label: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Node fill colors, cycled by node index. */
const PALETTE = [
  "#6366f1",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#ef4444",
  "#14b8a6",
];

/** Node outline colors, the lighter partner of each {@link PALETTE} entry. */
const STROKE_PALETTE = [
  "#818cf8",
  "#60a5fa",
  "#4ade80",
  "#c084fc",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
  "#f87171",
  "#2dd4bf",
];

/** Radius of the least-spawned node. */
const MIN_R = 20;
/** Radius of the most-spawned node. */
const MAX_R = 44;

// ── Safe tooltip DOM builder ──

/**
 * Append a label/value row to the tooltip element.
 *
 * @param parent - Tooltip container.
 * @param label - Row label.
 * @param value - Row value.
 */
function appendTooltipRow(parent: HTMLElement, label: string, value: string) {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;gap:16px;font-size:11px";
  const lbl = document.createElement("span");
  lbl.style.color = "#64748b";
  lbl.textContent = label;
  const val = document.createElement("span");
  val.style.cssText = "color:#cbd5e1;font-weight:500";
  val.textContent = value;
  row.appendChild(lbl);
  row.appendChild(val);
  parent.appendChild(row);
}

/**
 * Append a separated description paragraph to the tooltip element.
 *
 * @param parent - Tooltip container.
 * @param text - Description text.
 */
function appendTooltipDescription(parent: HTMLElement, text: string) {
  const p = document.createElement("p");
  p.style.cssText =
    "font-size:11px;color:#94a3b8;line-height:1.45;margin:8px 0 0;padding-top:8px;border-top:1px solid #2a2a4a";
  p.textContent = text;
  parent.appendChild(p);
}

/** Translation function signature used by the imperative tooltip helpers. */
type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Describe a node's role in plain language for the tooltip, including a health verdict from its
 * success rate: perfect (95% and above), healthy (80%), shaky (50%), or failing.
 *
 * @param d - Node.
 * @param t - Translation function.
 * @returns The description sentence.
 */
function describeNodeRole(d: PipelineNode, t: TFn): string {
  const sr = Math.round(d.successRate);
  let healthKey: string;
  if (sr >= 95) healthKey = "pipeline.tooltip.health.perfect";
  else if (sr >= 80) healthKey = "pipeline.tooltip.health.healthy";
  else if (sr >= 50) healthKey = "pipeline.tooltip.health.shaky";
  else healthKey = "pipeline.tooltip.health.failing";

  return t("pipeline.tooltip.nodeDescFmt", {
    id: d.id,
    total: d.total,
    sessions: d.sessions,
    rate: sr,
    health: t(healthKey),
  });
}

/**
 * Fill and position the tooltip for a hovered node: type, spawn count and share of all spawns,
 * sessions, success rate, and a role description.
 *
 * @param el - Tooltip element; its content is replaced.
 * @param d - Hovered node.
 * @param x - Horizontal position within the container.
 * @param y - Vertical position within the container.
 * @param t - Translation function.
 * @param totalSpawns - Spawns across all types, for the share.
 */
function showTooltip(
  el: HTMLDivElement,
  d: PipelineNode,
  x: number,
  y: number,
  t: TFn,
  totalSpawns: number
) {
  el.textContent = "";

  const title = document.createElement("p");
  title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0 0 2px";
  title.textContent = d.id;
  el.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.style.cssText =
    "font-size:10px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em";
  subtitle.textContent = t("pipeline.tooltip.agentType");
  el.appendChild(subtitle);

  const sharePct = totalSpawns > 0 ? `${((d.total / totalSpawns) * 100).toFixed(1)}%` : "-";

  const rows: [string, string][] = [
    [t("pipeline.spawned"), String(d.total) + t("pipeline.spawns")],
    [t("pipeline.tooltip.shareOfAllSpawns"), sharePct],
    [t("pipeline.inSessions"), String(d.sessions)],
    [t("effectiveness.success"), Math.round(d.successRate) + "%"],
  ];
  for (const [label, value] of rows) {
    appendTooltipRow(el, label, value);
  }

  appendTooltipDescription(el, describeNodeRole(d, t));

  el.style.maxWidth = "320px";
  positionTooltipAt(el, x, y);
}

/**
 * Position a tooltip so its top-right corner sits near (x, y), but clamped to
 * the viewport so it never disappears behind the sidebar or the right edge.
 * Sets opacity to 1 to fade the tooltip in via its CSS transition.
 *
 * @param el - Tooltip element.
 * @param x - Pointer x within the container.
 * @param y - Pointer y within the container.
 */
function positionTooltipAt(el: HTMLDivElement, x: number, y: number) {
  el.style.opacity = "0";
  const w = el.offsetWidth || 280;
  const h = el.offsetHeight || 160;
  const margin = 8;

  // Default: place just below-right of the cursor
  let left = x + 14;
  let top = y + 14;

  if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
  if (left < margin) left = margin;
  if (top + h > window.innerHeight - margin) top = y - h - 14;
  if (top < margin) top = margin;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.transform = "";
  // Trigger fade-in on the next frame for a smooth transition.
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Agent pipeline graph on the Workflows page: a D3 force simulation of subagent types (circles
 * sized by spawn count) linked by curved arrows (thickness by how often one type followed another,
 * with `Nx` labels). Self-loops, duplicates, and links to unknown types are dropped. Hover is
 * handled with direct DOM updates so it never re-renders React. Shows an empty state when there are
 * no nodes or no links.
 */
export function AgentCollaborationNetwork({
  effectiveness,
  edges,
}: AgentCollaborationNetworkProps) {
  const { t } = useTranslation("workflows");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<PipelineNode, PipelineLink> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Memoize so D3 effect only reruns when props change, not on every render
  const { nodes, links, isEmpty } = useMemo(() => {
    const nodeMap = new Map<string, PipelineNode>();
    effectiveness.forEach((item, i) => {
      nodeMap.set(item.subagent_type, {
        id: item.subagent_type,
        total: item.total,
        sessions: item.sessions,
        successRate: item.successRate,
        colorIndex: i % PALETTE.length,
      });
    });

    const seen = new Set<string>();
    const links: PipelineLink[] = [];
    for (const e of edges) {
      if (e.source === e.target) continue;
      if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
      const key = `${e.source}→${e.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        source: e.source,
        target: e.target,
        weight: e.weight,
        label: `${e.weight}x`,
      });
    }

    const nodes = [...nodeMap.values()];
    return { nodes, links, isEmpty: nodes.length === 0 || links.length === 0 };
  }, [effectiveness, edges]);

  // D3 simulation - only depends on memoized data
  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container || isEmpty) return;

    simulationRef.current?.stop();

    const width = container.clientWidth;
    const height = Math.max(450, Math.min(650, width * 0.6));

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;

    const root = d3.select(svg);
    root.selectAll("*").remove();

    // Arrow marker
    const defs = root.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 0 10 6")
      .attr("refX", 10)
      .attr("refY", 3)
      .attr("markerWidth", 8)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L10,3 L0,6 Z")
      .attr("fill", "#64748b");

    // Clone data
    const simNodes = nodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: PipelineLink[] = links.map((l) => ({
      ...l,
      source: nodeById.get(l.source as string) ?? (l.source as string),
      target: nodeById.get(l.target as string) ?? (l.target as string),
    }));

    // Scales
    const ext = d3.extent(simNodes, (n) => n.total) as [number, number];
    const rScale = d3
      .scaleSqrt()
      .domain([Math.max(1, ext[0] ?? 1), Math.max(2, ext[1] ?? 2)])
      .range([MIN_R, MAX_R])
      .clamp(true);

    const wExt = d3.extent(simLinks, (l) => l.weight) as [number, number];
    const strokeScale = d3
      .scaleLinear()
      .domain([Math.max(1, wExt[0] ?? 1), Math.max(2, wExt[1] ?? 2)])
      .range([1.5, 5])
      .clamp(true);

    // ── Links (paths for curves) ──
    const linkGroup = root.append("g");
    const linkEls = linkGroup
      .selectAll<SVGPathElement, PipelineLink>("path")
      .data(simLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#64748b")
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", (d) => Math.max(1.5, strokeScale(d.weight)))
      .attr("marker-end", "url(#arrowhead)");

    // ── Edge labels ──
    const labelGroup = root.append("g");
    const edgeLabels = labelGroup
      .selectAll<SVGTextElement, PipelineLink>("text")
      .data(simLinks)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("font-family", "Inter, sans-serif")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // ── Nodes ──
    const nodeGroup = root.append("g");
    const nodeEls = nodeGroup
      .selectAll<SVGGElement, PipelineNode>("g")
      .data(simNodes, (d) => d.id)
      .join("g")
      .attr("cursor", "grab");

    nodeEls
      .append("circle")
      .attr("r", (d) => rScale(d.total))
      .attr("fill", (d) => PALETTE[d.colorIndex] ?? "#6366f1")
      .attr("fill-opacity", 0.8)
      .attr("stroke", (d) => STROKE_PALETTE[d.colorIndex] ?? "#818cf8")
      .attr("stroke-width", 2);

    nodeEls
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => rScale(d.total) + 14)
      .attr("fill", "#cbd5e1")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("font-family", "Inter, sans-serif")
      .attr("pointer-events", "none")
      .text((d) => (d.id.length > 16 ? d.id.slice(0, 14) + "\u2026" : d.id));

    // ── Invisible wider hit areas for edge hover ──
    const hitGroup = root.append("g");
    const linkHits = hitGroup
      .selectAll<SVGPathElement, PipelineLink>("path")
      .data(simLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 16)
      .attr("cursor", "pointer");

    // ── Hover - pure DOM, zero React re-renders ──
    const tipEl = tooltipRef.current;

    // Edge hover
    const totalSpawns = simNodes.reduce((s, n) => s + n.total, 0);

    linkHits
      .on("mouseenter", (event: MouseEvent, d: PipelineLink) => {
        const src = d.source as PipelineNode;
        const tgt = d.target as PipelineNode;
        // Highlight this edge
        linkEls
          .attr("stroke-opacity", (l) => (l === d ? 1 : 0.1))
          .attr("stroke-width", (l) =>
            l === d ? Math.max(3, strokeScale(l.weight) + 1) : Math.max(1.5, strokeScale(l.weight))
          );
        edgeLabels.attr("fill-opacity", (l) => (l === d ? 1 : 0.15));

        if (tipEl) {
          tipEl.textContent = "";
          const title = document.createElement("p");
          title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0 0 2px";
          title.textContent = `${src.id} \u2192 ${tgt.id}`;
          tipEl.appendChild(title);

          const subtitle = document.createElement("p");
          subtitle.style.cssText =
            "font-size:10px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em";
          subtitle.textContent = t("pipeline.tooltip.edge");
          tipEl.appendChild(subtitle);

          const shareOfSrc = src.total > 0 ? `${((d.weight / src.total) * 100).toFixed(1)}%` : "-";
          const shareOfTgt = tgt.total > 0 ? `${((d.weight / tgt.total) * 100).toFixed(1)}%` : "-";

          const rows: [string, string][] = [
            [t("pipeline.tooltip.sequentialPairs"), `${d.weight}\u00d7`],
            [t("pipeline.tooltip.shareOfSrcFmt", { source: src.id }), shareOfSrc],
            [t("pipeline.tooltip.shareOfTgtFmt", { target: tgt.id }), shareOfTgt],
            [t("pipeline.tooltip.totalSpawnsFmt", { id: src.id }), String(src.total)],
            [t("pipeline.tooltip.totalSpawnsFmt", { id: tgt.id }), String(tgt.total)],
          ];
          for (const [label, value] of rows) {
            appendTooltipRow(tipEl, label, value);
          }

          appendTooltipDescription(
            tipEl,
            t("pipeline.tooltip.edgeDescFmt", {
              source: src.id,
              target: tgt.id,
              count: d.weight,
            })
          );

          tipEl.style.maxWidth = "320px";
          positionTooltipAt(tipEl, event.clientX, event.clientY);
        }
      })
      .on("mouseleave", () => {
        linkEls
          .attr("stroke-opacity", 0.55)
          .attr("stroke-width", (d) => Math.max(1.5, strokeScale(d.weight)));
        edgeLabels.attr("fill-opacity", 1);
        if (tipEl) tipEl.style.opacity = "0";
      });

    // Node hover
    nodeEls
      .on("mouseenter", (event: MouseEvent, d: PipelineNode) => {
        linkEls.attr("stroke-opacity", (l) => {
          const s = (l.source as PipelineNode).id;
          const t = (l.target as PipelineNode).id;
          return s === d.id || t === d.id ? 0.9 : 0.08;
        });
        edgeLabels.attr("fill-opacity", (l) => {
          const s = (l.source as PipelineNode).id;
          const t = (l.target as PipelineNode).id;
          return s === d.id || t === d.id ? 1 : 0.15;
        });
        d3.select(event.currentTarget as SVGGElement)
          .select("circle")
          .attr("stroke-width", 4);
        if (tipEl) showTooltip(tipEl, d, event.clientX, event.clientY, t, totalSpawns);
      })
      .on("mouseleave", () => {
        linkEls.attr("stroke-opacity", 0.55);
        edgeLabels.attr("fill-opacity", 1);
        nodeEls.selectAll("circle").attr("stroke-width", 2);
        if (tipEl) tipEl.style.opacity = "0";
      });

    // ── Drag ──
    const drag = d3
      .drag<SVGGElement, PipelineNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.12).restart();
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
    nodeEls.call(drag);

    // ── Simulation ──
    const simulation = d3
      .forceSimulation<PipelineNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<PipelineNode, PipelineLink>(simLinks)
          .id((d) => d.id)
          .distance(250)
      )
      .force("charge", d3.forceManyBody<PipelineNode>().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<PipelineNode>().radius((d) => rScale(d.total) + 30)
      )
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03))
      .alpha(0.5)
      .on("tick", () => {
        // Clamp nodes inside viewBox
        for (const n of simNodes) {
          const r = rScale(n.total) + 16;
          n.x = Math.max(r, Math.min(width - r, n.x ?? width / 2));
          n.y = Math.max(r, Math.min(height - r, n.y ?? height / 2));
        }

        // Build path for each edge (shared by visible + hit area)
        const pathFor = (d: PipelineLink) => {
          const s = d.source as PipelineNode;
          const t = d.target as PipelineNode;
          const sx = s.x ?? 0,
            sy = s.y ?? 0;
          const tx = t.x ?? 0,
            ty = t.y ?? 0;
          const dx = tx - sx,
            dy = ty - sy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const sr = rScale(s.total);
          const tr = rScale(t.total) + 8;
          const x1 = sx + (dx / dist) * sr;
          const y1 = sy + (dy / dist) * sr;
          const x2 = tx - (dx / dist) * tr;
          const y2 = ty - (dy / dist) * tr;
          const mx = (x1 + x2) / 2 - dy * 0.1;
          const my = (y1 + y2) / 2 + dx * 0.1;
          return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
        };

        linkEls.attr("d", pathFor);
        linkHits.attr("d", pathFor);

        edgeLabels.each(function (d) {
          const s = d.source as PipelineNode;
          const t = d.target as PipelineNode;
          const sx = s.x ?? 0,
            sy = s.y ?? 0,
            tx = t.x ?? 0,
            ty = t.y ?? 0;
          const ddx = tx - sx,
            ddy = ty - sy;
          d3.select(this)
            .attr("x", (sx + tx) / 2 - ddy * 0.1)
            .attr("y", (sy + ty) / 2 + ddx * 0.1 - 4);
        });

        nodeEls.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    simulationRef.current = simulation as d3.Simulation<PipelineNode, PipelineLink>;
    return () => {
      simulation.stop();
    };
  }, [nodes, links, isEmpty, t]);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-gray-400">{t("pipeline.noData")}</p>
        <p className="text-xs text-gray-600 mt-1">{t("pipeline.noDataDesc")}</p>
      </div>
    );
  }

  /**
   * Hide the tooltip when the pointer leaves the chart, in case a node's own leave event was
   * missed.
   */
  const handleContainerLeave = () => {
    const tip = tooltipRef.current;
    if (tip) tip.style.opacity = "0";
  };

  return (
    <div ref={containerRef} className="w-full relative" onMouseLeave={handleContainerLeave}>
      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", background: "transparent" }}
        aria-label={t("pipeline.ariaLabel")}
        role="img"
        onMouseLeave={handleContainerLeave}
      />
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden="true"
        className="fixed z-50 px-3 py-2 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl pointer-events-none"
        style={{
          opacity: 0,
          left: 0,
          top: 0,
          minWidth: 172,
          transition: "opacity 120ms ease-out",
        }}
      />
      <div className="mt-3 px-1">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-600">
            {t("pipeline.legend")}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <svg width="20" height="8" className="flex-shrink-0">
              <line x1="0" y1="4" x2="14" y2="4" stroke="#64748b" strokeWidth="1.5" />
              <polygon points="14,1 20,4 14,7" fill="#64748b" />
            </svg>
            <span className="text-[11px] text-gray-500">{t("pipeline.legendDesc")}</span>
          </div>
        </div>
        <PaginatedLegend
          items={nodes}
          pageSize={8}
          getKey={(node) => node.id}
          listClassName="flex flex-wrap items-center gap-x-4 gap-y-2"
          renderItem={(node) => (
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: PALETTE[node.colorIndex] ?? PALETTE[0],
                  border: `1.5px solid ${STROKE_PALETTE[node.colorIndex] ?? STROKE_PALETTE[0]}`,
                }}
              />
              <span className="max-w-40 truncate text-[11px] text-gray-500" title={node.id}>
                {node.id}
              </span>
            </div>
          )}
        />
      </div>
    </div>
  );
}
