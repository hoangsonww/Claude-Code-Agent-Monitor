/**
 * @file SplashScreen.tsx
 * @description Branding splash shown once per browser session on app load. A
 * dark-tech "constellation" overlay built around the node-graph brand mark:
 * a time-aware greeting, a bold (localized) tagline, and two subtexts reveal
 * in a staggered cascade. Before entering the dashboard, it asks which product
 * data to show (Claude Code, Codex beta, or both) and persists that global
 * choice so every scoped view immediately agrees. It checks only the selected
 * providers and skips hook setup entirely when their dashboard hooks are ready.
 * Missing selected hooks are offered in a focused setup gate before entry.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/SplashScreen.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Public surface
 * - `SplashScreen` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **SplashScreen**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Plug, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { hasDiscoveredPalette } from "../lib/paletteDiscovery";
import { paletteChordLabel } from "./PaletteHint";
import { setProviderScope, type ProviderScope } from "../lib/dataScope";

/**
 * Marks that onboarding has run in this browser.
 *
 * Deliberately `localStorage`, not `sessionStorage`: a new tab — which is what
 * ⌘/Ctrl-clicking a link opens — gets a fresh `sessionStorage`, so the previous
 * key showed the splash again to someone who had already onboarded. The version
 * suffix is bumped alongside the storage change so the two cannot be confused.
 */
const ONBOARDING_KEY = "provider-onboarding-shown-v2";

type HookProvider = Exclude<ProviderScope, "both">;

type HookStatus = {
  providers?: Partial<
    Record<
      HookProvider,
      {
        installed: boolean;
        has_dashboard_hooks?: boolean;
        has_existing_hooks?: boolean;
      }
    >
  >;
};

/** Providers whose live dashboard hooks must be ready for a selected scope. */
export function hookProvidersForScope(provider: ProviderScope): HookProvider[] {
  return provider === "both" ? ["claude", "codex"] : [provider];
}

/** Selected providers that still need dashboard hooks. Unknown status is missing. */
export function missingHookProviders(
  provider: ProviderScope,
  status: HookStatus | null | undefined
): HookProvider[] {
  return hookProvidersForScope(provider).filter(
    (hookProvider) => !status?.providers?.[hookProvider]?.installed
  );
}

