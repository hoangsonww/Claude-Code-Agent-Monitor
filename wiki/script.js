/**
 * @file JS functionality for wiki page index.html at root
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/* ─── Mermaid initialisation ────────────────────────────────────────────── */
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#1a1a2b",
    primaryTextColor: "#e2e2f0",
    primaryBorderColor: "#2e2e48",
    lineColor: "#6366f1",
    secondaryColor: "#12121e",
    tertiaryColor: "#0f0f1c",
    background: "#0d0d16",
    mainBkg: "#1a1a2b",
    nodeBorder: "#2e2e48",
    clusterBkg: "#12121e",
    titleColor: "#e2e2f0",
    edgeLabelBackground: "#1a1a2b",
    nodeTextColor: "#e2e2f0",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "13px",
    actorBkg: "#1a1a2b",
    actorBorder: "#6366f1",
    actorTextColor: "#e2e2f0",
    actorLineColor: "#2e2e48",
    signalColor: "#a5b4fc",
    signalTextColor: "#e2e2f0",
    labelBoxBkgColor: "#12121e",
    labelBoxBorderColor: "#2e2e48",
    labelTextColor: "#e2e2f0",
    loopTextColor: "#e2e2f0",
    noteBkgColor: "#1e1e30",
    noteBorderColor: "#2e2e48",
    noteTextColor: "#e2e2f0",
    activationBkgColor: "#252538",
    activationBorderColor: "#6366f1",
    sequenceNumberColor: "#a5b4fc",
    fillType0: "#1a1a2b",
    fillType1: "#12121e",
    fillType2: "#0f0f1c",
    fillType3: "#252538",
    fillType4: "#1e1e30",
    fillType5: "#16162a",
    fillType6: "#0d0d20",
    fillType7: "#1a1a2b",
  },
  flowchart: {
    htmlLabels: true,
    curve: "basis",
    nodeSpacing: 40,
    rankSpacing: 60,
  },
  sequence: {
    diagramMarginX: 20,
    diagramMarginY: 10,
    actorMargin: 50,
    boxMargin: 10,
    messageMargin: 35,
    mirrorActors: false,
  },
  er: {
    diagramPadding: 20,
    layoutDirection: "TB",
    minEntityWidth: 100,
    minEntityHeight: 75,
    entityPadding: 15,
    useMaxWidth: true,
  },
  stateDiagram: {
    defaultRenderer: "dagre-wrapper",
  },
  logLevel: "error",
});

/* ─── Lazy-render mermaid diagrams ─────────────────────────────────────────
 * mermaid.min.js is ~3.2MB uncompressed and rendering 21 diagrams
 * synchronously at DOMContentLoaded blocks the main thread for hundreds
 * of ms (and forces a layout shift when SVGs replace text). Instead, we
 * render each .mermaid block only when it scrolls within ~200px of the
 * viewport. The render cost gets spread across scroll instead of dumped
 * upfront, so first paint is near-instant.
 *
 * Falls back to eager rendering when IntersectionObserver isn't
 * available, or on prefers-reduced-motion (where we want stable content
 * up front rather than appearing-as-you-scroll motion). */
(function () {
  const blocks = Array.from(document.querySelectorAll(".mermaid"));
  if (blocks.length === 0) return;

  // Reserve a placeholder so the page doesn't collapse before render and
  // the IntersectionObserver has stable layout to measure.
  blocks.forEach(function (el) {
    if (!el.style.minHeight) el.style.minHeight = "120px";
    el.dataset.mermaidPending = "1";
  });

  function renderOne(el) {
    if (!el.dataset.mermaidPending) return;
    delete el.dataset.mermaidPending;
    try {
      // mermaid v10 API: render a specific subtree of nodes.
      mermaid.run({ nodes: [el] }).catch(function () {
        /* ignore — leave the source text visible if render fails */
      });
    } catch {
      /* ignore */
    }
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!("IntersectionObserver" in window) || reduced.matches) {
    blocks.forEach(renderOne);
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        renderOne(entry.target);
      });
    },
    {
      // Start rendering before the diagram is visible so it feels instant.
      rootMargin: "200px 0px",
      threshold: 0,
    }
  );

  blocks.forEach(function (el) {
    observer.observe(el);
  });
})();

/* ─── Sidebar tooltips (collapsed state) ────────────────────────────────── */
(function () {
  const links = document.querySelectorAll(".sidebar .nav-link");
  if (!links.length) return;

  // Populate data-tooltip from link text (minus the nav-icon glyph)
  links.forEach(function (link) {
    if (link.hasAttribute("data-tooltip")) return;
    const icon = link.querySelector(".nav-icon");
    const label = (link.textContent || "")
      .replace(icon ? icon.textContent : "", "")
      .replace(/\s+/g, " ")
      .trim();
    if (label) link.setAttribute("data-tooltip", label);
  });

  // Single floating tooltip appended to <body> so it's not clipped by
  // the sidebar's overflow:hidden.
  const tip = document.createElement("div");
  tip.className = "ccam-side-tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);

  let currentTarget = null;

  function isCollapsed() {
    return document.body.classList.contains("sidebar-collapsed");
  }

  function showFor(el) {
    if (!isCollapsed()) return;
    const label = el.getAttribute("data-tooltip");
    if (!label) return;
    currentTarget = el;
    tip.textContent = label;
    const rect = el.getBoundingClientRect();
    // Position: 10px to the right of the nav-link, vertically centered
    const top = rect.top + rect.height / 2 - tip.offsetHeight / 2;
    const left = rect.right + 10;
    tip.style.top = Math.max(4, Math.round(top)) + "px";
    tip.style.left = Math.round(left) + "px";
    tip.classList.add("visible");
  }

  function hide() {
    currentTarget = null;
    tip.classList.remove("visible");
  }

  links.forEach(function (link) {
    link.addEventListener("mouseenter", function () {
      showFor(link);
    });
    link.addEventListener("mouseleave", hide);
    link.addEventListener("focus", function () {
      showFor(link);
    });
    link.addEventListener("blur", hide);
  });

  // Reposition or hide on scroll/resize/state change
  window.addEventListener(
    "scroll",
    function () {
      if (currentTarget) showFor(currentTarget);
    },
    true
  );
  window.addEventListener("resize", function () {
    if (currentTarget) showFor(currentTarget);
  });

  // Hide when sidebar gets expanded while tooltip is open
  const bodyObserver = new MutationObserver(function () {
    if (!isCollapsed()) hide();
  });
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
})();

