/**
 * @file MUI v9 dark theme matching the dashboard's existing palette.
 * Without this, MUI components in the Launcher/Composer/Settings-Profiles
 * surfaces render with the light-mode default — invisible against the
 * dashboard's #0c0c14 background.
 *
 * Colors mirror MobileShell.module.css and index.css so the MUI surfaces
 * blend with the rest of the lucide-react UI rather than fighting it.
 */
import { createTheme } from "@mui/material/styles";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0c0c14",  // root canvas (matches MobileShell)
      paper: "#15151f",    // surfaces — accordions, paper, popovers
    },
    text: {
      primary: "#e4e4ed",
      secondary: "#9999b3",
    },
    divider: "#2a2a3d",
    primary: {
      main: "#7c8cff",     // accent (Send button, focus ring)
    },
    warning: {
      main: "#f5b94d",     // Stop button, dangerous-flag banner
    },
    error: {
      main: "#ff7575",
    },
  },
  shape: { borderRadius: 6 },
  components: {
    // Keep MUI surfaces flush with the dashboard's existing dark CSS
    // (no full background reset; just per-component theming).
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",  // disable MUI v9's elevation tint
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: "#2a2a3d",
          color: "#e4e4ed",
        },
      },
    },
  },
});