/** Map the local hour to a greeting bucket. */
function greetingKey(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function SplashScreen() {
  const { t } = useTranslation("splash");
  // Show at most once per browser. Read synchronously so we never flash an empty
  // overlay on a repeat mount (StrictMode double-invoke, refresh, new tab).
  // A storage failure (private mode, blocked site data) falls back to showing
  // it: onboarding twice is a nuisance, never onboarding is a broken install.
  const [mounted, setMounted] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_KEY);
    } catch {
      return true;
    }
  });
  const [provider, setProvider] = useState<ProviderScope>("claude");
  const [hookGateOpen, setHookGateOpen] = useState(false);
  const [checkingHooks, setCheckingHooks] = useState(false);
  const [hookStatus, setHookStatus] = useState<HookStatus | null>(null);
  const [hookProvidersToInstall, setHookProvidersToInstall] = useState<HookProvider[]>([]);
  const [installingHooks, setInstallingHooks] = useState(false);
  const [hooksInstalled, setHooksInstalled] = useState(false);
  const [installOutput, setInstallOutput] = useState<string[]>([]);
  const [installFailure, setInstallFailure] = useState<string | null>(null);
  const splashContentRef = useRef<HTMLDivElement>(null);
  const hookGateActionRef = useRef<HTMLButtonElement>(null);
  const hookCheckInFlightRef = useRef(false);

  // Pick the tagline + subtext pair ONCE per mount from the localized pools.
  // Falls back to the singular keys if a locale ships no array. Must run as an
  // unconditional hook (before the early return below).
  const [copy] = useState(() => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
    const taglines = t("taglines", { returnObjects: true }) as unknown as string[];
    const subs = t("subs", { returnObjects: true }) as unknown as string[][];
    const tagline = Array.isArray(taglines) && taglines.length > 0 ? pick(taglines) : t("tagline");
    const pair = Array.isArray(subs) && subs.length > 0 ? pick(subs) : [t("sub1"), t("sub2")];
    return {
      tagline,
      sub1: pair?.[0] ?? t("sub1"),
      sub2: pair?.[1] ?? t("sub2"),
    };
  });

  const finishOnboarding = () => {
    setProviderScope(provider);
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* storage may be unavailable; the in-memory scope still updates */
    }
    setMounted(false);
  };

  const selectedHookProviders = hookProvidersForScope(provider);

  const continueFromProviderChoice = async () => {
    if (hookCheckInFlightRef.current) return;
    hookCheckInFlightRef.current = true;
    setHookStatus(null);
    setInstallOutput([]);
    setInstallFailure(null);
    setHooksInstalled(false);
    setCheckingHooks(true);
    try {
      const info = await api.settings.info();
      const missing = missingHookProviders(provider, info.hooks);
      if (missing.length === 0) {
        finishOnboarding();
        return;
      }
      setHookStatus(info.hooks);
      setHookProvidersToInstall(missing);
      setHookGateOpen(true);
    } catch {
      setHookProvidersToInstall(selectedHookProviders);
      setInstallFailure(t("hookGate.checkFailed"));
      setHookGateOpen(true);
    } finally {
      hookCheckInFlightRef.current = false;
      setCheckingHooks(false);
    }
  };

  const hasExistingHooks = hookProvidersToInstall.some((hookProvider) => {
    const providerStatus = hookStatus?.providers?.[hookProvider];
    return providerStatus?.has_dashboard_hooks || providerStatus?.has_existing_hooks;
  });

  const installSelectedHooks = async () => {
    setInstallingHooks(true);
    setInstallFailure(null);
    try {
      const result = await api.settings.installHooks(hookProvidersToInstall);
      const output = hookProvidersToInstall.flatMap(
        (hookProvider) => result.results[hookProvider]?.output || []
      );
      const allInstalled = hookProvidersToInstall.every((hookProvider) => {
        return (
          result.results[hookProvider]?.ok &&
          result.hooks.providers[hookProvider]?.installed === true
        );
      });
      setInstallOutput(output);
      setHooksInstalled(allInstalled);
      if (!allInstalled) setInstallFailure(t("hookGate.failure"));
    } catch (error) {
      setInstallFailure(error instanceof Error ? error.message : t("hookGate.failure"));
    } finally {
      setInstallingHooks(false);
    }
  };

  useEffect(() => {
    if (!hookGateOpen) return;
    const frame = requestAnimationFrame(() => hookGateActionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [hookGateOpen]);

  useEffect(() => {
    const content = splashContentRef.current;
    if (!content) return;
    if (hookGateOpen) content.setAttribute("inert", "");
    else content.removeAttribute("inert");
  }, [hookGateOpen]);

  if (!mounted) return null;

  const hour = new Date().getHours();
  const greeting = t(`greeting.${greetingKey(hour)}`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${greeting}. ${copy.tagline}`}
      className="splash-root"
    >
      <style>{SPLASH_CSS}</style>

      {/* Atmosphere: layered radial glows + drifting constellation + grain */}
      <div className="splash-bg" aria-hidden="true" />
      <ConstellationField />
      <div className="splash-grain" aria-hidden="true" />

      <div ref={splashContentRef} className="splash-content" aria-hidden={hookGateOpen}>
        {/* Brand mark - the node-graph hexagon, enlarged and animated */}
        <div className="splash-mark" aria-hidden="true">
          <span className="splash-mark-glow" />
          <BrandMark />
        </div>

        <div className="splash-greeting">
          <span className="splash-rule" />
          <span className="splash-dot" />
          <span className="splash-greeting-text">{greeting}</span>
          <span className="splash-rule splash-rule-right" />
        </div>

        <h1 className="splash-tagline">{copy.tagline}</h1>

        <p className="splash-sub splash-sub-1">{copy.sub1}</p>
        <p className="splash-sub splash-sub-2">{copy.sub2}</p>

        <div className="splash-brand">{t("brand")}</div>

        <div className="splash-provider-picker" role="radiogroup" aria-label={t("provider.title")}>
          <p className="splash-provider-title">{t("provider.title")}</p>
          <p className="splash-provider-subtitle">{t("provider.description")}</p>
          <div className="splash-provider-cards">
            {(
              [
                ["claude", "Claude Code", "provider.claude"],
                ["codex", "Codex", "provider.codex"],
                ["both", t("provider.both.label"), "provider.both"],
              ] as const
            ).map(([value, label, key]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={provider === value}
                onClick={() => setProvider(value)}
                disabled={checkingHooks}
                className={`splash-provider-card ${provider === value ? "is-selected" : ""}`}
              >
                <span className="splash-provider-card-name">
                  {label} {value === "codex" && <em>{t("provider.beta")}</em>}
                </span>
                <span>{t(`${key}.description`)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="splash-continue"
            onClick={continueFromProviderChoice}
            disabled={checkingHooks}
          >
            {checkingHooks ? (
              <>
                <LoaderCircle className="splash-hook-gate-spinner" size={16} aria-hidden="true" />
                {t("hookGate.checking")}
              </>
            ) : (
              t("provider.continue")
            )}
          </button>
          {/* First run is the one moment every user passes through, so it is
              where the palette gets introduced. Suppressed for the rare visitor
              who has already found it — nobody needs teaching twice. */}
          {!hasDiscoveredPalette() && (
            <p className="splash-palette-hint">
              {t("paletteHint", { chord: paletteChordLabel() })}
            </p>
          )}
        </div>
      </div>

      {hookGateOpen && (
        <div className="splash-hook-gate-backdrop" role="presentation">
          <section
            className="splash-hook-gate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="splash-hook-gate-title"
            aria-describedby="splash-hook-gate-description"
          >
            <header className="splash-hook-gate-header">
              <span className="splash-hook-gate-icon" aria-hidden="true">
                <Plug size={19} strokeWidth={2.2} />
              </span>
              <div>
                <p className="splash-hook-gate-kicker">{t("hookGate.kicker")}</p>
                <h2 id="splash-hook-gate-title">{t("hookGate.title")}</h2>
                <p id="splash-hook-gate-description">{t("hookGate.description")}</p>
              </div>
            </header>

            <div className="splash-hook-gate-body">
              <div className="splash-hook-gate-summary">
                <span>{t("hookGate.selectedProviders")}</span>
                <div className="splash-hook-gate-provider-list">
                  {hookProvidersToInstall.map((hookProvider) => (
                    <span key={hookProvider} className="splash-hook-gate-provider">
                      {hookProvider === "claude" ? "Claude Code" : "Codex"}
                      {hookProvider === "codex" && <em>{t("provider.beta")}</em>}
                    </span>
                  ))}
                </div>
              </div>

              <div className="splash-hook-gate-realtime">
                <Terminal size={16} strokeWidth={2} aria-hidden="true" />
                <p>{t("hookGate.realTime")}</p>
              </div>

              <div
                className={`splash-hook-gate-status ${hasExistingHooks ? "is-warning" : ""}`}
                aria-live="polite"
              >
                {hooksInstalled ? (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>{t("hookGate.installed")}</span>
                  </>
                ) : hasExistingHooks ? (
                  <>
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span>{t("hookGate.existing")}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>{t("hookGate.ready")}</span>
                  </>
                )}
              </div>

              {hasExistingHooks && (
                <div className="splash-hook-gate-warning" role="note">
                  <AlertTriangle size={17} strokeWidth={2.1} aria-hidden="true" />
                  <p>{t("hookGate.overrideWarning")}</p>
                </div>
              )}

              {installOutput.length > 0 && (
                <div className="splash-hook-gate-output">
                  <span>{t("hookGate.output")}</span>
                  <pre>{installOutput.join("\n")}</pre>
                </div>
              )}

              {installFailure && (
                <p className="splash-hook-gate-failure" role="alert">
                  {installFailure}
                </p>
              )}
            </div>

            <footer className="splash-hook-gate-footer">
              <p>{t("hookGate.preserveNote")}</p>
              <div className="splash-hook-gate-actions">
                <button
                  type="button"
                  className="splash-hook-gate-secondary"
                  onClick={finishOnboarding}
                  disabled={installingHooks}
                >
                  {t("hookGate.alreadyInstalled")}
                </button>
                <button
                  ref={hookGateActionRef}
                  type="button"
                  className="splash-hook-gate-primary"
                  onClick={hooksInstalled ? finishOnboarding : installSelectedHooks}
                  disabled={installingHooks}
                >
                  {installingHooks ? (
                    <LoaderCircle
                      className="splash-hook-gate-spinner"
                      size={16}
                      aria-hidden="true"
                    />
                  ) : hooksInstalled ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : (
                    <Plug size={16} aria-hidden="true" />
                  )}
                  {installingHooks
                    ? t("hookGate.installing")
                    : hooksInstalled
                      ? t("hookGate.continue")
                      : t("hookGate.install")}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

/** The hexagon node-graph brand mark (mirrors public/favicon.svg), scaled up
 *  with animated connector lines and pulsing outer nodes. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width="96" height="96" className="splash-svg">
      <defs>
        <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="splashGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <polygon
        className="splash-hex"
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        fill="url(#splashBg)"
      />
      <circle cx="16" cy="16" r="3" fill="white" opacity="0.95" />
      <line
        className="splash-line"
        x1="16"
        y1="13"
        x2="16"
        y2="7"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        className="splash-line splash-line-2"
        x1="18.6"
        y1="17.5"
        x2="24"
        y2="20.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        className="splash-line splash-line-3"
        x1="13.4"
        y1="17.5"
        x2="8"
        y2="20.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle className="splash-node" cx="16" cy="6" r="1.8" fill="url(#splashGlow)" />
      <circle
        className="splash-node splash-node-2"
        cx="24.5"
        cy="21"
        r="1.8"
        fill="url(#splashGlow)"
      />
      <circle
        className="splash-node splash-node-3"
        cx="7.5"
        cy="21"
        r="1.8"
        fill="url(#splashGlow)"
      />
    </svg>
  );
}

/** Faint background constellation: a handful of nodes joined by thin lines that
 *  drift slowly behind the content for depth. Purely decorative. */
function ConstellationField() {
  return (
    <svg
      className="splash-constellation"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g stroke="#6366f1" strokeOpacity="0.18" strokeWidth="1">
        <line x1="120" y1="160" x2="340" y2="90" />
        <line x1="340" y1="90" x2="520" y2="240" />
        <line x1="980" y1="120" x2="1080" y2="320" />
        <line x1="220" y1="620" x2="430" y2="540" />
        <line x1="780" y1="660" x2="1010" y2="560" />
        <line x1="520" y1="240" x2="660" y2="430" />
      </g>
      <g fill="#818cf8">
        {[
          [120, 160],
          [340, 90],
          [520, 240],
          [980, 120],
          [1080, 320],
          [220, 620],
          [430, 540],
          [780, 660],
          [1010, 560],
          [660, 430],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i % 3 === 0 ? 2.5 : 1.6}
            opacity={0.5}
            style={{ animationDelay: `${(i % 5) * 0.6}s` }}
            className="splash-star"
          />
        ))}
      </g>
    </svg>
  );
}

const SPLASH_CSS = `
.splash-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #06060a;
  cursor: default;
  /* Opaque from the very first paint - the overlay must NOT fade in, or the
     app rendered behind it flashes through for the fade duration. Only the
     content cascades in (below); the dark backdrop is solid immediately. */
}
.splash-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 50% at 50% 42%, rgba(99, 102, 241, 0.22) 0%, rgba(99, 102, 241, 0) 70%),
    radial-gradient(40% 40% at 78% 80%, rgba(129, 140, 248, 0.12) 0%, rgba(129, 140, 248, 0) 70%),
    radial-gradient(45% 45% at 18% 18%, rgba(165, 180, 252, 0.10) 0%, rgba(165, 180, 252, 0) 70%),
    linear-gradient(180deg, #07070d 0%, #06060a 60%, #05050a 100%);
}
.splash-constellation {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  animation: splashConstellation 1.2s ease 0.2s forwards, splashDrift 26s ease-in-out infinite alternate;
}
.splash-star { animation: splashTwinkle 3.2s ease-in-out infinite; transform-origin: center; }
.splash-grain {
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  opacity: 0.04;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.splash-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 0 1.5rem;
  max-width: 42rem;
}
.splash-mark {
  position: relative;
  display: inline-flex;
  margin-bottom: 2.75rem;
  opacity: 0;
  animation: splashMark 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
}
.splash-mark-glow {
  position: absolute;
  inset: -18%;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.4) 0%, rgba(129, 140, 248, 0) 66%);
  filter: blur(3px);
  animation: splashGlowPulse 2.6s ease-in-out infinite;
}
.splash-svg { position: relative; display: block; filter: drop-shadow(0 8px 28px rgba(99, 102, 241, 0.45)); }
.splash-hex { transform-origin: center; animation: splashHexBreathe 3.4s ease-in-out infinite; }
.splash-line { stroke-dasharray: 8; stroke-dashoffset: 8; opacity: 0.75; animation: splashDraw 0.7s ease 0.5s forwards; }
.splash-line-2 { animation-delay: 0.62s; }
.splash-line-3 { animation-delay: 0.74s; }
.splash-node { opacity: 0; animation: splashNodePop 0.5s ease 0.85s forwards, splashNodePulse 2.4s ease-in-out 1.4s infinite; }
.splash-node-2 { animation-delay: 0.98s, 1.6s; }
.splash-node-3 { animation-delay: 1.1s, 1.8s; }

