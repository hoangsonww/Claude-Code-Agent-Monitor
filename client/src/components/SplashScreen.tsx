/**
 * @file SplashScreen.tsx
 * @description Branding splash shown once per browser session on app load. A
 * dark-tech "constellation" overlay built around the node-graph brand mark:
 * a time-aware greeting, a bold (localized) tagline, and two subtexts reveal
 * in a staggered cascade. The tagline and the subtext pair are picked at
 * random (per mount) from localized pools in `splash.json`, so the copy is
 * fresh each session. The overlay holds for ~2.5s, then fades out and
 * unmounts. Clicking anywhere skips it; honors
 * `prefers-reduced-motion`. CSS-only animations (no extra deps).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const SESSION_KEY = "splash-shown-v1";
const HOLD_MS = 2500; // visible dwell after the entrance settles
const EXIT_MS = 600; // fade-out duration

/** Map the local hour to a greeting bucket. */
function greetingKey(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function SplashScreen() {
  const { t } = useTranslation("splash");
  // Show at most once per tab session. Read synchronously so we never flash an
  // empty overlay on a repeat mount (StrictMode double-invoke, refresh, etc.).
  const [mounted, setMounted] = useState(() => {
    try {
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return true;
    }
  });
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const doneTimer = useRef<number | null>(null);

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

  const beginExit = () => {
    if (exiting) return;
    setExiting(true);
    doneTimer.current = window.setTimeout(() => setMounted(false), EXIT_MS);
  };

  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* sessionStorage may be unavailable (private mode) - show anyway */
    }
    exitTimer.current = window.setTimeout(beginExit, HOLD_MS);
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  const hour = new Date().getHours();
  const greeting = t(`greeting.${greetingKey(hour)}`);

  return (
    <div
      role="dialog"
      aria-label={`${greeting}. ${copy.tagline}`}
      onClick={beginExit}
      className={`splash-root ${exiting ? "splash-exit" : ""}`}
    >
      <style>{SPLASH_CSS}</style>

      {/* Atmosphere: layered radial glows + drifting constellation + grain */}
      <div className="splash-bg" aria-hidden="true" />
      <ConstellationField />
      <div className="splash-grain" aria-hidden="true" />

      <div className="splash-content">
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
      </div>
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
  cursor: pointer;
  /* Opaque from the very first paint - the overlay must NOT fade in, or the
     app rendered behind it flashes through for the fade duration. Only the
     content cascades in (below); the dark backdrop is solid immediately. */
}
.splash-root.splash-exit {
  animation: splashFadeOut ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
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
  .splash-brand {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    opacity: 1 !important;
    stroke-dashoffset: 0 !important;
    transform: none !important;
  }
}
`;
