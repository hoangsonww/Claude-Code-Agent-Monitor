/**
 * @file DocumentTitle.tsx
 * @description Route-aware document title setter nested under BrowserRouter so
 * `useLocation` works. Keeps multi-tab window switchers readable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * Maps the current pathname to a localized browser tab title.
 */
export function DocumentTitle() {
  const { t } = useTranslation("nav");
  const location = useLocation();

  let title = t("dashboard");
  const path = location.pathname;
  const sessionId = path.match(/^\/sessions\/([^/]+)/)?.[1];

  if (sessionId) {
    title = `${t("sessions")} · ${sessionId.slice(0, 8)}`;
  } else if (path.startsWith("/sessions")) {
    title = t("sessions");
  } else if (path.startsWith("/kanban")) {
    title = t("agentBoard");
  } else if (path.startsWith("/activity")) {
    title = t("activityFeed");
  } else if (path.startsWith("/analytics")) {
    title = t("analytics");
  } else if (path.startsWith("/workflows")) {
    title = t("workflows");
  } else if (path.startsWith("/cc-config")) {
    title = t("ccConfig");
  } else if (path.startsWith("/run")) {
    title = t("run");
  } else if (path.startsWith("/settings")) {
    title = t("settings");
  } else if (path !== "/") {
    title = t("notFound");
  }

  useDocumentTitle(title);
  return null;
}
