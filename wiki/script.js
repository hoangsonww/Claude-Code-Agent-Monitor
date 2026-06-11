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

/* ─── Active nav link on scroll + smart scroll-to-section ──────────────── */
/* Two responsibilities:
 *   1. Highlight the active sidebar link as the user scrolls.
 *   2. Handle nav-link clicks ourselves so we can:
 *      a. Eager-load every still-lazy <img> on the page first. Most wiki
 *         screenshots use `width="100%"` (which is an invalid HTML width
 *         attribute and produces zero reserved height) plus `loading="lazy"`,
 *         so the browser's smooth-scroll lands several sections short of
 *         the target as later images stream in and push content down. By
 *         flipping every lazy image to eager BEFORE we start scrolling, the
 *         layout settles to its final height first and the scroll lands
 *         exactly where it should.
 *      b. Pulse-highlight the target section briefly so the user sees what
 *         they jumped to — fades automatically and is dismissed on next
 *         click or scroll-input.
 */
(function () {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  let clickedId = null;
  let clickTimer = null;
  let highlightTimer = null;
  let highlighted = null;

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.classList.remove("nav-target-highlight");
    highlighted = null;
    clearTimeout(highlightTimer);
  }

  function highlight(target) {
    clearHighlight();
    highlighted = target;
    target.classList.add("nav-target-highlight");
    // Animation runs 2.2s and ends at opacity 0 → remove the class
    // shortly after so it can re-fire on the next click.
    highlightTimer = setTimeout(clearHighlight, 2300);
  }

  // Any user-initiated click or wheel/touch scroll dismisses the highlight
  // immediately — gives the "click anywhere to dismiss" UX the user asked for.
  function attachDismissHandlers() {
    const dismissOnInput = (e) => {
      // Don't dismiss on the very click that triggered the highlight.
      if (e && e.target && e.target.closest && e.target.closest(".nav-link")) return;
      clearHighlight();
      document.removeEventListener("pointerdown", dismissOnInput, true);
      document.removeEventListener("wheel", dismissOnInput, { capture: true, passive: true });
      document.removeEventListener("touchmove", dismissOnInput, { capture: true, passive: true });
      document.removeEventListener("keydown", dismissOnInput, true);
    };
    // Defer so the click that opened the highlight doesn't immediately close it.
    setTimeout(() => {
      document.addEventListener("pointerdown", dismissOnInput, true);
      document.addEventListener("wheel", dismissOnInput, { capture: true, passive: true });
      document.addEventListener("touchmove", dismissOnInput, { capture: true, passive: true });
      document.addEventListener("keydown", dismissOnInput, true);
    }, 50);
  }

  function eagerLoadAllImages() {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.loading = "eager";
    });
  }

  // Matches `[id] { scroll-margin-top: 32px }` in style.css.
  const SCROLL_OFFSET = 32;
  let activeScrollId = 0;

  /* Custom smooth scroll, fully under our control.
   *
   * Why this exists (and why every previous attempt failed):
   *   `html { scroll-behavior: smooth }` is set globally in style.css, so
   *   ANY programmatic scroll the browser does — including the one
   *   triggered by `scrollIntoView({behavior: "smooth"})` — gets wrapped
   *   in the browser's own animation that commits to a FIXED pixel
   *   target at start time. When lazy images decode mid-flight and push
   *   the target lower, the browser keeps animating to the original
   *   pixel, lands short, then any follow-up correction queues ANOTHER
   *   smooth animation — that's the "scroll, pause, scroll-again" the
   *   user keeps reporting.
   *
   *   The only reliable fix is to bypass the browser's smoothing
   *   entirely: temporarily flip scroll-behavior to "auto", drive the
   *   animation ourselves with rAF using direct scrollTo() calls (which
   *   are then truly instant), and re-measure the target every frame so
   *   late layout changes don't strand us in the wrong place. One
   *   continuous animation from start to target — no pauses, no double
   *   scrolls, no fighting.
   *
   * Algorithm: exponential approach. Each frame, move ~15% of the
   * remaining distance toward the (re-measured) target. Naturally:
   *   - Decelerates toward the end without explicit easing math.
   *   - Adapts smoothly when the target moves mid-flight.
   *   - Stops when within 0.5px of target for several consecutive
   *     frames (so the user doesn't see micro-corrections).
   */
  function smoothScrollAndSettle(target, onArrive) {
    eagerLoadAllImages();

    const myId = ++activeScrollId; // newer calls cancel older ones
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; // critical: defeat global CSS

    let canceled = false;
    let stableFrames = 0;
    let onArriveFired = false;

    function cleanup() {
      html.style.scrollBehavior = prevBehavior;
      window.removeEventListener("wheel", onUserScroll, { capture: true, passive: true });
      window.removeEventListener("touchstart", onUserScroll, { capture: true, passive: true });
      window.removeEventListener("keydown", onUserKey, true);
    }
    function fireArrive() {
      if (onArriveFired) return;
      onArriveFired = true;
      cleanup();
      if (onArrive) onArrive();
    }
    function onUserScroll() {
      // Real user input — let them take over. Don't fire onArrive
      // (highlight would feel out of place if they scrolled away).
      canceled = true;
      cleanup();
    }
    function onUserKey(e) {
      const k = e.key;
      if (
        k === "ArrowUp" ||
        k === "ArrowDown" ||
        k === "PageUp" ||
        k === "PageDown" ||
        k === "Home" ||
        k === "End" ||
        k === " " ||
        k === "Escape"
      )
        onUserScroll();
    }
    window.addEventListener("wheel", onUserScroll, { capture: true, passive: true });
    window.addEventListener("touchstart", onUserScroll, { capture: true, passive: true });
    window.addEventListener("keydown", onUserKey, true);

    const startTime = performance.now();
    const HARD_TIMEOUT_MS = 2200;

    function step(now) {
      if (canceled || myId !== activeScrollId) return;
      if (now - startTime > HARD_TIMEOUT_MS) {
        // Safety net — never spin forever. Snap and arrive.
        const finalRect = target.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + finalRect.top - SCROLL_OFFSET);
        fireArrive();
        return;
      }

      // Re-measure the target every frame so we adapt to layout shifts
      // (lazy images decoding, fonts swapping, mermaid rendering, etc).
      const rect = target.getBoundingClientRect();
      const desired = window.scrollY + rect.top - SCROLL_OFFSET;
      const current = window.scrollY;
      const distance = desired - current;
      const absDist = Math.abs(distance);

      if (absDist < 0.5) {
        // Snap to exact target and require it to stay stable for a few
        // frames before declaring arrival — guards against late layout
        // shifts within ~80ms of arrival.
        window.scrollTo(0, desired);
        if (++stableFrames >= 5) {
          fireArrive();
          return;
        }
        requestAnimationFrame(step);
        return;
      }

      stableFrames = 0;
      // Exponential approach. The 0.18 factor gives a snappy-but-smooth
      // feel that converges to <1px in ~25 frames (~400ms at 60fps) for
      // a 2000px jump. Tuned by hand.
      const move = distance * 0.18;
      // Floor on absolute movement so the very last pixels don't crawl.
      const stepPx = Math.abs(move) < 1 ? distance : move;
      window.scrollTo(0, current + stepPx);
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (ev) {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#") || href.length < 2) return;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      // Take over from the browser so we can stabilize layout first.
      ev.preventDefault();

      clickedId = id;
      navLinks.forEach(function (l) {
        l.classList.toggle("active", l.getAttribute("href") === "#" + id);
      });
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () {
        clickedId = null;
      }, 1500);

      // 1. Force layout to its final height (kills mid-scroll drift).
      eagerLoadAllImages();

      // 2. Update the URL hash now (before scroll) so back/forward works.
      if (history.replaceState) {
        history.replaceState(null, "", "#" + id);
      }

      // 3. Smooth-scroll, snap-correct after settle, THEN highlight.
      //    The highlight only fires once the user can actually see the
      //    target — firing it at click time is useless because long
      //    scrolls take ~600-900ms to arrive.
      smoothScrollAndSettle(target, function () {
        highlight(target);
        attachDismissHandlers();
      });
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
  btn.type = "button";
  btn.className = "code-copy-btn";
  btn.textContent = "Copy";

  // Prefer mounting the button in the window's title bar / header (the macOS
  // chrome with the traffic-light dots) instead of floating inside the code
  // body. Fall back to a floating, reveal-on-hover button for headerless
  // standalone <pre> blocks that get their own window chrome.
  const prev = pre.previousElementSibling;
  const header =
    prev && (prev.classList.contains("code-header") || prev.classList.contains("code-titlebar"))
      ? prev
      : null;

  if (header) {
    header.classList.add("has-copy");
    header.appendChild(btn);
  } else {
    btn.classList.add("code-copy-btn--floating");
    pre.style.position = "relative";
    pre.appendChild(btn);

    pre.addEventListener("mouseenter", () => {
      btn.style.opacity = "1";
    });
    pre.addEventListener("mouseleave", () => {
      btn.style.opacity = "0";
    });
  }

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

/* ─── Lightbox for Screenshots ──────────────────────────────────────────── */
(function () {
  /* ── Collect all slides ──────────────────────────────────────────────── */
  const slides = [];
  document
    .querySelectorAll(".screenshot-card img, .hero-gallery img, .screenshot-gallery img")
    .forEach((thumb) => {
      const card = thumb.closest(".screenshot-card");
      let caption = "";
      if (card) {
        const capEl = card.querySelector(".screenshot-caption");
        if (capEl) caption = capEl.textContent.trim();
      }
      if (!caption) caption = thumb.alt || "";
      slides.push({ src: thumb.src, alt: thumb.alt || "", caption: caption });
    });

  let current = 0;

  /* ── Build DOM ───────────────────────────────────────────────────────── */
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const closeBtn = document.createElement("button");
  closeBtn.className = "lightbox-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.setAttribute("aria-label", "Close lightbox");

  const prevBtn = document.createElement("button");
  prevBtn.className = "lightbox-nav lightbox-prev";
  prevBtn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  prevBtn.setAttribute("aria-label", "Previous image");

  const nextBtn = document.createElement("button");
  nextBtn.className = "lightbox-nav lightbox-next";
  nextBtn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>';
  nextBtn.setAttribute("aria-label", "Next image");

  const body = document.createElement("div");
  body.className = "lightbox-body";

  const img = document.createElement("img");
  img.className = "lightbox-image";

  const captionEl = document.createElement("div");
  captionEl.className = "lightbox-caption";

  body.appendChild(img);
  body.appendChild(captionEl);
  overlay.appendChild(closeBtn);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function showSlide(idx) {
    current = idx;
    const s = slides[current];
    img.src = s.src;
    img.alt = s.alt;

    /* Parse caption: split emoji + bold title from description */
    const m = s.caption.match(/^([^\u2014—-]+(?:[—\u2014-]\s*)?)(.*)$/);
    let html = "";
    if (m && m[1]) {
      html += '<span class="lightbox-caption-title">' + m[1].trim() + "</span>";
      if (m[2]) html += m[2].trim();
    } else {
      html = s.caption;
    }
    html += '<span class="lightbox-counter">' + (current + 1) + " / " + slides.length + "</span>";
    captionEl.innerHTML = html;
  }

  function openAt(idx) {
    showSlide(idx);
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    setTimeout(() => {
      img.src = "";
    }, 300);
  }

  function goPrev() {
    showSlide((current - 1 + slides.length) % slides.length);
  }
  function goNext() {
    showSlide((current + 1) % slides.length);
  }

  /* ── Events ──────────────────────────────────────────────────────────── */
  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    goPrev();
  });
  nextBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    goNext();
  });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeLightbox();
  });

  document.addEventListener("keydown", function (e) {
    if (!overlay.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
  });

  /* ── Bind thumbnails ─────────────────────────────────────────────────── */
  document
    .querySelectorAll(".screenshot-card img, .hero-gallery img, .screenshot-gallery img")
    .forEach((thumb, i) => {
      thumb.addEventListener("click", function () {
        openAt(i);
      });
    });

  /* Expose for hash-nav script */
  window.__lightboxOpenAt = openAt;
  window.__lightboxSlides = slides;
})();
