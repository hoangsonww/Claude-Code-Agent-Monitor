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
