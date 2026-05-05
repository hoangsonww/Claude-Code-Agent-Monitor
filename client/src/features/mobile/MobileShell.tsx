/**
 * @file MobileShell.tsx
 * @description Top-level wrapper that swaps between the existing desktop
 *   chrome and a mobile-optimized bottom-tab layout based on the viewport.
 *   Designed so `App.tsx` can render `<MobileShell desktopShell={<Layout/>} />`
 *   without changing routing — the React Router `<Outlet />` is rendered
 *   inside whichever shell is active.
 */

import { Outlet } from "react-router-dom";
import { BottomTabNav } from "./BottomTabNav";
import { useMediaQuery, MOBILE_BREAKPOINT } from "./useMediaQuery";
import styles from "./MobileShell.module.css";

interface MobileShellProps {
  /**
   * The existing desktop layout (typically `<Layout />`). Rendered as-is when
   * the viewport is wider than the mobile breakpoint. The desktop shell is
   * expected to render its own `<Outlet />`.
   */
  desktopShell: React.ReactNode;
}

/**
 * Renders `desktopShell` on wide viewports and a mobile shell with a fixed
 * bottom tab nav on narrow viewports. The mobile shell renders an `<Outlet />`
 * so the same route tree continues to work without changes.
 */
export function MobileShell({ desktopShell }: MobileShellProps) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

  if (!isMobile) {
    return <>{desktopShell}</>;
  }

  return (
    <div className={styles.mobile}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <BottomTabNav />
    </div>
  );
}