/* ─── Active nav link on scroll ─────────────────────────────────────────── */
(function () {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  var clickedId = null;
  var clickTimer = null;

  /* On click: lock the highlight so the observer doesn't fight it.
     Do NOT preventDefault — let the browser handle the actual scroll. */
  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      var id = link.getAttribute("href").slice(1);
      clickedId = id;
      navLinks.forEach(function (l) {
        l.classList.toggle("active", l.getAttribute("href") === "#" + id);
      });
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () {
        clickedId = null;
      }, 1500);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      if (clickedId) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        }
      });
    },
    { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
  );

  sections.forEach((s) => observer.observe(s));
})();

/* ─── Scroll reveal for content blocks ──────────────────────────────────── */
(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const selectors = [
    "#hero > *",
    "main section > *",
    "main section .feature-grid > *",
    "main section .quick-start-grid > *",
    "main section .stats-row > *",
    "main section .pipeline > *",
    "main section .route-list > *",
    "main .wiki-footer > *",
  ];

  const allTargets = Array.from(document.querySelectorAll(selectors.join(","))).filter(
    (element, index, collection) => collection.indexOf(element) === index
  );

  if (allTargets.length === 0) return;

  /* Only animate elements that start below the initial viewport.
   *
   * On a normal top-of-page load, the hero and first-fold content are
   * already where the user is looking — a fade-in there just delays
   * paint. More importantly, on a deep-link load (e.g. #update-notifier),
   * the browser scrolls to the target section *before* this script runs;
   * applying reveal-on-scroll to that section's children would leave
   * them opacity 0 with up to 550ms + 250ms stagger before they appear.
   *
   * Measuring getBoundingClientRect() here — after DOM parse and after
   * the browser's hash scroll — tells us exactly what's already visible
   * (or scrolled past). Those elements skip reveal entirely. Everything
   * below the fold keeps the staggered fade on scroll as before. */
  const viewportBottom = window.innerHeight;
  const targets = allTargets.filter(
    (target) => target.getBoundingClientRect().top >= viewportBottom
  );

  if (targets.length === 0) return;
  const targetSet = new Set(targets);

  targets.forEach((target) => {
    target.classList.add("reveal-on-scroll");

    const parent = target.parentElement;
    if (!parent) return;

    const revealSiblings = Array.from(parent.children).filter((child) => targetSet.has(child));
    const revealIndex = revealSiblings.indexOf(target);
    target.style.setProperty("--reveal-delay", `${Math.min(revealIndex * 50, 250)}ms`);
  });

  if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    }
  );

  targets.forEach((target) => observer.observe(target));
})();

/* ─── Sidebar search filter ──────────────────────────────────────────────── */
(function () {
  const input = document.getElementById("sidebar-search");
  if (!input) return;

  const links = document.querySelectorAll(".nav-link");

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    links.forEach((link) => {
      const text = link.textContent.toLowerCase();
      link.style.display = !q || text.includes(q) ? "" : "none";
    });
  });
})();

/* ─── Copy-code buttons ──────────────────────────────────────────────────── */
document.querySelectorAll("pre").forEach((pre) => {
  const btn = document.createElement("button");
  btn.textContent = "Copy";
  btn.style.cssText = `
    position: absolute; top: 10px; right: 10px;
    background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3);
    color: #a5b4fc; font-size: 11px; font-weight: 600; font-family: inherit;
    padding: 3px 10px; border-radius: 5px; cursor: pointer; opacity: 0;
    transition: opacity 0.2s;
  `;
  pre.style.position = "relative";
  pre.appendChild(btn);

  pre.addEventListener("mouseenter", () => {
    btn.style.opacity = "1";
  });
  pre.addEventListener("mouseleave", () => {
    btn.style.opacity = "0";
  });

  btn.addEventListener("click", () => {
    const code = pre.querySelector("code");
    navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1800);
    });
  });
});

/* ─── Smooth open/close diagram toggle ──────────────────────────────────── */
document.querySelectorAll(".diagram-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const target = document.getElementById(toggle.dataset.target);
    if (!target) return;
    const isOpen = target.style.display !== "none";
    target.style.display = isOpen ? "none" : "";
    toggle.textContent = isOpen ? "Show diagram" : "Hide diagram";
  });
});
