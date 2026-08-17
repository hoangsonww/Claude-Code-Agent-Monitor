/**
 * @file ModelDelegationFlow.tsx
 * @description Defines the ModelDelegationFlow React component that visualizes the relationships between main models and subagent models in a flow diagram using D3.js. The component takes model delegation data as input and renders an SVG diagram that shows how different models are connected based on their usage in agents and sessions. It categorizes models into families (opus, sonnet, haiku, other) for color-coding and provides a clear visual representation of model delegation patterns.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/ModelDelegationFlow.tsx`
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
 * - `../../lib/format`
 *
 * ## Public surface
 * - `ModelDelegationFlowProps` — exported API; see TSDoc on the symbol for behavior.
 * - `ModelDelegationFlow` — exported API; see TSDoc on the symbol for behavior.
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
 * **ModelDelegationFlowProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ModelDelegationFlow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { ModelDelegationData } from "../../lib/types";
import { formatModelName } from "../../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function modelFamily(name: string): "opus" | "sonnet" | "haiku" | "other" {
  const lower = name.toLowerCase();
  if (lower.includes("opus")) return "opus";
  if (lower.includes("sonnet")) return "sonnet";
  if (lower.includes("haiku")) return "haiku";
  return "other";
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// Model formatting is handled by the shared formatModelName utility.

// ── Color palette per model family ───────────────────────────────────────────

const FAMILY_COLORS = {
  opus: {
    grad: ["#7c3aed", "#a855f7"] as [string, string],
    stroke: "#a855f7",
    text: "#e9d5ff",
    badge: "rgba(168,85,247,0.15)",
  },
  sonnet: {
    grad: ["#1d4ed8", "#3b82f6"] as [string, string],
    stroke: "#3b82f6",
    text: "#bfdbfe",
    badge: "rgba(59,130,246,0.15)",
  },
  haiku: {
    grad: ["#065f46", "#10b981"] as [string, string],
    stroke: "#10b981",
    text: "#a7f3d0",
    badge: "rgba(16,185,129,0.15)",
  },
  other: {
    grad: ["#374151", "#6b7280"] as [string, string],
    stroke: "#6b7280",
    text: "#d1d5db",
    badge: "rgba(107,114,128,0.15)",
  },
} as const;

// ── Types used internally ─────────────────────────────────────────────────────

interface NodeDatum {
  id: string;
  label: string;
  family: "opus" | "sonnet" | "haiku" | "other";
  agentCount: number;
  sessionCount: number;
  totalTokens: number;
  side: "main" | "sub";
  x: number;
  y: number;
}

interface EdgeDatum {
  sourceId: string;
  targetId: string;
}

type ShowTipFn = (node: NodeDatum, anchor: SVGGraphicsElement) => void;
type HideTipFn = () => void;

// ── D3 chart renderer ─────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 80;
const NODE_RX = 10;
const COL_GAP = 200;
const ROW_GAP = 108;
const PADDING = { top: 40, left: 24, right: 24, bottom: 24 };

function renderFlow(
  svg: SVGSVGElement,
  mainNodes: NodeDatum[],
  subNodes: NodeDatum[],
  edges: EdgeDatum[],
  t: (key: string, options?: Record<string, unknown>) => string,
  showTip: ShowTipFn,
  hideTip: HideTipFn
): void {
  const allNodes = [...mainNodes, ...subNodes];

  const totalRows = Math.max(mainNodes.length, subNodes.length);
  const chartH = totalRows * ROW_GAP + PADDING.top + PADDING.bottom;
  const chartW = NODE_W * 2 + COL_GAP + PADDING.left + PADDING.right;

  const root = d3.select(svg);
  root.selectAll("*").remove();
  root.attr("viewBox", `0 0 ${chartW} ${chartH}`).attr("preserveAspectRatio", "xMidYMid meet");

  const defs = root.append("defs");

  // Gradient defs per family
  (["opus", "sonnet", "haiku", "other"] as const).forEach((fam) => {
    const colors = FAMILY_COLORS[fam];
    const grad = defs
      .append("linearGradient")
      .attr("id", `flow-grad-${fam}`)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", colors.grad[0]);
    grad.append("stop").attr("offset", "100%").attr("stop-color", colors.grad[1]);
  });

  const g = root.append("g");

  // Column labels
  const labelY = PADDING.top - 16;
  g.append("text")
    .attr("x", PADDING.left + NODE_W / 2)
    .attr("y", labelY)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 11)
    .attr("font-family", "Inter, sans-serif")
    .attr("letter-spacing", "0.08em")
    .text(t("modelDelegation.mainModels"));

  g.append("text")
    .attr("x", PADDING.left + NODE_W + COL_GAP + NODE_W / 2)
    .attr("y", labelY)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 11)
    .attr("font-family", "Inter, sans-serif")
    .attr("letter-spacing", "0.08em")
    .text(t("modelDelegation.subagentModels"));

  // Build lookup for node positions
  const nodeMap = new Map<string, NodeDatum>(allNodes.map((n) => [n.id, n]));

  // Draw edges (cubic bezier curves)
  edges.forEach(({ sourceId, targetId }) => {
    const src = nodeMap.get(sourceId);
    const tgt = nodeMap.get(targetId);
    if (!src || !tgt) return;

    const x1 = src.x + NODE_W;
    const y1 = src.y + NODE_H / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + NODE_H / 2;
    const cx = (x1 + x2) / 2;

    g.append("path")
      .attr("d", `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`)
      .attr("fill", "none")
      .attr("stroke", "#2a2a3d")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.7);
  });

  // Draw nodes
  allNodes.forEach((node) => {
    const colors = FAMILY_COLORS[node.family];
    const ng = g
      .append("g")
      .attr("transform", `translate(${node.x},${node.y})`)
      .style("cursor", "default")
      .on("mouseenter", function () {
        showTip(node, this as SVGGraphicsElement);
      })
      .on("mouseleave", () => hideTip());

    // Border glow rect (slightly larger)
    ng.append("rect")
      .attr("x", -1)
      .attr("y", -1)
      .attr("width", NODE_W + 2)
      .attr("height", NODE_H + 2)
      .attr("rx", NODE_RX + 1)
      .attr("fill", "none")
      .attr("stroke", colors.stroke)
      .attr("stroke-width", 1)
      .attr("opacity", 0.25);

    // Main rect with gradient
    ng.append("rect")
      .attr("width", NODE_W)
      .attr("height", NODE_H)
      .attr("rx", NODE_RX)
      .attr("fill", `url(#flow-grad-${node.family})`)
      .attr("fill-opacity", 0.18)
      .attr("stroke", colors.stroke)
      .attr("stroke-width", 1);

    // Model name
    ng.append("text")
      .attr("x", 12)
      .attr("y", 22)
      .attr("fill", colors.text)
      .attr("font-size", 11)
      .attr("font-weight", "600")
      .attr("font-family", "Inter, sans-serif")
      .text(formatModelName(node.label) ?? node.label);

    // Agent count pill
    ng.append("rect")
      .attr("x", 10)
      .attr("y", 32)
      .attr("width", 64)
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", colors.badge);

    ng.append("text")
      .attr("x", 42)
      .attr("y", 43.5)
      .attr("text-anchor", "middle")
      .attr("fill", colors.text)
      .attr("font-size", 9.5)
      .attr("font-family", "Inter, sans-serif")
      .text(t("modelDelegation.agentsCount", { count: node.agentCount }));

    // Token count
    if (node.totalTokens > 0) {
      ng.append("text")
        .attr("x", 12)
        .attr("y", 66)
        .attr("fill", "#6b7280")
        .attr("font-size", 9.5)
        .attr("font-family", "Inter, sans-serif")
        .text(t("modelDelegation.tokensCount", { tokens: fmtTokens(node.totalTokens) }));
    }

    // Session count (main nodes only)
    if (node.side === "main" && node.sessionCount > 0) {
      ng.append("text")
        .attr("x", NODE_W - 10)
        .attr("y", 66)
        .attr("text-anchor", "end")
        .attr("fill", "#6b7280")
        .attr("font-size", 9.5)
        .attr("font-family", "Inter, sans-serif")
        .text(t("modelDelegation.sessionsCount", { count: node.sessionCount }));
    }
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ModelDelegationFlowProps {
  data: ModelDelegationData;
}

export function ModelDelegationFlow({ data }: ModelDelegationFlowProps) {
  const { t } = useTranslation("workflows");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const hasData = data.mainModels.length > 0 || data.subagentModels.length > 0;
  const totalAgents = countTotalAgents(data);

  const hideTip = useCallback(() => {
    const tip = tipRef.current;
    if (tip) tip.style.opacity = "0";
  }, []);

  const showTip = useCallback(
    (node: NodeDatum, anchor: SVGGraphicsElement) => {
      const tip = tipRef.current;
      if (!tip) return;
      buildModelDelegationTooltip(tip, node, totalAgents, t);
      const r = anchor.getBoundingClientRect();
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
    [totalAgents, t]
  );

  useEffect(() => {
    if (!svgRef.current || !hasData) return;

    const tokenMap = new Map<string, number>();
    data.tokensByModel.forEach(({ model, input_tokens, output_tokens }) => {
      tokenMap.set(model, (tokenMap.get(model) ?? 0) + input_tokens + output_tokens);
    });

    const mainNodes: NodeDatum[] = data.mainModels.map((m, i) => ({
      id: `main-${m.model}`,
      label: formatModelName(m.model) ?? m.model,
      family: modelFamily(m.model),
      agentCount: m.agent_count,
      sessionCount: m.session_count,
      totalTokens: tokenMap.get(m.model) ?? 0,
      side: "main",
      x: PADDING.left,
      y: PADDING.top + i * ROW_GAP,
    }));

    const subNodes: NodeDatum[] = data.subagentModels.map((m, i) => ({
      id: `sub-${m.model}`,
      label: formatModelName(m.model) ?? m.model,
      family: modelFamily(m.model),
      agentCount: m.agent_count,
      sessionCount: 0,
      totalTokens: tokenMap.get(m.model) ?? 0,
      side: "sub",
      x: PADDING.left + NODE_W + COL_GAP,
      y: PADDING.top + i * ROW_GAP,
    }));

    // Connect all main models to all subagent models that share a family, or all if no match
    const edges: EdgeDatum[] = [];
    mainNodes.forEach((mn) => {
      subNodes.forEach((sn) => {
        edges.push({ sourceId: mn.id, targetId: sn.id });
      });
    });

    renderFlow(svgRef.current, mainNodes, subNodes, edges, t, showTip, hideTip);
    hideTip();
  }, [data, hasData, t, showTip, hideTip]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span className="text-sm">{t("modelDelegation.noData")}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-x-auto relative" onMouseLeave={hideTip}>
      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: 120 }}
        aria-label={t("modelDelegation.ariaLabel")}
        role="img"
      />
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

// ── Tooltip helpers ───────────────────────────────────────────────────────────

function countTotalAgents(data: ModelDelegationData): number {
  const mainSum = data.mainModels.reduce((s, m) => s + m.agent_count, 0);
  const subSum = data.subagentModels.reduce((s, m) => s + m.agent_count, 0);
  return mainSum + subSum;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function describeFamily(family: NodeDatum["family"], t: TFn): string {
  switch (family) {
    case "opus":
      return t("modelDelegation.tooltip.family.opus");
    case "sonnet":
      return t("modelDelegation.tooltip.family.sonnet");
    case "haiku":
      return t("modelDelegation.tooltip.family.haiku");
    case "other":
      return t("modelDelegation.tooltip.family.other");
  }
}

function buildModelDelegationTooltip(
  el: HTMLDivElement,
  node: NodeDatum,
  totalAgents: number,
  t: TFn
) {
  while (el.firstChild) el.removeChild(el.firstChild);

  const sharePct = totalAgents > 0 ? `${((node.agentCount / totalAgents) * 100).toFixed(1)}%` : "-";
  const sideLabel =
    node.side === "main"
      ? t("modelDelegation.tooltip.mainModel")
      : t("modelDelegation.tooltip.subagentModel");

  const title = document.createElement("p");
  title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0";
  title.textContent = node.label;
  el.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.style.cssText =
    "font-size:10px;color:#64748b;margin:2px 0 8px;text-transform:uppercase;letter-spacing:0.05em";
  subtitle.textContent = `${sideLabel} · ${node.family}`;
  el.appendChild(subtitle);

  const addRow = (label: string, value: string) => {
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
    el.appendChild(row);
  };

  addRow(t("modelDelegation.tooltip.agentRuns"), node.agentCount.toLocaleString());
  addRow(t("modelDelegation.tooltip.shareOfAll"), sharePct);
  if (node.side === "main") {
    addRow(t("modelDelegation.tooltip.sessionsOnModel"), String(node.sessionCount));
  }
  addRow(t("modelDelegation.tooltip.totalTokens"), node.totalTokens.toLocaleString());

  const desc = document.createElement("p");
  desc.style.cssText =
    "font-size:11px;color:#94a3b8;line-height:1.45;border-top:1px solid #2a2a4a;padding-top:8px;margin:8px 0 0";
  desc.textContent = describeFamily(node.family, t);
  el.appendChild(desc);

  const hint = document.createElement("p");
  hint.style.cssText = "font-size:11px;color:#64748b;line-height:1.45;margin:6px 0 0";
  hint.textContent =
    node.side === "main"
      ? t("modelDelegation.tooltip.lines.main")
      : t("modelDelegation.tooltip.lines.sub");
  el.appendChild(hint);
}
