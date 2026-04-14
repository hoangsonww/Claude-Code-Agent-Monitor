/**
 * @file Tip.tsx
 * @description A reusable React component that displays a tooltip with custom content when the user hovers over the wrapped children. The tooltip is positioned above the children and can display any string content passed as the `raw` prop. If no `raw` prop is provided, it simply renders the children without any tooltip functionality. This component is designed to be used across the application wherever there is a need to show additional information on hover without cluttering the UI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useState } from "react";

export function Tip({ raw, children }: { raw?: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  if (!raw) return <>{children}</>;
  return (
    <span
      className="relative inline-block cursor-default"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs font-mono text-gray-100 bg-gray-800 border border-gray-700 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {raw}
        </span>
      )}
    </span>
  );
}
