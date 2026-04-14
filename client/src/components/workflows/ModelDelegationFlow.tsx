/**
 * @file ModelDelegationFlow.tsx
 * @description Defines the ModelDelegationFlow React component that visualizes the relationships between main models and subagent models in a flow diagram using D3.js. The component takes model delegation data as input and renders an SVG diagram that shows how different models are connected based on their usage in agents and sessions. It categorizes models into families (opus, sonnet, haiku, other) for color-coding and provides a clear visual representation of model delegation patterns.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { ModelDelegationData } from "../../lib/types";

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

function shortModelName(name: string): string {
  // Strip vendor prefix like "claude-" and shorten
  return name
    .replace(/^claude-/i, "")
    .replace(/-\d{8}$/, "") // strip date suffixes
    .replace(/-latest$/i, "");
}

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
  t: (key: string, options?: Record<string, unknown>) => string
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
    const ng = g.append("g").attr("transform", `translate(${node.x},${node.y})`);

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
      .text(shortModelName(node.label));

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

  const hasData = data.mainModels.length > 0 || data.subagentModels.length > 0;

  useEffect(() => {
    if (!svgRef.current || !hasData) return;

    const tokenMap = new Map<string, number>();
    data.tokensByModel.forEach(({ model, input_tokens, output_tokens }) => {
      tokenMap.set(model, (tokenMap.get(model) ?? 0) + input_tokens + output_tokens);
    });

    const mainNodes: NodeDatum[] = data.mainModels.map((m, i) => ({
      id: `main-${m.model}`,
      label: m.model,
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
      label: m.model,
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

    renderFlow(svgRef.current, mainNodes, subNodes, edges, t);
  }, [data, hasData, t]);

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
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: 120 }}
        aria-label={t("modelDelegation.ariaLabel")}
        role="img"
      />
    </div>
  );
}
