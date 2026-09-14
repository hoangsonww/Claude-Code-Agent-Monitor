/**
 * @file SplashScreen.test.tsx
 * @description Verifies provider-aware onboarding skips setup for ready
 * selections and offers installation only for selected providers whose
 * dashboard hooks are missing.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SplashScreen } from "../SplashScreen";
import { api } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  api: {
    settings: {
      info: vi.fn(),
      installHooks: vi.fn(),
    },
  },
}));

const info = vi.mocked(api.settings.info);
const installHooks = vi.mocked(api.settings.installHooks);

function hookInfo(claudeInstalled: boolean, codexInstalled: boolean) {
  return {
    hooks: {
      installed: claudeInstalled || codexInstalled,
      path: "~/.claude/settings.json",
      hooks: {},
      providers: {
        claude: {
          installed: claudeInstalled,
          has_dashboard_hooks: claudeInstalled,
          path: "~/.claude/settings.json",
          hooks: {},
        },
        codex: {
          installed: codexInstalled,
          has_dashboard_hooks: codexInstalled,
          path: "~/.codex/hooks.json",
          hooks: {},
        },
      },
    },
  } as unknown as Awaited<ReturnType<typeof api.settings.info>>;
}

describe("SplashScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    info.mockResolvedValue(hookInfo(false, false));
  });

  it("skips setup when Claude Code is selected and its hooks are installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, false));

    render(<SplashScreen />);
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(info).toHaveBeenCalledTimes(1);
    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("provider-onboarding-shown-v2")).toBe("1");
  });

  it("skips setup when Codex is selected and its hooks are installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(false, true));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /codex beta/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(info).toHaveBeenCalledTimes(1);
    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skips setup for Both only when both providers are installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, true));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /both/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(info).toHaveBeenCalledTimes(1);
    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers only the missing provider when Both is partially installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, false));
    installHooks.mockResolvedValue({
      ok: true,
      results: {
        codex: {
          ok: true,
          output: ["Installed Codex lifecycle hooks."],
        },
      },
      hooks: {
        installed: true,
        providers: {
          codex: {
            installed: true,
            path: "~/.codex/hooks.json",
            hooks: {},
          },
        },
      },
    });

    render(<SplashScreen />);

    await user.click(screen.getByRole("radio", { name: /both/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    const hookDialog = await screen.findByRole("dialog", { name: "Set up live monitoring" });
    expect(within(hookDialog).getByText("Codex")).toBeVisible();
    expect(within(hookDialog).queryByText("Claude Code")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Install hooks" }));

    expect(installHooks).toHaveBeenCalledWith(["codex"]);
    expect(await screen.findByText("Installed Codex lifecycle hooks.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue to dashboard" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("provider-onboarding-shown-v2")).toBe("1");
  });

  it("offers Claude only when Both is selected and only Codex is installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(false, true));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /both/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    const hookDialog = await screen.findByRole("dialog", { name: "Set up live monitoring" });
    expect(within(hookDialog).getByText("Claude Code")).toBeVisible();
    expect(within(hookDialog).queryByText("Codex")).not.toBeInTheDocument();
  });

  it("ignores Claude readiness when Codex alone is selected", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, false));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /codex beta/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    const hookDialog = await screen.findByRole("dialog", { name: "Set up live monitoring" });
    expect(within(hookDialog).getByText("Codex")).toBeVisible();
    expect(within(hookDialog).queryByText("Claude Code")).not.toBeInTheDocument();
  });

  it("shows setup when the selected provider is missing", async () => {
    const user = userEvent.setup();
    render(<SplashScreen />);

    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));
    expect(await screen.findByRole("dialog", { name: "Set up live monitoring" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "I have already installed hooks" }));

    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("provider-onboarding-shown-v2")).toBe("1");
  });

  it("keeps setup available when hook status cannot be checked", async () => {
    const user = userEvent.setup();
    info.mockRejectedValue(new Error("offline"));

    render(<SplashScreen />);
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(await screen.findByRole("dialog", { name: "Set up live monitoring" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not check your current hook setup"
    );
  });
  it("stays dismissed in a new tab, where sessionStorage is empty", () => {
    // ⌘/Ctrl-clicking a link opens a tab with fresh `sessionStorage` but the
    // same `localStorage`. Onboarding is a per-browser event, so only the
    // latter may gate it.
    localStorage.setItem("provider-onboarding-shown-v2", "1");
    sessionStorage.clear();

    const { container } = render(<SplashScreen />);

    expect(container).toBeEmptyDOMElement();
  });
});
