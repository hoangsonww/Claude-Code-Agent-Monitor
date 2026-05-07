/**
 * @file BottomTabNav.tsx
 * @description Fixed bottom tab bar shown on mobile viewports. Surfaces the
 *   primary destinations directly and exposes the remainder of the desktop
 *   sidebar through a "More" sheet so every page reachable on desktop is
 *   reachable on mobile.
 *
 *   Routines is gated behind the orchestrator feature flag — it appears as a
 *   primary tab when the flag is on, and is omitted entirely when off (same
 *   policy as the desktop Sidebar).
 *
 *   Inline SVG icons keep the bundle free of additional icon-library
 *   dependencies in this leaf component, even though the rest of the app
 *   uses lucide-react. Existing icons are preserved verbatim from the prior
 *   four-tab version; new icons follow the same 24×24 viewBox convention.
 */

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useOrchestratorEnabled } from "../../hooks/useOrchestratorEnabled";
import styles from "./MobileShell.module.css";

interface TabDef {
  to: string;
  label: string;
  /** When true, only highlight when the path matches exactly. */
  end?: boolean;
  icon: React.ReactNode;
  /** When set, the entry only renders if the matching feature flag is on. */
  flag?: "orchestrator";
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const DashboardIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const SessionsIcon = () => (
  <svg {...iconProps}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h10" />
  </svg>
);

const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09c0 .67.4 1.27 1.04 1.51a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87c.24.64.84 1.04 1.51 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.04z" />
  </svg>
);

const LauncherIcon = () => (
  <svg {...iconProps}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const RoutinesIcon = () => (
  // Lightning bolt — matches Lucide `Zap` used in the desktop Sidebar.
  <svg {...iconProps}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const KanbanIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="6" height="18" rx="1" />
    <rect x="11" y="3" width="6" height="12" rx="1" />
    <rect x="19" y="3" width="2" height="8" rx="1" />
  </svg>
);

const ActivityIcon = () => (
  <svg {...iconProps}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg {...iconProps}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const WorkflowsIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="15" width="6" height="6" rx="1" />
    <path d="M9 6h6a3 3 0 0 1 3 3v6" />
  </svg>
);

const MoreIcon = () => (
  <svg {...iconProps}>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const PRIMARY_TABS: TabDef[] = [
  { to: "/", label: "Dashboard", end: true, icon: <DashboardIcon /> },
  { to: "/sessions", label: "Sessions", icon: <SessionsIcon /> },
  { to: "/chat", label: "Chat", icon: <ChatIcon /> },
  { to: "/routines", label: "Routines", icon: <RoutinesIcon />, flag: "orchestrator" },
];

// Items rendered in the More sheet, in the same order as the desktop Sidebar
// so users who alternate between desktop and mobile see consistent placement.
const MORE_ITEMS: TabDef[] = [
  { to: "/kanban", label: "Kanban Board", icon: <KanbanIcon /> },
  { to: "/activity", label: "Activity Feed", icon: <ActivityIcon /> },
  { to: "/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
  { to: "/workflows", label: "Workflows", icon: <WorkflowsIcon /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon /> },
  { to: "/launcher", label: "Launcher", icon: <LauncherIcon /> },
];

interface MoreSheetProps {
  items: TabDef[];
  onClose: () => void;
}

/**
 * Slide-up sheet rendered above the tab bar when the More tab is tapped.
 * Tapping the backdrop or any link dismisses it. Locks body scroll while open
 * so the underlying page doesn't move under the user's finger.
 */
function MoreSheet({ items, onClose }: MoreSheetProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on ESC for keyboard / external-keyboard users on iPad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.moreOverlay} role="dialog" aria-modal="true" aria-label="More navigation">
      <button
        type="button"
        className={styles.moreBackdrop}
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className={styles.moreSheet}>
        <div className={styles.moreHandle} aria-hidden="true" />
        <h2 className={styles.moreTitle}>Navigation</h2>
        <ul className={styles.moreList}>
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? `${styles.moreItem} ${styles.moreItemActive}` : styles.moreItem
                }
              >
                <span className={styles.moreItemIcon}>{item.icon}</span>
                <span className={styles.moreItemLabel}>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Fixed bottom navigation bar for mobile viewports. Renders primary tabs plus
 * a "More" trigger that opens a sheet with the remaining sidebar destinations
 * so every desktop page is reachable on mobile.
 */
export function BottomTabNav() {
  const orchestratorEnabled = useOrchestratorEnabled();
  const [moreOpen, setMoreOpen] = useState(false);

  const visiblePrimary = PRIMARY_TABS.filter((t) =>
    t.flag === "orchestrator" ? orchestratorEnabled : true,
  );
  // When the orchestrator flag is off, Routines is dropped from primary AND
  // the More sheet — matching the desktop Sidebar's hide-everything policy.
  const moreItems = MORE_ITEMS;
  // CSS uses an inline custom property so the grid stays exactly N columns
  // for the visible tabs (primary + the More button) — no auto-row wrap.
  const tabCount = visiblePrimary.length + 1;

  return (
    <>
      <nav
        className={styles.tabBar}
        role="navigation"
        aria-label="Primary"
        style={{ ["--tab-count" as never]: String(tabCount) }}
      >
        {visiblePrimary.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
            }
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`${styles.tab} ${styles.tabButton}${moreOpen ? ` ${styles.tabActive}` : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="bottom-nav-more"
        >
          <span className={styles.tabIcon}>
            <MoreIcon />
          </span>
          <span className={styles.tabLabel}>More</span>
        </button>
      </nav>
      {moreOpen && <MoreSheet items={moreItems} onClose={() => setMoreOpen(false)} />}
    </>
  );
}
