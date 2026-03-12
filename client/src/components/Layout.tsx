import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  wsConnected: boolean;
}

export function Layout({ wsConnected }: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface-0">
      <Sidebar wsConnected={wsConnected} />
      <main className="ml-60 min-h-screen min-w-0 w-[calc(100%-15rem)]">
        <div className="p-8 max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
