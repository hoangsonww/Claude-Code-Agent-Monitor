/**
 * @file StatCard.tsx
 * @description A reusable React component that displays a statistic with a label, value, icon, and optional trend information. It is designed to be used in dashboards or analytics pages to present key metrics in a visually appealing way. The component also supports showing raw values as tooltips on hover for more detailed information.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { LucideIcon } from "lucide-react";
import { Tip } from "./Tip";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  accentColor?: string;
  /** Raw value shown as custom tooltip on hover */
  raw?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accentColor = "text-accent",
  raw,
}: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
          {label}
        </span>
        <Icon className={`w-5 h-5 flex-shrink-0 ${accentColor}`} />
      </div>
      <div className="flex items-end gap-2 min-w-0">
        <Tip raw={raw}>
          <span className="text-2xl font-semibold text-gray-100 truncate">{value}</span>
        </Tip>
        {trend && <span className="text-xs text-gray-500 mb-1 flex-shrink-0">{trend}</span>}
      </div>
    </div>
  );
}
