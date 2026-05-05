/**
 * @file BottomTabNav.tsx
 * @description Fixed bottom tab bar shown on mobile viewports. Renders four
 *   primary destinations (Dashboard, Sessions, Chat, Settings) using
 *   react-router's `NavLink` for active styling. Inline SVG icons keep the
 *   bundle free of additional icon library dependencies.
 */

import { NavLink } from "react-router-dom";
import styles from "./MobileShell.module.css";

interface TabDef {
  to: string;
  label: string;
  /** When true, only highlight when the path matches exactly. */
  end?: boolean;
  icon: React.ReactNode;
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

const TABS: TabDef[] = [
  { to: "/", label: "Dashboard", end: true, icon: <DashboardIcon /> },
  { to: "/sessions", label: "Sessions", icon: <SessionsIcon /> },
  { to: "/chat", label: "Chat", icon: <ChatIcon /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

/**
 * Fixed bottom navigation bar for mobile viewports. Each tab is a `NavLink`,
 * so react-router applies the `aria-current="page"` attribute and an
 * `active` class name automatically, which we map to bolder text and an
 * accent color in the accompanying CSS module.
 */
export function BottomTabNav() {
  return (
    <nav
      className={styles.tabBar}
      role="navigation"
      aria-label="Primary"
    >
      {TABS.map((tab) => (
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
    </nav>
  );
}
