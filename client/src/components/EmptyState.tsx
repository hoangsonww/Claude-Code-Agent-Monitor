/**
 * @file EmptyState.tsx
 * @description A reusable React component that displays an empty state with an icon, title, description, and an optional action. It is designed to be used across the application whenever there is no data to show or when a user needs guidance on what to do next.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-4 flex items-center justify-center mb-5">
        <Icon className="w-6 h-6 text-gray-500" />
      </div>
      <h3 className="text-base font-medium text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}
