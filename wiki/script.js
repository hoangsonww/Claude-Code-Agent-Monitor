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

  const links = Array.from(document.querySelectorAll(".nav-link"));
  const sections = Array.from(document.querySelectorAll(".nav-section"));
  const empty = document.getElementById("nav-empty");

  function runFilter() {
    const q = input.value.toLowerCase().trim();
    let anyVisible = false;
    links.forEach((link) => {
      const match = !q || link.textContent.toLowerCase().includes(q);
      link.style.display = match ? "" : "none";
      if (match) anyVisible = true;
    });
    // Hide a group header when every link until the next header is hidden, so
    // a filtered sidebar never shows dangling empty section labels.
    sections.forEach((section) => {
      let visible = false;
      let el = section.nextElementSibling;
      while (el && !el.classList.contains("nav-section")) {
        if (el.classList.contains("nav-link") && el.style.display !== "none") {
          visible = true;
          break;
        }
        el = el.nextElementSibling;
      }
      section.style.display = visible ? "" : "none";
    });
    if (empty) empty.style.display = anyVisible ? "none" : "block";
  }

  input.addEventListener("input", runFilter);
  // Exposed so the language switcher can re-apply the active filter after it
  // swaps nav-link text (search matches against the current language).
  window.__wikiRunSearch = runFilter;
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

/* ─── Wiki i18n (en source in DOM; zh / vi swap by English-text key) ──────────
 * The wiki is a static page, so localization swaps text in place. The scannable
 * layer (nav, section labels, headings, hero, UI chrome) is keyed by plain text
 * in T below; body content (paragraphs, list items, table cells, image
 * captions, callout titles) is keyed by whitespace-normalized innerHTML in H
 * (loaded from i18n-content.js) so inline <code>/<strong>/<a> markup is
 * preserved. Code, commands, paths, and technical identifiers stay in English.
 * Anything without a dictionary entry falls back to its original English.
 * ──────────────────────────────────────────────────────────────────────────*/