.splash-greeting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  margin-bottom: 1.6rem;
  opacity: 0;
  animation: splashRise 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.45s forwards;
}
.splash-greeting-text {
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: #a5b4fc;
  white-space: nowrap;
}
.splash-rule {
  height: 1px;
  width: clamp(1.75rem, 8vw, 4rem);
  background: linear-gradient(90deg, transparent, rgba(165, 180, 252, 0.55));
}
.splash-rule-right {
  background: linear-gradient(90deg, rgba(165, 180, 252, 0.55), transparent);
}
.splash-dot {
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: #818cf8;
  box-shadow: 0 0 10px 2px rgba(129, 140, 248, 0.7);
  animation: splashGlowPulse 1.8s ease-in-out infinite;
}
.splash-tagline {
  font-size: clamp(1.7rem, 4.6vw, 3.1rem);
  line-height: 1.12;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f4f4f8;
  margin: 0 0 1.5rem;
  text-wrap: balance;
  opacity: 0;
  animation: splashRise 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.62s forwards;
}
.splash-tagline::selection { background: rgba(129, 140, 248, 0.3); }
.splash-sub {
  font-size: clamp(0.85rem, 1.6vw, 1rem);
  line-height: 1.6;
  color: #9a9ab0;
  margin: 0 auto;
  max-width: 32rem;
  opacity: 0;
  animation: splashRise 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.splash-sub-1 { animation-delay: 0.82s; }
.splash-sub-2 { animation-delay: 0.94s; color: #6f6f86; margin-top: 0.35rem; }
.splash-brand {
  margin-top: 2.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: #4a4a60;
  opacity: 0;
  animation: splashRise 0.7s ease 1.1s forwards;
}
.splash-provider-picker {
  margin: 1.5rem auto 0;
  max-width: 38rem;
  opacity: 0;
  animation: splashRise 0.7s ease 1.22s forwards;
}
.splash-provider-title { margin: 0; color: #e9e9f3; font-size: 0.9rem; font-weight: 650; }
.splash-provider-subtitle { margin: 0.35rem 0 0; color: #8b8ba2; font-size: 0.75rem; }
.splash-provider-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem; margin-top: 0.85rem; }
.splash-provider-card {
  min-height: 5.25rem; padding: 0.7rem; text-align: left; color: #9d9db4;
  border: 1px solid rgba(129, 140, 248, 0.2); border-radius: 0.75rem;
  background: rgba(20, 20, 33, 0.78); transition: 160ms ease; cursor: pointer;
}
.splash-provider-card:hover:not(:disabled) { border-color: rgba(165, 180, 252, 0.55); background: rgba(31, 31, 53, 0.94); }
.splash-provider-card.is-selected { color: #e5e7ff; border-color: #818cf8; background: rgba(79, 70, 229, 0.18); box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.25), 0 8px 28px rgba(49, 46, 129, 0.2); }
.splash-provider-card:disabled { cursor: wait; opacity: 0.65; }
.splash-provider-card-name { display: block; color: inherit; font-size: 0.78rem; font-weight: 650; margin-bottom: 0.35rem; }
.splash-provider-card em { font-style: normal; color: #fbbf24; font-size: 0.6rem; margin-left: 0.2rem; text-transform: uppercase; letter-spacing: 0.07em; }
.splash-provider-card span:last-child { display: block; font-size: 0.67rem; line-height: 1.35; }
.splash-continue { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; margin-top: 0.9rem; border: 0; border-radius: 0.55rem; background: #6366f1; color: #fff; padding: 0.55rem 1.25rem; font-size: 0.78rem; font-weight: 650; cursor: pointer; transition: 160ms ease; }
.splash-continue:hover:not(:disabled) { background: #818cf8; transform: translateY(-1px); }
.splash-continue:disabled { cursor: wait; opacity: 0.7; }
.splash-palette-hint {
  margin: 0.85rem 0 0;
  font-size: 0.7rem;
  line-height: 1.5;
  color: #7b7b93;
}
.splash-hook-gate-backdrop {
  position: fixed; inset: 0; z-index: 4; display: grid; place-items: center; padding: 1.25rem;
  background: rgba(4, 4, 10, 0.68); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  animation: splashGateFade 180ms ease-out both;
}
.splash-hook-gate {
  width: min(100%, 35rem); overflow: hidden; border: 1px solid rgba(129, 140, 248, 0.42); border-radius: 1rem;
  color: #e7e7f4; text-align: left; background:
    linear-gradient(145deg, rgba(36, 35, 75, 0.98), rgba(14, 14, 25, 0.99) 52%, rgba(11, 11, 20, 0.99));
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(224, 231, 255, 0.1);
  animation: splashGateRise 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.splash-hook-gate-header { display: flex; gap: 0.9rem; padding: 1.35rem 1.4rem 1.15rem; border-bottom: 1px solid rgba(165, 180, 252, 0.14); }
.splash-hook-gate-icon {
  display: grid; place-items: center; width: 2.25rem; height: 2.25rem; flex: 0 0 auto; margin-top: 0.05rem;
  border: 1px solid rgba(165, 180, 252, 0.26); border-radius: 0.7rem; color: #c7d2fe;
  background: rgba(99, 102, 241, 0.16); box-shadow: inset 0 1px 0 rgba(224, 231, 255, 0.12);
}
.splash-hook-gate-kicker { margin: 0 0 0.3rem; color: #a5b4fc; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.splash-hook-gate h2 { margin: 0; color: #f0f0fa; font-size: 1.08rem; line-height: 1.25; letter-spacing: -0.01em; }
.splash-hook-gate-header p:last-child { margin: 0.38rem 0 0; color: #a9a9bc; font-size: 0.78rem; line-height: 1.5; }
.splash-hook-gate-body { display: grid; gap: 0.8rem; padding: 1.1rem 1.4rem 1.25rem; }
.splash-hook-gate-summary {
  display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; padding: 0.72rem 0.8rem;
  border: 1px solid rgba(165, 180, 252, 0.14); border-radius: 0.7rem; background: rgba(5, 5, 12, 0.24);
}
.splash-hook-gate-summary > span { color: #8f8fa5; font-size: 0.7rem; font-weight: 600; }
.splash-hook-gate-provider-list { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.38rem; }
.splash-hook-gate-provider { display: inline-flex; align-items: center; gap: 0.3rem; color: #e3e4ff; font-size: 0.7rem; font-weight: 650; }
.splash-hook-gate-provider + .splash-hook-gate-provider::before { width: 3px; height: 3px; margin-right: 0.08rem; border-radius: 999px; background: #7375b9; content: ""; }
.splash-hook-gate-provider em { color: #f7c948; font-size: 0.56rem; font-style: normal; letter-spacing: 0.06em; text-transform: uppercase; }
.splash-hook-gate-realtime { display: flex; gap: 0.65rem; align-items: flex-start; padding: 0.78rem 0.82rem; border-left: 2px solid #6366f1; border-radius: 0 0.45rem 0.45rem 0; background: rgba(99, 102, 241, 0.08); color: #c7d2fe; }
.splash-hook-gate-realtime svg { flex: 0 0 auto; margin-top: 0.06rem; }
.splash-hook-gate-realtime p { margin: 0; font-size: 0.72rem; line-height: 1.48; }
.splash-hook-gate-status { display: flex; align-items: center; gap: 0.45rem; min-height: 1.1rem; color: #a8e2c4; font-size: 0.69rem; font-weight: 600; }
.splash-hook-gate-status svg { flex: 0 0 auto; }
.splash-hook-gate-status.is-warning { color: #f5cd72; }
.splash-hook-gate-warning { display: flex; gap: 0.6rem; padding: 0.75rem 0.8rem; border: 1px solid rgba(245, 190, 80, 0.28); border-radius: 0.65rem; background: rgba(180, 105, 15, 0.1); color: #f5d991; }
.splash-hook-gate-warning svg { flex: 0 0 auto; margin-top: 0.05rem; }
.splash-hook-gate-warning p { margin: 0; font-size: 0.7rem; line-height: 1.5; }
.splash-hook-gate-output { display: grid; gap: 0.4rem; }
.splash-hook-gate-output > span { color: #9d9db2; font-size: 0.66rem; font-weight: 600; }
.splash-hook-gate-output pre { max-height: 8rem; margin: 0; overflow: auto; padding: 0.72rem 0.78rem; border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 0.65rem; color: #bae6d1; font: 0.66rem/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; background: rgba(6, 78, 59, 0.16); }
.splash-hook-gate-failure { margin: 0; padding: 0.72rem 0.8rem; border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 0.65rem; color: #fecaca; font-size: 0.7rem; line-height: 1.45; background: rgba(127, 29, 29, 0.15); }
.splash-hook-gate-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.95rem 1.4rem; border-top: 1px solid rgba(165, 180, 252, 0.14); background: rgba(3, 3, 8, 0.22); }
.splash-hook-gate-footer > p { max-width: 13.5rem; margin: 0; color: #7e7e95; font-size: 0.64rem; line-height: 1.42; }
.splash-hook-gate-actions { display: flex; align-items: center; gap: 0.55rem; flex: 0 0 auto; }
.splash-hook-gate-secondary, .splash-hook-gate-primary { display: inline-flex; align-items: center; justify-content: center; gap: 0.42rem; min-height: 2.15rem; border-radius: 0.55rem; padding: 0.48rem 0.7rem; font-size: 0.7rem; font-weight: 650; transition: 160ms ease; cursor: pointer; }
.splash-hook-gate-secondary { border: 1px solid rgba(165, 180, 252, 0.2); color: #c3c3d6; background: rgba(255, 255, 255, 0.03); }
.splash-hook-gate-secondary:hover:not(:disabled) { border-color: rgba(165, 180, 252, 0.5); color: #ececff; background: rgba(165, 180, 252, 0.09); }
.splash-hook-gate-primary { border: 1px solid #818cf8; color: #fff; background: #6366f1; box-shadow: 0 5px 16px rgba(67, 56, 202, 0.26); }
.splash-hook-gate-primary:hover:not(:disabled) { border-color: #a5b4fc; background: #7477f7; transform: translateY(-1px); }
.splash-hook-gate-primary:focus-visible, .splash-hook-gate-secondary:focus-visible { outline: 2px solid #c7d2fe; outline-offset: 3px; }
.splash-hook-gate-primary:disabled, .splash-hook-gate-secondary:disabled { opacity: 0.58; cursor: wait; }
.splash-hook-gate-spinner { animation: splashSpin 0.8s linear infinite; }

@keyframes splashFadeOut {
  from { opacity: 1; transform: scale(1); filter: blur(0); }
  to { opacity: 0; transform: scale(1.04); filter: blur(4px); }
}
@keyframes splashConstellation { to { opacity: 1; } }
@keyframes splashDrift { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-24px, -16px, 0) scale(1.05); } }
@keyframes splashTwinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.7; } }
@keyframes splashMark { from { opacity: 0; transform: translateY(14px) scale(0.82); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes splashHexBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes splashGlowPulse { 0%, 100% { opacity: 0.55; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.06); } }
@keyframes splashDraw { to { stroke-dashoffset: 0; } }
@keyframes splashNodePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes splashNodePulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
@keyframes splashRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes splashGateFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes splashGateRise { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes splashSpin { to { transform: rotate(360deg); } }

@media (max-width: 38rem) {
  .splash-hook-gate-backdrop { align-items: end; padding: 0.75rem; }
  .splash-hook-gate { max-height: calc(100dvh - 1.5rem); overflow-y: auto; }
  .splash-hook-gate-header, .splash-hook-gate-body { padding-left: 1rem; padding-right: 1rem; }
  .splash-hook-gate-footer { align-items: stretch; flex-direction: column; padding: 0.9rem 1rem; }
  .splash-hook-gate-footer > p { max-width: none; }
  .splash-hook-gate-actions { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
  .splash-hook-gate-secondary, .splash-hook-gate-primary { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .splash-root,
  .splash-root.splash-exit,
  .splash-constellation,
  .splash-star,
  .splash-mark,
  .splash-mark-glow,
  .splash-hex,
  .splash-line,
  .splash-node,
  .splash-dot,
  .splash-greeting,
  .splash-tagline,
  .splash-sub,
  .splash-brand,
  .splash-provider-picker,
  .splash-hook-gate-backdrop,
  .splash-hook-gate,
  .splash-hook-gate-spinner {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    opacity: 1 !important;
    stroke-dashoffset: 0 !important;
    transform: none !important;
  }
}
`;
