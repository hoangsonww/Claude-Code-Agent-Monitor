/**
 * @file AgentCollaborationNetwork.tsx
 * @description Defines the AgentCollaborationNetwork React component that visualizes the collaboration between different agent types in a directed graph format using D3.js. The component takes in effectiveness data for each agent type and the edges representing their interactions, and renders an interactive force-directed graph where nodes represent agent types and edges represent the frequency of sequential runs. The graph includes tooltips for detailed information on hover and a legend for clarity.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgentCollaborationNetworkProps {
  effectiveness: Array<{
    subagent_type: string;
    total: number;
    completed: number;
    errors: number;
    sessions: number;
    successRate: number;
  }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}

interface PipelineNode extends d3.SimulationNodeDatum {
  id: string;
  total: number;
  sessions: number;
  successRate: number;
  colorIndex: number;
}

interface PipelineLink extends d3.SimulationLinkDatum<PipelineNode> {
  weight: number;
  label: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

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

const MIN_R = 20;
const MAX_R = 44;

// ── Safe tooltip DOM builder ──

function showTooltip(el: HTMLDivElement, d: PipelineNode, x: number, y: number) {
  el.textContent = "";

  const title = document.createElement("p");
  title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0 0 6px";
  title.textContent = d.id;
  el.appendChild(title);

  const rows: [string, string][] = [
    ["Spawned", String(d.total) + " times"],
    ["In sessions", String(d.sessions)],
    ["Success", Math.round(d.successRate) + "%"],
  ];
  for (const [label, value] of rows) {
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
    el.appendChild(row);
  }

  el.style.display = "block";
  const nearRight = x > window.innerWidth - 220;
  el.style.left = nearRight ? `${x - 16}px` : `${x + 16}px`;
  el.style.top = `${y - 8}px`;
  el.style.transform = nearRight ? "translateX(-100%)" : "";
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AgentCollaborationNetwork({
  effectiveness,
  edges,
}: AgentCollaborationNetworkProps) {
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

  // D3 simulation — only depends on memoized data
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

    // ── Hover — pure DOM, zero React re-renders ──
    const tipEl = tooltipRef.current;

    // Edge hover
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
          title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0 0 6px";
          title.textContent = `${src.id} \u2192 ${tgt.id}`;
          tipEl.appendChild(title);

          const rows: [string, string][] = [
            ["Frequency", `${d.weight} times`],
            ["Meaning", `${tgt.id} ran after ${src.id}`],
            [src.id + " total", `${src.total} spawns`],
            [tgt.id + " total", `${tgt.total} spawns`],
          ];
          for (const [label, value] of rows) {
            const row = document.createElement("div");
            row.style.cssText =
              "display:flex;justify-content:space-between;gap:16px;font-size:11px";
            const lbl = document.createElement("span");
            lbl.style.color = "#64748b";
            lbl.textContent = label;
            const val = document.createElement("span");
            val.style.cssText = "color:#cbd5e1;font-weight:500";
            val.textContent = value;
            row.appendChild(lbl);
            row.appendChild(val);
            tipEl.appendChild(row);
          }

          tipEl.style.display = "block";
          const nearRight = event.clientX > window.innerWidth - 260;
          tipEl.style.left = nearRight ? `${event.clientX - 16}px` : `${event.clientX + 16}px`;
          tipEl.style.top = `${event.clientY - 8}px`;
          tipEl.style.transform = nearRight ? "translateX(-100%)" : "";
        }
      })
      .on("mousemove", (event: MouseEvent) => {
        if (tipEl) {
          tipEl.style.left = `${event.clientX + 16}px`;
          tipEl.style.top = `${event.clientY - 8}px`;
        }
      })
      .on("mouseleave", () => {
        linkEls
          .attr("stroke-opacity", 0.55)
          .attr("stroke-width", (d) => Math.max(1.5, strokeScale(d.weight)));
        edgeLabels.attr("fill-opacity", 1);
        if (tipEl) tipEl.style.display = "none";
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
        if (tipEl) showTooltip(tipEl, d, event.clientX, event.clientY);
      })
      .on("mousemove", (event: MouseEvent) => {
        if (tipEl) {
          tipEl.style.left = `${event.clientX + 16}px`;
          tipEl.style.top = `${event.clientY - 8}px`;
        }
      })
      .on("mouseleave", () => {
        linkEls.attr("stroke-opacity", 0.55);
        edgeLabels.attr("fill-opacity", 1);
        nodeEls.selectAll("circle").attr("stroke-width", 2);
        if (tipEl) tipEl.style.display = "none";
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
  }, [nodes, links, isEmpty]);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-gray-400">No pipeline data yet</p>
        <p className="text-xs text-gray-600 mt-1">
          Directed workflow edges appear once agent types run sequentially across multiple sessions.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full relative">
      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", background: "transparent" }}
        aria-label="Agent pipeline graph"
        role="img"
      />
      <div
        ref={tooltipRef}
        className="fixed z-50 px-3 py-2 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl pointer-events-none"
        style={{ display: "none", minWidth: 172 }}
      />
      <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
        <span className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">
          Legend
        </span>
        {nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: PALETTE[n.colorIndex] ?? PALETTE[0],
                border: `1.5px solid ${STROKE_PALETTE[n.colorIndex] ?? STROKE_PALETTE[0]}`,
              }}
            />
            <span className="text-[11px] text-gray-500">{n.id}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <svg width="20" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="14" y2="4" stroke="#64748b" strokeWidth="1.5" />
            <polygon points="14,1 20,4 14,7" fill="#64748b" />
          </svg>
          <span className="text-[11px] text-gray-500">A runs before B (labeled count)</span>
        </div>
      </div>
    </div>
  );
}