(function () {
  const T = {
    zh: {
      "Search docs...": "搜索文档…",
      "No results found": "未找到结果",
      "Project Wiki": "项目维基",
      "Real-time · Local-first · Zero-config": "实时 · 本地优先 · 零配置",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "一个专业的 Claude Code 代理活动监控平台。通过原生 hook 捕获会话、代理与工具事件,持久化到 SQLite,并通过 WebSocket 将更新流式推送到 React UI——无需任何外部服务。",
      // nav sections
      "Getting Started": "快速上手",
      Architecture: "架构",
      "Data & APIs": "数据与 API",
      Integrations: "集成",
      "Ops & Reference": "运维与参考",
      // section labels (with ◈)
      "◈ Architecture": "◈ 架构",
      "◈ Components & UI": "◈ 组件与 UI",
      "◈ Configuration": "◈ 配置",
      "◈ Data": "◈ 数据",
      "◈ Features": "◈ 功能",
      "◈ Getting Started": "◈ 快速上手",
      "◈ Integrations": "◈ 集成",
      "◈ Introduction": "◈ 简介",
      "◈ Operations": "◈ 运维",
      "◈ Reference": "◈ 参考",
      // nav-only labels + h2 titles
      Overview: "概览",
      Features: "功能",
      "Quick Start": "快速开始",
      Configuration: "配置",
      "Scripts Reference": "脚本参考",
      "System Overview": "系统概览",
      "What's Included": "包含哪些功能",
      "System Architecture": "系统架构",
      "Data Flow": "数据流",
      "Server Architecture": "服务端架构",
      "Client Architecture": "客户端架构",
      "State Management": "状态管理",
      "Database Design": "数据库设计",
      "API Reference": "API 参考",
      "WebSocket Protocol": "WebSocket 协议",
      "Hook Integration": "Hook 集成",
      "Import Pipeline": "导入管道",
      "MCP & Agent Extensions": "MCP 与 Agent 扩展",
      "Plugin Marketplace": "插件市场",
      "Statusline Utility": "状态栏工具",
      "VS Code Extension": "VS Code 扩展",
      "Desktop App (macOS & Windows)": "桌面应用（macOS 与 Windows）",
      "Settings Page": "设置页面",
      "Alerts & Webhooks": "告警与 Webhook",
      "Update Notifier": "更新提醒",
      "Connection Status": "连接状态",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby —— 会响应的小猫伴侣",
      Internationalization: "国际化",
      "Internationalization (i18n)": "国际化 (i18n)",
      "Deployment Modes": "部署模式",
      "Docker / Podman": "Docker / Podman",
      Performance: "性能",
      "Performance Characteristics": "性能特征",
      Security: "安全",
      "Security Considerations": "安全考量",
      Troubleshooting: "故障排查",
      "Tech Choices": "技术选型",
      "Technology Choices": "技术选型",
      // h4
      "Check 1 — Is the server running?": "检查 1 —— 服务器在运行吗？",
      "Check 2 — Are hooks installed?": "检查 2 —— Hook 安装了吗？",
      "Check 3 — Start a new Claude Code session": "检查 3 —— 启动一个新的 Claude Code 会话",
      "Check 4 — Is Node.js in PATH?": "检查 4 —— Node.js 在 PATH 中吗？",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "方式 A —— 下载最新的 GitHub Release（推荐）",
      "Option B — per-commit CI artifact": "方式 B —— 每次提交的 CI 产物",
      "Option C — build locally": "方式 C —— 本地构建",
      // h3 (card / sub-section titles)
      "14 first-class providers": "14 个一等公民提供方",
      "5-min Scheduler": "5 分钟调度器",
      "Accessibility & Resilience": "无障碍与健壮性",
      "Activity Feed": "活动流",
      "Agent Extension Layout": "Agent 扩展布局",
      "Agent State Machine": "Agent 状态机",
      Agents: "Agent",
      Alerts: "告警",
      "Alternative: Docker / Podman": "替代方案：Docker / Podman",
      Analytics: "分析",
      "API Surface": "API 接口面",
      "Ask → Run Claude Handoff": "Ask → Run Claude 交接",
      "Auto-Reload on Update": "更新时自动重载",
      "Auto-Start at Login": "登录时自动启动",
      "Auto-Surface Speech Bubbles": "自动弹出气泡台词",
      "Available Plugins": "可用插件",
      "Bounded Cache Memory": "有界缓存内存",
      "Browser Notifications": "浏览器通知",
      "Claude + Codex Extensions": "Claude + Codex 扩展",
      "Claude Config Explorer": "Claude 配置浏览器",
      "Clear Quarantine": "清除隔离属性",
      "Clear SmartScreen": "清除 SmartScreen 提示",
      "CLI Tools": "CLI 工具",
      "Client Data Loading Pattern": "客户端数据加载模式",
      "Client Routes": "客户端路由",
      Clone: "克隆",
      "Close Hides, Server Stays Up": "关闭即隐藏,服务器保持运行",
      "Common Issues": "常见问题",
      "Concurrency Timeline": "并发时间线",
      "Constant-Time Sweep": "常数时间扫描",
      "Container Runtime (Docker / Podman)": "容器运行时（Docker / Podman）",
      "Continuous Project Sync": "持续项目同步",
      "Cost Tracking": "成本追踪",
      "Data Export": "数据导出",
      "Data Management": "数据管理",
      "Data Model Reference": "数据模型参考",
      "Data Persistence & CLI Reliability": "数据持久化与 CLI 可靠性",
      "Delivery engine": "投递引擎",
      "Detection & fallback": "检测与回退",
      "Dismissal Memory": "关闭状态记忆",
      "Docker Deployment": "Docker 部署",
      "Drag to Applications": "拖到「应用程序」",
      "Environment Variables": "环境变量",
      "Error Propagation Map": "错误传播图",
      "Evaluation engine": "评估引擎",
      "Event Ingestion Pipeline": "事件摄取管道",
      "Events, Stats, Analytics": "事件、统计、分析",
      "First-Boot Bootstrap": "首次启动引导",
      "Fresh-by-Default Caching": "默认保鲜的缓存",
      "GitHub Star History": "GitHub Star 历史",
      "Guided setup": "引导式设置",
      Health: "健康",
      "History Import": "历史导入",
      "Hook Configuration": "Hook 配置",
      "Hook Events Captured": "捕获的 Hook 事件",
      "Hook Handler Design": "Hook 处理器设计",
      "Hook Installation Flow": "Hook 安装流程",
      "Hooks Ingestion": "Hook 摄取",
      "How to Get It": "如何获取",
      "Idempotence & Cost Accuracy": "幂等性与成本准确性",
      "Import History": "导入历史",
      "In-Process Architecture": "进程内架构",
      Indexes: "索引",
      Install: "安装",
      Installation: "安装",
      "Kanban Board": "看板",
      "Key Client Modules": "关键客户端模块",
      Launch: "启动",
      "Live Dashboard": "实时仪表盘",
      "Local MCP Server": "本地 MCP 服务器",
      "Local MCP Server Runtime": "本地 MCP 服务器运行时",
      "Locale-aware formatting": "区域感知格式化",
      "Menu-Bar / Notification-Area (Tray) Icon": "菜单栏 / 通知区（托盘）图标",
      "Message Envelope": "消息信封",
      "Model Pricing": "模型定价",
      "Multi-Stage Build": "多阶段构建",
      "Namespaced resources": "命名空间化资源",
      "Native Application Menu": "原生应用菜单",
      "No sessions appearing after starting Claude Code": "启动 Claude Code 后没有出现会话",
      "Non-Blocking Detection": "非阻塞检测",
      "Notification Preferences": "通知偏好",
      "Open the DMG": "打开 DMG",
      "Optional: Enable MCP and Agent Extensions": "可选：启用 MCP 与 Agent 扩展",
      "Plain Docker / Podman (no Compose)": "纯 Docker / Podman（不用 Compose）",
      "Plugin Architecture": "插件架构",
      "Port Discovery": "端口发现",
      Pricing: "定价",
      "Progressive Web App": "渐进式 Web 应用",
      "Provider payloads": "提供方负载",
      "PWA & Service Worker": "PWA 与 Service Worker",
      "Reactive Mascot — Eight Moods": "会响应的吉祥物 —— 八种情绪",
      "Responsive Design": "响应式设计",
      "Root Helper Scripts": "根目录辅助脚本",
      "Rule types": "规则类型",
      "Run Claude": "运行 Claude",
      "Run the Installer": "运行安装程序",
      "Runs Alongside the Web Dashboard": "与 Web 仪表盘并存运行",
      "Safety Model": "安全模型",
      Screenshots: "截图",
      "Server Modules": "服务端模块",
      "Session Detail": "会话详情",
      "Session Drill-In": "会话深入",
      "Session State Machine": "会话状态机",
      Sessions: "会话",
      "Sessions Table": "会话表格",
      Settings: "设置",
      "Settings & Management": "设置与管理",
      "Single-Instance Lock": "单实例锁",
      "Situation-Aware Command": "情境感知命令",
      "Skill Usage Examples": "技能使用示例",
      "Soft Failure Semantics": "软失败语义",
      "SQLite Configuration": "SQLite 配置",
      Start: "启动",
      Statusline: "状态栏",
      "Subagent Hierarchy": "子代理层级",
      "Supported Source Layouts": "支持的源布局",
      "System Health": "系统健康",
      "Technical terms preserved": "保留技术术语",
      "The ⌘B Panel": "⌘B 面板",
      "Three Modes, One Pipeline": "三种模式,一条管道",
      "Transcript Cache": "转录缓存",
      "Two UI Surfaces": "两个 UI 界面",
      "Upload Request Sequence": "上传请求时序",
      "Use Claude": "使用 Claude",
      Verification: "验证",
      "Volume Mounts": "卷挂载",
      Webhooks: "Webhook",
      "WebSocket Progress Events": "WebSocket 进度事件",
      "WebSocket Push": "WebSocket 推送",
      "What It Adds": "它新增了什么",
      "Workflow Analytics": "工作流分析",
      "Workflow Graphs": "工作流图",
      Workflows: "工作流",
    },
    vi: {
      "Search docs...": "Tìm tài liệu…",
      "No results found": "Không tìm thấy kết quả",
      "Project Wiki": "Wiki dự án",
      "Real-time · Local-first · Zero-config": "Thời gian thực · Ưu tiên cục bộ · Không cấu hình",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Nền tảng giám sát chuyên nghiệp cho hoạt động agent của Claude Code. Ghi lại phiên, agent và sự kiện công cụ qua hook gốc, lưu vào SQLite và stream cập nhật tới giao diện React qua WebSocket — không cần dịch vụ ngoài nào.",
      "Getting Started": "Bắt đầu",
      Architecture: "Kiến trúc",
      "Data & APIs": "Dữ liệu & API",
      Integrations: "Tích hợp",
      "Ops & Reference": "Vận hành & Tham khảo",
      "◈ Architecture": "◈ Kiến trúc",
      "◈ Components & UI": "◈ Thành phần & UI",
      "◈ Configuration": "◈ Cấu hình",
      "◈ Data": "◈ Dữ liệu",
      "◈ Features": "◈ Tính năng",
      "◈ Getting Started": "◈ Bắt đầu",
      "◈ Integrations": "◈ Tích hợp",
      "◈ Introduction": "◈ Giới thiệu",
      "◈ Operations": "◈ Vận hành",
      "◈ Reference": "◈ Tham khảo",
      Overview: "Tổng quan",
      Features: "Tính năng",
      "Quick Start": "Bắt đầu nhanh",
      Configuration: "Cấu hình",
      "Scripts Reference": "Tham khảo script",
      "System Overview": "Tổng quan hệ thống",
      "What's Included": "Bao gồm những gì",
      "System Architecture": "Kiến trúc hệ thống",
      "Data Flow": "Luồng dữ liệu",
      "Server Architecture": "Kiến trúc máy chủ",
      "Client Architecture": "Kiến trúc client",
      "State Management": "Quản lý trạng thái",
      "Database Design": "Thiết kế cơ sở dữ liệu",
      "API Reference": "Tham khảo API",
      "WebSocket Protocol": "Giao thức WebSocket",
      "Hook Integration": "Tích hợp Hook",
      "Import Pipeline": "Quy trình nhập",
      "MCP & Agent Extensions": "MCP & Tiện ích Agent",
      "Plugin Marketplace": "Chợ plugin",
      "Statusline Utility": "Tiện ích Statusline",
      "VS Code Extension": "Tiện ích VS Code",
      "Desktop App (macOS & Windows)": "Ứng dụng máy tính (macOS & Windows)",
      "Settings Page": "Trang cài đặt",
      "Alerts & Webhooks": "Cảnh báo & Webhook",
      "Update Notifier": "Thông báo cập nhật",
      "Connection Status": "Trạng thái kết nối",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — Chú mèo bạn đồng hành biết phản ứng",
      Internationalization: "Quốc tế hóa",
      "Internationalization (i18n)": "Quốc tế hóa (i18n)",
      "Deployment Modes": "Chế độ triển khai",
      "Docker / Podman": "Docker / Podman",
      Performance: "Hiệu năng",
      "Performance Characteristics": "Đặc tính hiệu năng",
      Security: "Bảo mật",
      "Security Considerations": "Cân nhắc bảo mật",
      Troubleshooting: "Khắc phục sự cố",
      "Tech Choices": "Lựa chọn công nghệ",
      "Technology Choices": "Lựa chọn công nghệ",
      "Check 1 — Is the server running?": "Kiểm tra 1 — Máy chủ có đang chạy?",
      "Check 2 — Are hooks installed?": "Kiểm tra 2 — Hook đã được cài chưa?",
      "Check 3 — Start a new Claude Code session": "Kiểm tra 3 — Khởi động phiên Claude Code mới",
      "Check 4 — Is Node.js in PATH?": "Kiểm tra 4 — Node.js có trong PATH?",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "Cách A — tải bản GitHub Release mới nhất (khuyến nghị)",
      "Option B — per-commit CI artifact": "Cách B — artifact CI theo từng commit",
      "Option C — build locally": "Cách C — build cục bộ",
      "14 first-class providers": "14 nhà cung cấp hạng nhất",
      "5-min Scheduler": "Bộ lập lịch 5 phút",
      "Accessibility & Resilience": "Trợ năng & Khả năng phục hồi",
      "Activity Feed": "Nguồn cấp hoạt động",
      "Agent Extension Layout": "Bố cục tiện ích mở rộng Agent",
      "Agent State Machine": "Máy trạng thái Agent",
      Agents: "Agent",
      Alerts: "Cảnh báo",
      "Alternative: Docker / Podman": "Thay thế: Docker / Podman",
      Analytics: "Phân tích",
      "API Surface": "Bề mặt API",
      "Ask → Run Claude Handoff": "Ask → chuyển sang Run Claude",
      "Auto-Reload on Update": "Tự động tải lại khi cập nhật",
      "Auto-Start at Login": "Tự khởi động khi đăng nhập",
      "Auto-Surface Speech Bubbles": "Tự hiện bong bóng thoại",
      "Available Plugins": "Plugin có sẵn",
      "Bounded Cache Memory": "Bộ nhớ cache có giới hạn",
      "Browser Notifications": "Thông báo trình duyệt",
      "Claude + Codex Extensions": "Tiện ích Claude + Codex",
      "Claude Config Explorer": "Trình khám phá cấu hình Claude",
      "Clear Quarantine": "Xóa cách ly (quarantine)",
      "Clear SmartScreen": "Bỏ qua SmartScreen",
      "CLI Tools": "Công cụ CLI",
      "Client Data Loading Pattern": "Mẫu tải dữ liệu client",
      "Client Routes": "Định tuyến client",
      Clone: "Clone",
      "Close Hides, Server Stays Up": "Đóng để ẩn, máy chủ vẫn chạy",
      "Common Issues": "Sự cố thường gặp",
      "Concurrency Timeline": "Dòng thời gian đồng thời",
      "Constant-Time Sweep": "Quét thời gian hằng số",
      "Container Runtime (Docker / Podman)": "Container runtime (Docker / Podman)",
      "Continuous Project Sync": "Đồng bộ dự án liên tục",
      "Cost Tracking": "Theo dõi chi phí",
      "Data Export": "Xuất dữ liệu",
      "Data Management": "Quản lý dữ liệu",
      "Data Model Reference": "Tham khảo mô hình dữ liệu",
      "Data Persistence & CLI Reliability": "Lưu trữ dữ liệu & độ tin cậy CLI",
      "Delivery engine": "Công cụ gửi",
      "Detection & fallback": "Phát hiện & dự phòng",
      "Dismissal Memory": "Ghi nhớ đã đóng",
      "Docker Deployment": "Triển khai Docker",
      "Drag to Applications": "Kéo vào Applications",
      "Environment Variables": "Biến môi trường",
      "Error Propagation Map": "Bản đồ lan truyền lỗi",
      "Evaluation engine": "Công cụ đánh giá",
      "Event Ingestion Pipeline": "Quy trình thu nhận sự kiện",
      "Events, Stats, Analytics": "Sự kiện, thống kê, phân tích",
      "First-Boot Bootstrap": "Khởi tạo lần đầu",
      "Fresh-by-Default Caching": "Cache mặc định luôn mới",
      "GitHub Star History": "Lịch sử Star trên GitHub",
      "Guided setup": "Thiết lập có hướng dẫn",
      Health: "Sức khỏe",
      "History Import": "Nhập lịch sử",
      "Hook Configuration": "Cấu hình Hook",
      "Hook Events Captured": "Sự kiện Hook được ghi",
      "Hook Handler Design": "Thiết kế bộ xử lý Hook",
      "Hook Installation Flow": "Quy trình cài Hook",
      "Hooks Ingestion": "Thu nhận Hook",
      "How to Get It": "Cách lấy",
      "Idempotence & Cost Accuracy": "Tính bất biến & độ chính xác chi phí",
      "Import History": "Nhập lịch sử",
      "In-Process Architecture": "Kiến trúc trong tiến trình",
      Indexes: "Chỉ mục",
      Install: "Cài đặt",
      Installation: "Cài đặt",
      "Kanban Board": "Bảng Kanban",
      "Key Client Modules": "Các module client chính",
      Launch: "Khởi chạy",
      "Live Dashboard": "Bảng điều khiển trực tiếp",
      "Local MCP Server": "Máy chủ MCP cục bộ",
      "Local MCP Server Runtime": "Runtime máy chủ MCP cục bộ",
      "Locale-aware formatting": "Định dạng theo locale",
      "Menu-Bar / Notification-Area (Tray) Icon": "Biểu tượng menu-bar / khay thông báo",
      "Message Envelope": "Phong bì thông điệp",
      "Model Pricing": "Giá theo mô hình",
      "Multi-Stage Build": "Build nhiều giai đoạn",
      "Namespaced resources": "Tài nguyên theo namespace",
      "Native Application Menu": "Menu ứng dụng gốc",
      "No sessions appearing after starting Claude Code":
        "Không có phiên nào sau khi khởi động Claude Code",
      "Non-Blocking Detection": "Phát hiện không chặn",
      "Notification Preferences": "Tùy chọn thông báo",
      "Open the DMG": "Mở tệp DMG",
      "Optional: Enable MCP and Agent Extensions": "Tùy chọn: bật MCP và tiện ích Agent",
      "Plain Docker / Podman (no Compose)": "Docker / Podman thuần (không Compose)",
      "Plugin Architecture": "Kiến trúc plugin",
      "Port Discovery": "Khám phá cổng",
      Pricing: "Giá",
      "Progressive Web App": "Progressive Web App",
      "Provider payloads": "Payload theo nhà cung cấp",
      "PWA & Service Worker": "PWA & Service Worker",
      "Reactive Mascot — Eight Moods": "Linh vật biết phản ứng — tám tâm trạng",
      "Responsive Design": "Thiết kế responsive",
      "Root Helper Scripts": "Script hỗ trợ ở thư mục gốc",
      "Rule types": "Loại quy tắc",
      "Run Claude": "Chạy Claude",
      "Run the Installer": "Chạy trình cài đặt",
      "Runs Alongside the Web Dashboard": "Chạy song song với dashboard web",
      "Safety Model": "Mô hình an toàn",
      Screenshots: "Ảnh chụp màn hình",
      "Server Modules": "Các module máy chủ",
      "Session Detail": "Chi tiết phiên",
      "Session Drill-In": "Đi sâu vào phiên",
      "Session State Machine": "Máy trạng thái phiên",
      Sessions: "Phiên",
      "Sessions Table": "Bảng phiên",
      Settings: "Cài đặt",
      "Settings & Management": "Cài đặt & Quản lý",
      "Single-Instance Lock": "Khóa một-phiên-bản",
      "Situation-Aware Command": "Lệnh theo ngữ cảnh",
      "Skill Usage Examples": "Ví dụ dùng skill",
      "Soft Failure Semantics": "Ngữ nghĩa lỗi mềm",
      "SQLite Configuration": "Cấu hình SQLite",
      Start: "Khởi động",
      Statusline: "Statusline",
      "Subagent Hierarchy": "Phân cấp subagent",
      "Supported Source Layouts": "Bố cục nguồn được hỗ trợ",
      "System Health": "Sức khỏe hệ thống",
      "Technical terms preserved": "Giữ nguyên thuật ngữ kỹ thuật",
      "The ⌘B Panel": "Bảng ⌘B",
      "Three Modes, One Pipeline": "Ba chế độ, một quy trình",
      "Transcript Cache": "Cache transcript",
      "Two UI Surfaces": "Hai bề mặt UI",
      "Upload Request Sequence": "Trình tự yêu cầu tải lên",
      "Use Claude": "Dùng Claude",
      Verification: "Xác minh",
      "Volume Mounts": "Gắn volume",
      Webhooks: "Webhook",
      "WebSocket Progress Events": "Sự kiện tiến trình WebSocket",
      "WebSocket Push": "Đẩy qua WebSocket",
      "What It Adds": "Nó bổ sung gì",
      "Workflow Analytics": "Phân tích quy trình",
      "Workflow Graphs": "Đồ thị quy trình",
      Workflows: "Quy trình",
    },
    ko: {
      "Search docs...": "문서 검색…",
      "No results found": "검색 결과 없음",
      "Project Wiki": "프로젝트 위키",
      "Real-time · Local-first · Zero-config": "실시간 · 로컬 우선 · 제로 설정",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Claude Code 에이전트 활동을 위한 전문 모니터링 플랫폼입니다. 네이티브 hook을 통해 세션, 에이전트, 도구 이벤트를 캡처해 SQLite에 저장하고, WebSocket으로 React UI에 업데이트를 스트리밍합니다 — 외부 서비스가 전혀 필요 없습니다.",
      "Getting Started": "시작하기",
      "Data & APIs": "데이터 & API",
      "Ops & Reference": "운영 & 참조",
      "◈ Architecture": "◈ 아키텍처",
      "◈ Components & UI": "◈ 컴포넌트 & UI",
      "◈ Configuration": "◈ 설정",
      "◈ Data": "◈ 데이터",
      "◈ Features": "◈ 기능",
      "◈ Getting Started": "◈ 시작하기",
      "◈ Integrations": "◈ 통합",
      "◈ Introduction": "◈ 소개",
      "◈ Operations": "◈ 운영",
      "◈ Reference": "◈ 참조",
      "Quick Start": "빠른 시작",
      "Scripts Reference": "스크립트 참조",
      "System Overview": "시스템 개요",
      "What's Included": "포함된 기능",
      "System Architecture": "시스템 아키텍처",
      "Data Flow": "데이터 흐름",
      "Server Architecture": "서버 아키텍처",
      "Client Architecture": "클라이언트 아키텍처",
      "State Management": "상태 관리",
      "Database Design": "데이터베이스 설계",
      "API Reference": "API 참조",
      "WebSocket Protocol": "WebSocket 프로토콜",
      "Hook Integration": "Hook 통합",
      "Import Pipeline": "가져오기 파이프라인",
      "MCP & Agent Extensions": "MCP & 에이전트 확장",
      "Plugin Marketplace": "플러그인 마켓플레이스",
      "Statusline Utility": "Statusline 유틸리티",
      "VS Code Extension": "VS Code 확장",
      "Desktop App (macOS & Windows)": "데스크톱 앱 (macOS & Windows)",
      "Settings Page": "설정 페이지",
      "Alerts & Webhooks": "알림 & Webhook",
      "Update Notifier": "업데이트 알리미",
      "Connection Status": "연결 상태",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — 반응형 고양이 동반자",
      "Internationalization (i18n)": "국제화 (i18n)",
      "Deployment Modes": "배포 모드",
      "Docker / Podman": "Docker / Podman",
      "Performance Characteristics": "성능 특성",
      "Security Considerations": "보안 고려사항",
      "Tech Choices": "기술 선택",
      "Technology Choices": "기술 선택",
      "Check 1 — Is the server running?": "확인 1 — 서버가 실행 중인가요?",
      "Check 2 — Are hooks installed?": "확인 2 — Hook이 설치되어 있나요?",
      "Check 3 — Start a new Claude Code session": "확인 3 — 새 Claude Code 세션 시작",
      "Check 4 — Is Node.js in PATH?": "확인 4 — Node.js가 PATH에 있나요?",
      "Option A — download the latest GitHub Release (recommended)":
        "방법 A — 최신 GitHub Release 다운로드 (권장)",
      "Option B — per-commit CI artifact": "방법 B — 커밋별 CI 아티팩트",
      "Option C — build locally": "방법 C — 로컬 빌드",
      "14 first-class providers": "14개의 퍼스트클래스 프로바이더",
      "5-min Scheduler": "5분 스케줄러",
      "Accessibility & Resilience": "접근성 & 복원력",
      "Activity Feed": "활동 피드",
      "Agent Extension Layout": "에이전트 확장 레이아웃",
      "Agent State Machine": "에이전트 상태 머신",
      "Alternative: Docker / Podman": "대안: Docker / Podman",
      "API Surface": "API 표면",
      "Ask → Run Claude Handoff": "Ask → Run Claude 핸드오프",
      "Auto-Reload on Update": "업데이트 시 자동 새로고침",
      "Auto-Start at Login": "로그인 시 자동 시작",
      "Auto-Surface Speech Bubbles": "말풍선 자동 표시",
      "Available Plugins": "사용 가능한 플러그인",
      "Bounded Cache Memory": "제한된 캐시 메모리",
      "Browser Notifications": "브라우저 알림",
      "Claude + Codex Extensions": "Claude + Codex 확장",
      "Claude Config Explorer": "Claude 설정 탐색기",
      "Clear Quarantine": "격리 속성 제거",
      "Clear SmartScreen": "SmartScreen 차단 해제",
      "CLI Tools": "CLI 도구",
      "Client Data Loading Pattern": "클라이언트 데이터 로딩 패턴",
      "Client Routes": "클라이언트 라우트",
      "Close Hides, Server Stays Up": "닫아도 숨김, 서버는 계속 실행",
      "Common Issues": "일반적인 문제",
      "Concurrency Timeline": "동시성 타임라인",
      "Constant-Time Sweep": "상수 시간 스윕",
      "Container Runtime (Docker / Podman)": "컨테이너 런타임 (Docker / Podman)",
      "Continuous Project Sync": "지속적 프로젝트 동기화",
      "Cost Tracking": "비용 추적",
      "Data Export": "데이터 내보내기",
      "Data Management": "데이터 관리",
      "Data Model Reference": "데이터 모델 참조",
      "Data Persistence & CLI Reliability": "데이터 지속성 & CLI 안정성",
      "Delivery engine": "전달 엔진",
      "Detection & fallback": "감지 & 폴백",
      "Dismissal Memory": "닫힘 상태 기억",
      "Docker Deployment": "Docker 배포",
      "Drag to Applications": "Applications로 드래그",
      "Environment Variables": "환경 변수",
      "Error Propagation Map": "오류 전파 맵",
      "Evaluation engine": "평가 엔진",
      "Event Ingestion Pipeline": "이벤트 수집 파이프라인",
      "Events, Stats, Analytics": "이벤트, 통계, 분석",
      "First-Boot Bootstrap": "최초 부팅 부트스트랩",
      "Fresh-by-Default Caching": "기본 신선 캐싱",
      "GitHub Star History": "GitHub Star 히스토리",
      "Guided setup": "가이드 설정",
      "History Import": "히스토리 가져오기",
      "Hook Configuration": "Hook 설정",
      "Hook Events Captured": "캡처되는 Hook 이벤트",
      "Hook Handler Design": "Hook 핸들러 설계",
      "Hook Installation Flow": "Hook 설치 흐름",
      "Hooks Ingestion": "Hook 수집",
      "How to Get It": "받는 방법",
      "Idempotence & Cost Accuracy": "멱등성 & 비용 정확성",
      "Import History": "가져오기 기록",
      "In-Process Architecture": "인프로세스 아키텍처",
      "Kanban Board": "Kanban 보드",
      "Key Client Modules": "주요 클라이언트 모듈",
      "Live Dashboard": "실시간 대시보드",
      "Local MCP Server": "로컬 MCP 서버",
      "Local MCP Server Runtime": "로컬 MCP 서버 런타임",
      "Locale-aware formatting": "로케일 인식 포맷팅",
      "Menu-Bar / Notification-Area (Tray) Icon": "메뉴 바 / 알림 영역(트레이) 아이콘",
      "Message Envelope": "메시지 엔벨로프",
      "Model Pricing": "모델 가격",
      "Multi-Stage Build": "멀티 스테이지 빌드",
      "Namespaced resources": "네임스페이스화된 리소스",
      "Native Application Menu": "네이티브 애플리케이션 메뉴",
      "No sessions appearing after starting Claude Code":
        "Claude Code 시작 후 세션이 나타나지 않음",
      "Non-Blocking Detection": "논블로킹 감지",
      "Notification Preferences": "알림 설정",
      "Open the DMG": "DMG 파일 열기",
      "Optional: Enable MCP and Agent Extensions": "선택 사항: MCP 및 에이전트 확장 활성화",
      "Plain Docker / Podman (no Compose)": "순수 Docker / Podman (Compose 미사용)",
      "Plugin Architecture": "플러그인 아키텍처",
      "Port Discovery": "포트 검색",
      "Progressive Web App": "프로그레시브 웹 앱",
      "Provider payloads": "프로바이더 페이로드",
      "PWA & Service Worker": "PWA & 서비스 워커",
      "Reactive Mascot — Eight Moods": "반응형 마스코트 — 여덟 가지 감정",
      "Responsive Design": "반응형 디자인",
      "Root Helper Scripts": "루트 헬퍼 스크립트",
      "Rule types": "규칙 유형",
      "Run Claude": "Claude 실행",
      "Run the Installer": "설치 프로그램 실행",
      "Runs Alongside the Web Dashboard": "웹 대시보드와 함께 실행",
      "Safety Model": "안전 모델",
      "Server Modules": "서버 모듈",
      "Session Detail": "세션 상세",
      "Session Drill-In": "세션 드릴다운",
      "Session State Machine": "세션 상태 머신",
      "Sessions Table": "세션 테이블",
      "Settings & Management": "설정 & 관리",
      "Single-Instance Lock": "단일 인스턴스 잠금",
      "Situation-Aware Command": "상황 인식 명령",
      "Skill Usage Examples": "스킬 사용 예시",
      "Soft Failure Semantics": "소프트 실패 시맨틱스",
      "SQLite Configuration": "SQLite 설정",
      "Subagent Hierarchy": "서브에이전트 계층 구조",
      "Supported Source Layouts": "지원되는 소스 레이아웃",
      "System Health": "시스템 상태",
      "Technical terms preserved": "보존된 기술 용어",
      "The ⌘B Panel": "⌘B 패널",
      "Three Modes, One Pipeline": "세 가지 모드, 하나의 파이프라인",
      "Transcript Cache": "트랜스크립트 캐시",
      "Two UI Surfaces": "두 가지 UI 화면",
      "Upload Request Sequence": "업로드 요청 시퀀스",
      "Use Claude": "Claude 사용",
      "Volume Mounts": "볼륨 마운트",
      "WebSocket Progress Events": "WebSocket 진행 이벤트",
      "WebSocket Push": "WebSocket 푸시",
      "What It Adds": "추가되는 기능",
      "Workflow Analytics": "워크플로 분석",
      "Workflow Graphs": "워크플로 그래프",
    },
  };

  const PLAIN =
    ".logo-sub, .section-label, .nav-section, .nav-empty, .main-content h2, .main-content h3, .main-content h4, .hero-desc";
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const tr = (lang, en) => (lang === "en" ? en : (T[lang] && T[lang][norm(en)]) || en);

  // Cache the English source once.
  document.querySelectorAll(PLAIN).forEach((el) => {
    if (el.children.length) return; // skip elements with inline markup
    if (el.dataset.en == null) el.dataset.en = el.textContent;
  });
  // Elements whose translatable text is a trailing text node sitting after a
  // child element (nav-link's icon span, hero-badge's status dot).
  const TEXTNODE_SEL = ".nav-link, .hero-badge";
  document.querySelectorAll(TEXTNODE_SEL).forEach((a) => {
    const node = a.lastChild;
    if (node && node.nodeType === 3 && a.dataset.en == null) a.dataset.en = node.nodeValue;
  });

  // Body-content translations: paragraphs, list items, table cells, image
  // captions, and callout titles. These may carry inline markup, so we swap the
  // whole innerHTML keyed by its whitespace-normalized English. The English
  // source for each element is cached in a Map so re-applying a language always
  // translates from English (idempotent). Data ships in i18n-content.js.
  const CONTENT = (typeof window !== "undefined" && window.__WIKI_CONTENT_I18N) || {};
  const H = { zh: CONTENT.zh || {}, vi: CONTENT.vi || {}, ko: CONTENT.ko || {} };
  const trH = (lang, en) => (lang === "en" ? en : (H[lang] && H[lang][norm(en)]) || en);
  // Heading / section-label translations from the content bundle fill any gaps
  // in T. Existing T entries always win, so this never regresses the scannable
  // layer — it only adds headings T didn't already cover.
  if (CONTENT.plain) {
    ["zh", "vi", "ko"].forEach((lng) => {
      const src = CONTENT.plain[lng] || {};
      for (const k in src) if (!(k in T[lng])) T[lng][k] = src[k];
    });
  }
  const HTML_SEL = [
    ".main-content p:not(.hero-desc)",
    ".main-content li",
    ".main-content td",
    ".main-content th",
    ".main-content .screenshot-caption",
    ".main-content .callout-body > strong",
    ".main-content .route-desc",
    ".wiki-footer .footer-note",
    ".wiki-footer .footer-col-title",
    ".wiki-footer .footer-col-links a",
  ].join(", ");
  const htmlEls = Array.from(document.querySelectorAll(HTML_SEL));
  const enHtml = new Map();
  htmlEls.forEach((el) => enHtml.set(el, el.innerHTML));

  function apply(lang) {
    document.querySelectorAll(PLAIN).forEach((el) => {
      if (el.children.length || el.dataset.en == null) return;
      el.textContent = tr(lang, el.dataset.en);
    });
    document.querySelectorAll(TEXTNODE_SEL).forEach((a) => {
      const node = a.lastChild;
      if (node && node.nodeType === 3 && a.dataset.en != null) {
        // Preserve surrounding whitespace; translate the trimmed core.
        const raw = a.dataset.en;
        const lead = raw.match(/^\s*/)[0];
        const trail = raw.match(/\s*$/)[0];
        node.nodeValue = lead + tr(lang, raw) + trail;
      }
    });
    // Body content: restore/translate the whole innerHTML from the English cache.
    htmlEls.forEach((el) => {
      const en = enHtml.get(el);
      if (en != null) el.innerHTML = trH(lang, en);
    });
    const search = document.getElementById("sidebar-search");
    if (search) search.placeholder = tr(lang, "Search docs...");
    document.documentElement.lang =
      lang === "zh" ? "zh-CN" : lang === "vi" ? "vi" : lang === "ko" ? "ko" : "en";
    document
      .querySelectorAll(".lang-btn")
      .forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
    if (typeof window.__wikiRunSearch === "function") window.__wikiRunSearch();
  }

  let lang = localStorage.getItem("wiki-lang");
  if (!lang) {
    const n = (navigator.language || "en").toLowerCase();
    lang =
      n.indexOf("zh") === 0
        ? "zh"
        : n.indexOf("vi") === 0
          ? "vi"
          : n.indexOf("ko") === 0
            ? "ko"
            : "en";
  }

  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      localStorage.setItem("wiki-lang", lang);
      apply(lang);
    });
  });

  apply(lang);
})();
