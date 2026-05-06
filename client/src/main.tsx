/**
 * @file main.tsx
 * @description The entry point of the React application that renders the main App component into the root DOM element. It uses React's StrictMode for highlighting potential problems in the application and ensures that the app is rendered in a way that adheres to best practices.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ThemeProvider } from "@mui/material/styles";
import App from "./App";
import { darkTheme } from "./lib/mui-theme";
import "./i18n";
import "./index.css";

const updateSW = registerSW({
  onNeedRefresh() {
    // Silently apply updates so the SPA stays in sync without disrupting users.
    updateSW(true);
  },
  onOfflineReady() {
    console.log("[PWA] App ready to work offline");
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={darkTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
