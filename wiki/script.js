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

/* ─── Wiki i18n (en source in DOM; zh/vi/ko/es/fr/de/pt/it swap by English-text key) ─
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
      "Prometheus & Grafana": "Prometheus 与 Grafana",
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
      "Embedded Dashboard & Deep Navigation": "嵌入式仪表板与深度导航",
      "Server startup": "服务器启动",
      "Hook-to-broadcast latency": "Hook 到广播延迟",
      "JS bundle (63 KB gzipped)": "JS 包（gzip 后 63 KB）",
      "SQLite inserts/sec (WAL)": "SQLite 插入/秒（WAL）",
      "Events, Stats, Analytics": "事件、统计、分析",
      "First-Boot Bootstrap": "首次启动引导",
      "Fresh-by-Default Caching": "默认保鲜的缓存",
      "GitHub Star History": "GitHub Star 历史",
      "Guided setup": "引导式设置",
      Health: "健康",
      "History Import": "历史导入",
      "Hook Configuration": "Hook 配置",
      "Hook latency": "Hook 延迟",
      "Hook types captured": "已捕获的 Hook 类型",
      "Server memory": "服务器内存",
      "Events before slowdown": "性能下降前的事件数",
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
      "Live Monitoring Sidebar": "实时监控侧边栏",
      "Interactive Analytics & Usage": "交互式分析与使用情况",
      "Smart Auto-Detection & Connection": "智能自动检测与连接",
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
      Plugin: "插件",
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
      "Workflow Runs": "工作流运行",
      "ccam CLI": "ccam CLI",
      Metrics: "指标",
      "How It Works": "工作原理",
      "Data Scope": "数据范围",
      "Live Status": "实时状态",
      "Security Model": "安全模型",
      "API Endpoints": "API 端点",
      "WebSocket Events": "WebSocket 事件",
      CLI: "CLI",
      "12 discovery tabs": "12 个发现标签页",
      "Safe mutations": "安全修改",
      "Keybindings editor": "按键绑定编辑器",
      "Memory store": "内存存储",
      "Read-only by design": "按设计只读",
      "Live refresh": "实时刷新",
      "Editable vs read-only": "可编辑与只读",
      "API endpoints": "API 端点",
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
      "Prometheus & Grafana": "Prometheus & Grafana",
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
      "Embedded Dashboard & Deep Navigation": "Bảng điều khiển nhúng và điều hướng sâu",
      "Server startup": "Khởi động máy chủ",
      "Hook-to-broadcast latency": "Độ trễ từ hook đến phát sóng",
      "JS bundle (63 KB gzipped)": "Gói JS (63 KB nén gzip)",
      "SQLite inserts/sec (WAL)": "Số lần chèn SQLite/giây (WAL)",
      "Events, Stats, Analytics": "Sự kiện, thống kê, phân tích",
      "First-Boot Bootstrap": "Khởi tạo lần đầu",
      "Fresh-by-Default Caching": "Cache mặc định luôn mới",
      "GitHub Star History": "Lịch sử Star trên GitHub",
      "Guided setup": "Thiết lập có hướng dẫn",
      Health: "Sức khỏe",
      "History Import": "Nhập lịch sử",
      "Hook Configuration": "Cấu hình Hook",
      "Hook latency": "Độ trễ hook",
      "Hook types captured": "Các loại hook đã ghi nhận",
      "Server memory": "Bộ nhớ máy chủ",
      "Events before slowdown": "Sự kiện trước khi chậm lại",
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
      "Live Monitoring Sidebar": "Thanh bên giám sát thời gian thực",
      "Interactive Analytics & Usage": "Phân tích và sử dụng tương tác",
      "Smart Auto-Detection & Connection": "Tự động phát hiện và kết nối thông minh",
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
      Plugin: "Plugin",
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
      "Workflow Runs": "Lần chạy quy trình",
      "ccam CLI": "ccam CLI",
      Metrics: "Chỉ số",
      "How It Works": "Cách hoạt động",
      "Data Scope": "Phạm vi dữ liệu",
      "Live Status": "Trạng thái trực tiếp",
      "Security Model": "Mô hình bảo mật",
      "API Endpoints": "Điểm cuối API",
      "WebSocket Events": "Sự kiện WebSocket",
      CLI: "CLI",
      "12 discovery tabs": "12 tab khám phá",
      "Safe mutations": "Thay đổi an toàn",
      "Keybindings editor": "Trình chỉnh sửa phím tắt",
      "Memory store": "Kho bộ nhớ",
      "Read-only by design": "Chỉ đọc theo thiết kế",
      "Live refresh": "Làm mới trực tiếp",
      "Editable vs read-only": "Có thể chỉnh sửa và chỉ đọc",
      "API endpoints": "Điểm cuối API",
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
      "Prometheus & Grafana": "Prometheus & Grafana",
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
      "Embedded Dashboard & Deep Navigation": "내장 대시보드 및 심층 탐색",
      "Server startup": "서버 시작",
      "Hook-to-broadcast latency": "Hook-브로드캐스트 지연 시간",
      "JS bundle (63 KB gzipped)": "JS 번들(gzip 63 KB)",
      "SQLite inserts/sec (WAL)": "SQLite 초당 삽입 수(WAL)",
      "Events, Stats, Analytics": "이벤트, 통계, 분석",
      "First-Boot Bootstrap": "최초 부팅 부트스트랩",
      "Fresh-by-Default Caching": "기본 신선 캐싱",
      "GitHub Star History": "GitHub Star 히스토리",
      "Guided setup": "가이드 설정",
      "History Import": "히스토리 가져오기",
      "Hook Configuration": "Hook 설정",
      "Hook latency": "Hook 지연 시간",
      "Hook types captured": "캡처된 Hook 유형",
      "Server memory": "서버 메모리",
      "Events before slowdown": "성능 저하 전 이벤트 수",
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
      "Live Monitoring Sidebar": "실시간 모니터링 사이드바",
      "Interactive Analytics & Usage": "대화형 분석 및 사용량",
      "Smart Auto-Detection & Connection": "스마트 자동 감지 및 연결",
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
      Plugin: "플러그인",
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
      "Workflow Runs": "워크플로 실행",
      "ccam CLI": "ccam CLI",
      Metrics: "지표",
      "How It Works": "작동 방식",
      "Data Scope": "데이터 범위",
      "Live Status": "실시간 상태",
      "Security Model": "보안 모델",
      "API Endpoints": "API 엔드포인트",
      "WebSocket Events": "WebSocket 이벤트",
      CLI: "CLI",
      "12 discovery tabs": "12개의 탐색 탭",
      "Safe mutations": "안전한 변경",
      "Keybindings editor": "키 바인딩 편집기",
      "Memory store": "메모리 저장소",
      "Read-only by design": "설계상 읽기 전용",
      "Live refresh": "실시간 새로고침",
      "Editable vs read-only": "편집 가능 및 읽기 전용",
      "API endpoints": "API 엔드포인트",
    },
    es: {
      "Search docs...": "Buscar documentación...",
      "No results found": "No se encontraron resultados",
      "Project Wiki": "Wiki del proyecto",
      "Real-time · Local-first · Zero-config":
        "En tiempo real · Primero local · Configuración cero",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Una plataforma de monitoreo profesional para la actividad del agente Claude Code. Captura sesiones, agentes y eventos de herramientas a través de ganchos nativos, los persiste en SQLite y transmite actualizaciones a una interfaz de usuario React a través de WebSocket, sin necesidad de servicios externos.",
      "Getting Started": "Empezar",
      Architecture: "Arquitectura",
      "Data & APIs": "Datos y API",
      Integrations: "Integraciones",
      "Ops & Reference": "Operaciones y referencia",
      "◈ Architecture": "◈ Arquitectura",
      "◈ Components & UI": "◈ Componentes y interfaz de usuario",
      "◈ Configuration": "◈ Configuración",
      "◈ Data": "◈ Datos",
      "◈ Features": "◈ Características",
      "◈ Getting Started": "◈ Comenzando",
      "◈ Integrations": "◈ Integraciones",
      "◈ Introduction": "◈ Introducción",
      "◈ Operations": "◈ Operaciones",
      "◈ Reference": "◈ Referencia",
      Overview: "Descripción general",
      Features: "Características",
      "Quick Start": "Inicio rápido",
      Configuration: "Configuración",
      "Scripts Reference": "Referencia de scripts",
      "System Overview": "Visión general del sistema",
      "What's Included": "Qué está incluido",
      "System Architecture": "Arquitectura del sistema",
      "Data Flow": "Flujo de datos",
      "Server Architecture": "Arquitectura del servidor",
      "Client Architecture": "Arquitectura del cliente",
      "State Management": "Gestión estatal",
      "Database Design": "Diseño de bases de datos",
      "API Reference": "Referencia de API",
      "WebSocket Protocol": "Protocolo WebSocket",
      "Hook Integration": "Integración de ganchos",
      "Import Pipeline": "Pipeline de importación",
      "MCP & Agent Extensions": "Extensiones de MCP y agentes",
      "Plugin Marketplace": "Mercado de complementos",
      "Statusline Utility": "Herramienta de línea de estado",
      "VS Code Extension": "Extensión de VS Code",
      "Desktop App (macOS & Windows)": "Aplicación para escritorio (macOS y Windows)",
      "Settings Page": "Página de ajustes",
      "Alerts & Webhooks": "Alertas y Webhooks",
      "Update Notifier": "Notificador de actualización",
      "Connection Status": "Estado de la conexión",
      "Prometheus & Grafana": "Prometheus y Grafana",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — Compañero de gato reactivo",
      Internationalization: "Internacionalización",
      "Internationalization (i18n)": "Internacionalización (i18n)",
      "Deployment Modes": "Modos de despliegue",
      "Docker / Podman": "Docker / Podman",
      Performance: "Rendimiento",
      "Performance Characteristics": "Características del rendimiento",
      Security: "Seguridad",
      "Security Considerations": "Consideraciones de seguridad",
      Troubleshooting: "Resolución de problemas",
      "Tech Choices": "Opciones tecnológicas",
      "Technology Choices": "Opciones tecnológicas",
      "Check 1 — Is the server running?": "Verificación 1: ¿Está funcionando el servidor?",
      "Check 2 — Are hooks installed?": "Verificación 2: ¿Se han instalado los ganchos?",
      "Check 3 — Start a new Claude Code session":
        "Verificar 3 - Iniciar una nueva sesión de Claude Code",
      "Check 4 — Is Node.js in PATH?": "Verificar 4: ¿Está Node.js en PATH?",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "Opción A: descargar la última versión de GitHub (recomendada)",
      "Option B — per-commit CI artifact": "Opción B: artefacto CI por compromiso",
      "Option C — build locally": "Opción C: construir localmente",
      "14 first-class providers": "14 proveedores de primera clase",
      "5-min Scheduler": "Programador de 5 minutos",
      "Accessibility & Resilience": "Accesibilidad y resiliencia",
      "Activity Feed": "Feed de actividad",
      "Agent Extension Layout": "Diseño de extensión del agente",
      "Agent State Machine": "Máquina de Estado del Agente",
      Agents: "Agentes",
      Alerts: "Alertas",
      "Alternative: Docker / Podman": "Alternativa: Docker / Podman",
      Analytics: "Análisis",
      "API Surface": "Superficie de la API",
      "Ask → Run Claude Handoff": "Transición de Ask a Run Claude",
      "Auto-Reload on Update": "Recarga automática en la actualización",
      "Auto-Start at Login": "Inicio automático al iniciar sesión",
      "Auto-Surface Speech Bubbles": "Bocadillos automáticos",
      "Available Plugins": "Plugins disponibles",
      "Bounded Cache Memory": "Memoria de caché limitada",
      "Browser Notifications": "Notificaciones del navegador",
      "Claude + Codex Extensions": "Extensión de Claude + Codex",
      "Agent Config — Claude Code and Codex explorers":
        "Configuración de agentes — exploradores de Claude Code y Codex",
      "Claude Config Explorer": "Explorador de configuración de Claude",
      "Clear Quarantine": "Liberación de cuarentena",
      "Clear SmartScreen": "Borrar SmartScreen",
      "CLI Tools": "Herramientas CLI",
      "Client Data Loading Pattern": "Patrón de carga de datos del cliente",
      "Client Routes": "Rutas del cliente",
      Clone: "Clonar",
      "Close Hides, Server Stays Up": "Cerrar Oculta, el Servidor Se Mantiene Activado",
      "Common Issues": "Problemas comunes",
      "Concurrency Timeline": "Cronología de concurrencia",
      "Constant-Time Sweep": "Recorrido de tiempo constante",
      "Container Runtime (Docker / Podman)": "Tiempo de ejecución del contenedor (Docker / Podman)",
      "Continuous Project Sync": "Sincronización continua del proyecto",
      "Cost Tracking": "Seguimiento de costos",
      "Data Export": "Exportación de datos",
      "Data Management": "Gestión de datos",
      "Data Model Reference": "Referencia del modelo de datos",
      "Data Persistence & CLI Reliability": "Persistencia de datos y fiabilidad de la CLI",
      "Delivery engine": "Motor de entrega",
      "Detection & fallback": "Detección y fallback",
      "Dismissal Memory": "Memoria de despido",
      "Docker Deployment": "Implementación de Docker",
      "Drag to Applications": "Arrastrar a Aplicaciones",
      "Environment Variables": "Variables del entorno",
      "Error Propagation Map": "Mapa de propagación de errores",
      "Evaluation engine": "Motor de evaluación",
      "Event Ingestion Pipeline": "Pipeline de ingestión de eventos",
      "Embedded Dashboard & Deep Navigation": "Panel integrado y navegación profunda",
      "Server startup": "Inicio del servidor",
      "Hook-to-broadcast latency": "Latencia del gancho a la transmisión",
      "JS bundle (63 KB gzipped)": "Paquete JS (63 KB comprimido con gzip)",
      "SQLite inserts/sec (WAL)": "Inserciones de SQLite/segundo (WAL)",
      "Events, Stats, Analytics": "Eventos, estadísticas, análisis",
      "First-Boot Bootstrap": "Bootstrap de arranque inicial",
      "Fresh-by-Default Caching": "Caching fresco por defecto",
      "GitHub Star History": "Historial de estrellas de GitHub",
      "Guided setup": "Configuración guiada",
      Health: "Salud",
      "History Import": "Importación de historial",
      "Hook Configuration": "Configuración del gancho",
      "Hook latency": "Latencia de ganchos",
      "Hook types captured": "Tipos de ganchos capturados",
      "Server memory": "Memoria del servidor",
      "Events before slowdown": "Eventos antes de que el rendimiento disminuya",
      "Hook Events Captured": "Eventos de captura de gancho",
      "Hook Handler Design": "Diseño del manipulador de ganchos",
      "Hook Installation Flow": "Flujo de instalación del gancho",
      "Hooks Ingestion": "Ingestión de ganchos",
      "How to Get It": "Cómo conseguirlo",
      "Idempotence & Cost Accuracy": "Idempotencia y precisión de costos",
      "Import History": "Historial de importaciones",
      "In-Process Architecture": "Arquitectura en proceso",
      Indexes: "Índices",
      Install: "Instalar",
      Installation: "Instalación",
      "Kanban Board": "Tablero Kanban",
      "Key Client Modules": "Módulos clave del cliente",
      Launch: "Iniciar",
      "Live Dashboard": "Panel de control en vivo",
      "Live Monitoring Sidebar": "Barra lateral de monitorización en tiempo real",
      "Interactive Analytics & Usage": "Análisis y uso interactivos",
      "Smart Auto-Detection & Connection": "Detección y conexión automáticas inteligentes",
      "Local MCP Server": "Servidor MCP local",
      "Local MCP Server Runtime": "Tiempo de ejecución del servidor MCP local",
      "Locale-aware formatting": "Formato con conciencia del lugar",
      "Menu-Bar / Notification-Area (Tray) Icon":
        "Icono de Barra de Menú / Área de Notificaciones ( bandeja)",
      "Message Envelope": "Envelope de mensaje",
      "Model Pricing": "Precio del modelo",
      "Multi-Stage Build": "Construcción de múltiples etapas",
      "Namespaced resources": "Recursos con espacio de nombres",
      "Native Application Menu": "Menú de aplicaciones nativas",
      "No sessions appearing after starting Claude Code":
        "No aparecen sesiones después de iniciar Claude Code",
      "Non-Blocking Detection": "Detección no bloqueante",
      "Notification Preferences": "Preferencias de notificaciones",
      "Open the DMG": "Abrir el DMG",
      "Optional: Enable MCP and Agent Extensions":
        "Opcional: Habilitar las extensiones MCP y Agent",
      "Plain Docker / Podman (no Compose)": "Docker / Podman simple (sin Compose)",
      "Plugin Architecture": "Arquitectura de plugins",
      Plugin: "Complemento",
      "Port Discovery": "Descubrimiento del puerto",
      Pricing: "Precios",
      "Progressive Web App": "Aplicación web progresiva",
      "Provider payloads": "Carga útil del proveedor",
      "PWA & Service Worker": "PWA y trabajador de servicio",
      "Reactive Mascot — Eight Moods": "Mascota reactiva — Ocho estados de ánimo",
      "Responsive Design": "Diseño Responsivo",
      "Root Helper Scripts": "Scripts de ayuda para root",
      "Rule types": "Tipos de reglas",
      "Run Claude": "Corra Claude",
      "Run the Installer": "Ejecutar el instalador",
      "Runs Alongside the Web Dashboard": "Funciona junto al panel de control web",
      "Safety Model": "Modelo de seguridad",
      Screenshots: "Capturas de pantalla",
      "Server Modules": "Módulos del servidor",
      "Session Detail": "Detalles de la sesión",
      "Session Drill-In": "Entrenamiento de la sesión",
      "Session State Machine": "Máquina de estado de sesión",
      Sessions: "Sesiones",
      "Sessions Table": "Tabla de sesiones",
      Settings: "Configuración",
      "Settings & Management": "Configuración y gestión",
      "Single-Instance Lock": "Bloqueo de instancia única",
      "Situation-Aware Command": "Comando con conciencia de la situación",
      "Skill Usage Examples": "Ejemplos de uso de habilidades",
      "Soft Failure Semantics": "Semántica de fallos suaves",
      "SQLite Configuration": "Configuración de SQLite",
      Start: "Inicio",
      Statusline: "Línea de estado",
      "Subagent Hierarchy": "Jerarquía de subagentes",
      "Supported Source Layouts": "Diseños de fuentes compatibles",
      "System Health": "Estado de salud del sistema",
      "Technical terms preserved": "Términos técnicos preservados",
      "The ⌘B Panel": "El panel ⌘B",
      "Three Modes, One Pipeline": "Tres modos, un solo flujo",
      "Transcript Cache": "Cache de transcripciones",
      "Two UI Surfaces": "Dos superficies de interfaz de usuario",
      "Upload Request Sequence": "Secuencia de solicitud de carga de archivos",
      "Use Claude": "Utiliza Claude",
      Verification: "Verificación",
      "Volume Mounts": "Montajes de volumen",
      Webhooks: "Webhooks",
      "WebSocket Progress Events": "Eventos de progreso de WebSocket",
      "WebSocket Push": "Push WebSocket",
      "What It Adds": "Lo que agrega",
      "Workflow Analytics": "Análisis de flujo de trabajo",
      "Workflow Graphs": "Gráficos de flujo de trabajo",
      "Workflow Runs": "Ejecuciones de flujos de trabajo",
      "ccam CLI": "CLI de ccam",
      Metrics: "Métricas",
      "How It Works": "Cómo funciona",
      "Data Scope": "Alcance de datos",
      "Live Status": "Estado en directo",
      "Security Model": "Modelo de seguridad",
      "API Endpoints": "Puntos finales de API",
      "WebSocket Events": "Eventos de WebSocket",
      CLI: "CLI",
      "12 discovery tabs": "12 pestañas de descubrimiento",
      "Safe mutations": "Modificaciones seguras",
      "Keybindings editor": "Editor de asignaciones de teclas",
      "Memory store": "Almacén de memoria",
      "Read-only by design": "Solo lectura por diseño",
      "Live refresh": "Actualización en tiempo real",
      "Editable vs read-only": "Editable frente a solo lectura",
      "API endpoints": "Puntos finales de API",
      Workflows: "Flujos de trabajo",
    },
    fr: {
      "Search docs...": "Rechercher dans la doc…",
      "No results found": "Aucun résultat",
      "Project Wiki": "Wiki du projet",
      "Real-time · Local-first · Zero-config": "Temps réel · Local d'abord · Zéro configuration",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Une plateforme professionnelle de surveillance de l'activité des agents Claude Code. Elle capture les sessions, les agents et les événements d'outils via des hooks natifs, les persiste dans SQLite et diffuse les mises à jour vers une interface React via WebSocket, sans aucun service externe.",
      "Getting Started": "Premiers pas",
      Architecture: "Architecture",
      "Data & APIs": "Données et API",
      Integrations: "Intégrations",
      "Ops & Reference": "Exploitation et référence",
      "◈ Architecture": "◈ Architecture",
      "◈ Components & UI": "◈ Composants et interface",
      "◈ Configuration": "◈ Configuration",
      "◈ Data": "◈ Données",
      "◈ Features": "◈ Fonctionnalités",
      "◈ Getting Started": "◈ Premiers pas",
      "◈ Integrations": "◈ Intégrations",
      "◈ Introduction": "◈ Introduction",
      "◈ Operations": "◈ Exploitation",
      "◈ Reference": "◈ Référence",
      Overview: "Vue d'ensemble",
      Features: "Fonctionnalités",
      "Quick Start": "Démarrage rapide",
      Configuration: "Configuration",
      "Scripts Reference": "Référence des scripts",
      "System Overview": "Vue d'ensemble du système",
      "What's Included": "Contenu",
      "System Architecture": "Architecture du système",
      "Data Flow": "Flux de données",
      "Server Architecture": "Architecture du serveur",
      "Client Architecture": "Architecture du client",
      "State Management": "Gestion de l'état",
      "Database Design": "Conception de la base de données",
      "API Reference": "Référence de l'API",
      "WebSocket Protocol": "Protocole WebSocket",
      "Hook Integration": "Intégration des hooks",
      "Import Pipeline": "Pipeline d'import",
      "MCP & Agent Extensions": "MCP et extensions d'agent",
      "Plugin Marketplace": "Marketplace de plugins",
      "Statusline Utility": "Utilitaire de barre d'état",
      "VS Code Extension": "Extension VS Code",
      "Desktop App (macOS & Windows)": "Application de bureau (macOS et Windows)",
      "Settings Page": "Page des paramètres",
      "Alerts & Webhooks": "Alertes et webhooks",
      "Update Notifier": "Notificateur de mise à jour",
      "Connection Status": "Statut de la connexion",
      "Prometheus & Grafana": "Prometheus et Grafana",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — compagnon félin réactif",
      Internationalization: "Internationalisation",
      "Internationalization (i18n)": "Internationalisation (i18n)",
      "Deployment Modes": "Modes de déploiement",
      "Docker / Podman": "Docker / Podman",
      Performance: "Performances",
      "Performance Characteristics": "Caractéristiques de performance",
      Security: "Sécurité",
      "Security Considerations": "Considérations de sécurité",
      Troubleshooting: "Dépannage",
      "Tech Choices": "Choix techniques",
      "Technology Choices": "Choix technologiques",
      "Check 1 — Is the server running?": "Vérification 1 — le serveur tourne-t-il ?",
      "Check 2 — Are hooks installed?": "Vérification 2 — les hooks sont-ils installés ?",
      "Check 3 — Start a new Claude Code session":
        "Vérification 3 — lancer une nouvelle session Claude Code",
      "Check 4 — Is Node.js in PATH?": "Vérification 4 — Node.js est-il dans le PATH ?",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "Option A — télécharger la dernière GitHub Release (recommandé)",
      "Option B — per-commit CI artifact": "Option B — artefact CI par commit",
      "Option C — build locally": "Option C — compiler en local",
      "14 first-class providers": "14 fournisseurs pris en charge nativement",
      "5-min Scheduler": "Planificateur de 5 min",
      "Accessibility & Resilience": "Accessibilité et résilience",
      "Activity Feed": "Flux d'activité",
      "Agent Extension Layout": "Structure des extensions d'agent",
      "Agent State Machine": "Machine à états des agents",
      Agents: "Agents",
      Alerts: "Alertes",
      "Alternative: Docker / Podman": "Alternative : Docker / Podman",
      Analytics: "Analytique",
      "API Surface": "Surface de l'API",
      "Ask → Run Claude Handoff": "Relais Demander → Lancer Claude",
      "Auto-Reload on Update": "Rechargement automatique à la mise à jour",
      "Auto-Start at Login": "Démarrage automatique à l'ouverture de session",
      "Auto-Surface Speech Bubbles": "Bulles de dialogue automatiques",
      "Available Plugins": "Plugins disponibles",
      "Bounded Cache Memory": "Mémoire de cache bornée",
      "Browser Notifications": "Notifications du navigateur",
      "Claude + Codex Extensions": "Extensions Claude + Codex",
      "Agent Config — Claude Code and Codex explorers":
        "Configuration de l'agent — explorateurs Claude Code et Codex",
      "Claude Config Explorer": "Explorateur de configuration Claude",
      "Clear Quarantine": "Lever la quarantaine",
      "Clear SmartScreen": "Passer SmartScreen",
      "CLI Tools": "Outils CLI",
      "Client Data Loading Pattern": "Modèle de chargement des données côté client",
      "Client Routes": "Routes du client",
      Clone: "Cloner",
      "Close Hides, Server Stays Up": "Fermer masque, le serveur reste actif",
      "Common Issues": "Problèmes courants",
      "Concurrency Timeline": "Chronologie de concurrence",
      "Constant-Time Sweep": "Balayage en temps constant",
      "Container Runtime (Docker / Podman)": "Environnement de conteneurs (Docker / Podman)",
      "Continuous Project Sync": "Synchronisation continue des projets",
      "Cost Tracking": "Suivi des coûts",
      "Data Export": "Export des données",
      "Data Management": "Gestion des données",
      "Data Model Reference": "Référence du modèle de données",
      "Data Persistence & CLI Reliability": "Persistance des données et fiabilité de la CLI",
      "Delivery engine": "Moteur de livraison",
      "Detection & fallback": "Détection et repli",
      "Dismissal Memory": "Mémorisation du rejet",
      "Docker Deployment": "Déploiement Docker",
      "Drag to Applications": "Glisser dans Applications",
      "Environment Variables": "Variables d'environnement",
      "Error Propagation Map": "Carte de propagation des erreurs",
      "Evaluation engine": "Moteur d'évaluation",
      "Event Ingestion Pipeline": "Pipeline d'ingestion des événements",
      "Embedded Dashboard & Deep Navigation": "Tableau de bord intégré et navigation profonde",
      "Server startup": "Démarrage du serveur",
      "Hook-to-broadcast latency": "Latence du hook à la diffusion",
      "JS bundle (63 KB gzipped)": "Bundle JS (63 KB gzippé)",
      "SQLite inserts/sec (WAL)": "Insertions SQLite/s (WAL)",
      "Events, Stats, Analytics": "Événements, statistiques, analytique",
      "First-Boot Bootstrap": "Amorçage au premier lancement",
      "Fresh-by-Default Caching": "Cache à jour par défaut",
      "GitHub Star History": "Historique des étoiles GitHub",
      "Guided setup": "Configuration guidée",
      Health: "Santé",
      "History Import": "Import de l'historique",
      "Hook Configuration": "Configuration des hooks",
      "Hook latency": "Latence des hooks",
      "Hook types captured": "Types de hooks capturés",
      "Server memory": "Mémoire du serveur",
      "Events before slowdown": "Événements avant ralentissement",
      "Hook Events Captured": "Événements de hook capturés",
      "Hook Handler Design": "Conception du gestionnaire de hooks",
      "Hook Installation Flow": "Processus d'installation des hooks",
      "Hooks Ingestion": "Ingestion des hooks",
      "How to Get It": "Comment l'obtenir",
      "Idempotence & Cost Accuracy": "Idempotence et exactitude des coûts",
      "Import History": "Importer l'historique",
      "In-Process Architecture": "Architecture intégrée au processus",
      Indexes: "Index",
      Install: "Installer",
      Installation: "Installation",
      "Kanban Board": "Tableau Kanban",
      "Key Client Modules": "Principaux modules du client",
      Launch: "Lancer",
      "Live Dashboard": "Tableau de bord en direct",
      "Live Monitoring Sidebar": "Barre latérale de surveillance en direct",
      "Interactive Analytics & Usage": "Analytique interactive et consommation",
      "Smart Auto-Detection & Connection": "Détection et connexion automatiques intelligentes",
      "Local MCP Server": "Serveur MCP local",
      "Local MCP Server Runtime": "Exécution du serveur MCP local",
      "Locale-aware formatting": "Formatage selon la langue",
      "Menu-Bar / Notification-Area (Tray) Icon": "Icône de barre de menus / zone de notification",
      "Message Envelope": "Enveloppe des messages",
      "Model Pricing": "Tarification des modèles",
      "Multi-Stage Build": "Build multi-étapes",
      "Namespaced resources": "Ressources par namespace",
      "Native Application Menu": "Menu d'application natif",
      "No sessions appearing after starting Claude Code":
        "Aucune session n'apparaît après le lancement de Claude Code",
      "Non-Blocking Detection": "Détection non bloquante",
      "Notification Preferences": "Préférences de notification",
      "Open the DMG": "Ouvrir le DMG",
      "Optional: Enable MCP and Agent Extensions":
        "Facultatif : activer MCP et les extensions d'agent",
      "Plain Docker / Podman (no Compose)": "Docker / Podman seul (sans Compose)",
      "Plugin Architecture": "Architecture des plugins",
      Plugin: "Plugin",
      "Port Discovery": "Découverte du port",
      Pricing: "Tarification",
      "Progressive Web App": "Progressive Web App",
      "Provider payloads": "Payloads par fournisseur",
      "PWA & Service Worker": "PWA et service worker",
      "Reactive Mascot — Eight Moods": "Mascotte réactive — huit humeurs",
      "Responsive Design": "Design adaptatif",
      "Root Helper Scripts": "Scripts utilitaires à la racine",
      "Rule types": "Types de règles",
      "Run Claude": "Lancer Claude",
      "Run the Installer": "Exécuter l'installateur",
      "Runs Alongside the Web Dashboard": "Fonctionne à côté du tableau de bord web",
      "Safety Model": "Modèle de sûreté",
      Screenshots: "Captures d'écran",
      "Server Modules": "Modules du serveur",
      "Session Detail": "Détail de la session",
      "Session Drill-In": "Exploration de session",
      "Session State Machine": "Machine à états des sessions",
      Sessions: "Sessions",
      "Sessions Table": "Tableau des sessions",
      Settings: "Paramètres",
      "Settings & Management": "Paramètres et gestion",
      "Single-Instance Lock": "Verrou d'instance unique",
      "Situation-Aware Command": "Commande adaptée à la situation",
      "Skill Usage Examples": "Exemples d'utilisation des skills",
      "Soft Failure Semantics": "Échecs non bloquants",
      "SQLite Configuration": "Configuration SQLite",
      Start: "Démarrer",
      Statusline: "Barre d'état",
      "Subagent Hierarchy": "Hiérarchie des sous-agents",
      "Supported Source Layouts": "Structures de source prises en charge",
      "System Health": "Santé du système",
      "Technical terms preserved": "Termes techniques préservés",
      "The ⌘B Panel": "Le panneau ⌘B",
      "Three Modes, One Pipeline": "Trois modes, un seul pipeline",
      "Transcript Cache": "Cache des transcriptions",
      "Two UI Surfaces": "Deux surfaces d'interface",
      "Upload Request Sequence": "Séquence de la requête de téléversement",
      "Use Claude": "Utiliser Claude",
      Verification: "Vérification",
      "Volume Mounts": "Montages de volumes",
      Webhooks: "Webhooks",
      "WebSocket Progress Events": "Événements de progression WebSocket",
      "WebSocket Push": "Push WebSocket",
      "What It Adds": "Ce qu'elle apporte",
      "Workflow Analytics": "Analytique des workflows",
      "Workflow Graphs": "Graphes des workflows",
      "Workflow Runs": "Exécutions de workflows",
      "ccam CLI": "CLI ccam",
      Metrics: "Métriques",
      "How It Works": "Fonctionnement",
      "Data Scope": "Périmètre des données",
      "Live Status": "Statut en direct",
      "Security Model": "Modèle de sécurité",
      "API Endpoints": "Points de terminaison de l'API",
      "WebSocket Events": "Événements WebSocket",
      CLI: "CLI",
      "12 discovery tabs": "12 onglets d'exploration",
      "Safe mutations": "Modifications sûres",
      "Keybindings editor": "Éditeur de raccourcis",
      "Memory store": "Stockage de la mémoire",
      "Read-only by design": "En lecture seule par conception",
      "Live refresh": "Actualisation en direct",
      "Editable vs read-only": "Modifiable ou en lecture seule",
      "API endpoints": "Points de terminaison de l'API",
      Workflows: "Workflows",
    },
    de: {
      "Search docs...": "Dokumentation durchsuchen…",
      "No results found": "Keine Ergebnisse gefunden",
      "Project Wiki": "Projekt-Wiki",
      "Real-time · Local-first · Zero-config": "Echtzeit · Local-First · Ohne Konfiguration",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Eine professionelle Überwachungsplattform für die Agent-Aktivität von Claude Code. Sie erfasst Sitzungen, Agents und Tool-Ereignisse über native Hooks, speichert sie in SQLite und streamt Updates über WebSocket an eine React-Oberfläche – ganz ohne externe Dienste.",
      "Getting Started": "Erste Schritte",
      Architecture: "Architektur",
      "Data & APIs": "Daten und APIs",
      Integrations: "Integrationen",
      "Ops & Reference": "Betrieb und Referenz",
      "◈ Architecture": "◈ Architektur",
      "◈ Components & UI": "◈ Komponenten und UI",
      "◈ Configuration": "◈ Konfiguration",
      "◈ Data": "◈ Daten",
      "◈ Features": "◈ Funktionen",
      "◈ Getting Started": "◈ Erste Schritte",
      "◈ Integrations": "◈ Integrationen",
      "◈ Introduction": "◈ Einführung",
      "◈ Operations": "◈ Betrieb",
      "◈ Reference": "◈ Referenz",
      Overview: "Übersicht",
      Features: "Funktionen",
      "Quick Start": "Schnellstart",
      Configuration: "Konfiguration",
      "Scripts Reference": "Skript-Referenz",
      "System Overview": "Systemübersicht",
      "What's Included": "Enthalten",
      "System Architecture": "Systemarchitektur",
      "Data Flow": "Datenfluss",
      "Server Architecture": "Serverarchitektur",
      "Client Architecture": "Client-Architektur",
      "State Management": "Zustandsverwaltung",
      "Database Design": "Datenbankdesign",
      "API Reference": "API-Referenz",
      "WebSocket Protocol": "WebSocket-Protokoll",
      "Hook Integration": "Hook-Integration",
      "Import Pipeline": "Import-Pipeline",
      "MCP & Agent Extensions": "MCP und Agent-Erweiterungen",
      "Plugin Marketplace": "Plugin-Marketplace",
      "Statusline Utility": "Statuszeilen-Werkzeug",
      "VS Code Extension": "VS-Code-Erweiterung",
      "Desktop App (macOS & Windows)": "Desktop-App (macOS und Windows)",
      "Settings Page": "Einstellungsseite",
      "Alerts & Webhooks": "Warnungen und Webhooks",
      "Update Notifier": "Update-Benachrichtigung",
      "Connection Status": "Verbindungsstatus",
      "Prometheus & Grafana": "Prometheus und Grafana",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — reaktive Katzen-Begleiterin",
      Internationalization: "Internationalisierung",
      "Internationalization (i18n)": "Internationalisierung (i18n)",
      "Deployment Modes": "Deployment-Modi",
      "Docker / Podman": "Docker / Podman",
      Performance: "Leistung",
      "Performance Characteristics": "Leistungsmerkmale",
      Security: "Sicherheit",
      "Security Considerations": "Sicherheitsaspekte",
      Troubleshooting: "Fehlerbehebung",
      "Tech Choices": "Technische Entscheidungen",
      "Technology Choices": "Technologieentscheidungen",
      "Check 1 — Is the server running?": "Prüfung 1 — Läuft der Server?",
      "Check 2 — Are hooks installed?": "Prüfung 2 — Sind die Hooks installiert?",
      "Check 3 — Start a new Claude Code session":
        "Prüfung 3 — Eine neue Claude-Code-Sitzung starten",
      "Check 4 — Is Node.js in PATH?": "Prüfung 4 — Ist Node.js im PATH?",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "Option A — das neueste GitHub Release herunterladen (empfohlen)",
      "Option B — per-commit CI artifact": "Option B — CI-Artefakt pro Commit",
      "Option C — build locally": "Option C — lokal bauen",
      "14 first-class providers": "14 nativ unterstützte Anbieter",
      "5-min Scheduler": "5-Minuten-Scheduler",
      "Accessibility & Resilience": "Barrierefreiheit und Robustheit",
      "Activity Feed": "Aktivitäts-Feed",
      "Agent Extension Layout": "Struktur der Agent-Erweiterungen",
      "Agent State Machine": "Zustandsautomat der Agents",
      Agents: "Agents",
      Alerts: "Warnungen",
      "Alternative: Docker / Podman": "Alternative: Docker / Podman",
      Analytics: "Analysen",
      "API Surface": "API-Oberfläche",
      "Ask → Run Claude Handoff": "Übergabe Fragen → Claude ausführen",
      "Auto-Reload on Update": "Automatisches Neuladen bei Updates",
      "Auto-Start at Login": "Autostart bei der Anmeldung",
      "Auto-Surface Speech Bubbles": "Automatisch erscheinende Sprechblasen",
      "Available Plugins": "Verfügbare Plugins",
      "Bounded Cache Memory": "Begrenzter Cache-Speicher",
      "Browser Notifications": "Browser-Benachrichtigungen",
      "Claude + Codex Extensions": "Claude- + Codex-Erweiterungen",
      "Agent Config — Claude Code and Codex explorers":
        "Agent-Konfiguration — Explorer für Claude Code und Codex",
      "Claude Config Explorer": "Claude-Konfigurations-Explorer",
      "Clear Quarantine": "Quarantäne aufheben",
      "Clear SmartScreen": "SmartScreen passieren",
      "CLI Tools": "CLI-Tools",
      "Client Data Loading Pattern": "Muster für das Laden von Client-Daten",
      "Client Routes": "Client-Routen",
      Clone: "Klonen",
      "Close Hides, Server Stays Up": "Schließen blendet aus, der Server läuft weiter",
      "Common Issues": "Häufige Probleme",
      "Concurrency Timeline": "Parallelitäts-Zeitleiste",
      "Constant-Time Sweep": "Bereinigung in konstanter Zeit",
      "Container Runtime (Docker / Podman)": "Container-Laufzeit (Docker / Podman)",
      "Continuous Project Sync": "Kontinuierliche Projektsynchronisierung",
      "Cost Tracking": "Kostenerfassung",
      "Data Export": "Datenexport",
      "Data Management": "Datenverwaltung",
      "Data Model Reference": "Datenmodell-Referenz",
      "Data Persistence & CLI Reliability": "Datenpersistenz und CLI-Zuverlässigkeit",
      "Delivery engine": "Zustell-Engine",
      "Detection & fallback": "Erkennung und Fallback",
      "Dismissal Memory": "Merken des Ausblendens",
      "Docker Deployment": "Docker-Deployment",
      "Drag to Applications": "In Programme ziehen",
      "Environment Variables": "Umgebungsvariablen",
      "Error Propagation Map": "Fehlerausbreitungskarte",
      "Evaluation engine": "Auswertungs-Engine",
      "Event Ingestion Pipeline": "Pipeline zur Ereigniserfassung",
      "Embedded Dashboard & Deep Navigation": "Eingebettetes Dashboard und tiefe Navigation",
      "Server startup": "Serverstart",
      "Hook-to-broadcast latency": "Latenz vom Hook bis zum Broadcast",
      "JS bundle (63 KB gzipped)": "JS-Bundle (63 KB gzip)",
      "SQLite inserts/sec (WAL)": "SQLite-Inserts/s (WAL)",
      "Events, Stats, Analytics": "Ereignisse, Statistiken, Analysen",
      "First-Boot Bootstrap": "Bootstrap beim ersten Start",
      "Fresh-by-Default Caching": "Standardmäßig frisches Caching",
      "GitHub Star History": "GitHub-Sternverlauf",
      "Guided setup": "Geführte Einrichtung",
      Health: "Zustand",
      "History Import": "Verlaufsimport",
      "Hook Configuration": "Hook-Konfiguration",
      "Hook latency": "Hook-Latenz",
      "Hook types captured": "Erfasste Hook-Typen",
      "Server memory": "Serverspeicher",
      "Events before slowdown": "Ereignisse vor Verlangsamung",
      "Hook Events Captured": "Erfasste Hook-Ereignisse",
      "Hook Handler Design": "Design des Hook-Handlers",
      "Hook Installation Flow": "Ablauf der Hook-Installation",
      "Hooks Ingestion": "Hook-Erfassung",
      "How to Get It": "So erhalten Sie sie",
      "Idempotence & Cost Accuracy": "Idempotenz und Kostengenauigkeit",
      "Import History": "Verlauf importieren",
      "In-Process Architecture": "In-Process-Architektur",
      Indexes: "Indizes",
      Install: "Installieren",
      Installation: "Installation",
      "Kanban Board": "Kanban-Board",
      "Key Client Modules": "Wichtige Client-Module",
      Launch: "Starten",
      "Live Dashboard": "Live-Dashboard",
      "Live Monitoring Sidebar": "Seitenleiste für Live-Überwachung",
      "Interactive Analytics & Usage": "Interaktive Analysen und Nutzung",
      "Smart Auto-Detection & Connection": "Intelligente automatische Erkennung und Verbindung",
      "Local MCP Server": "Lokaler MCP-Server",
      "Local MCP Server Runtime": "Laufzeit des lokalen MCP-Servers",
      "Locale-aware formatting": "Sprachabhängige Formatierung",
      "Menu-Bar / Notification-Area (Tray) Icon": "Symbol in Menüleiste / Infobereich (Tray)",
      "Message Envelope": "Nachrichtenumschlag",
      "Model Pricing": "Modellpreise",
      "Multi-Stage Build": "Multi-Stage-Build",
      "Namespaced resources": "Ressourcen nach Namespace",
      "Native Application Menu": "Natives Anwendungsmenü",
      "No sessions appearing after starting Claude Code":
        "Nach dem Start von Claude Code erscheinen keine Sitzungen",
      "Non-Blocking Detection": "Nicht blockierende Erkennung",
      "Notification Preferences": "Benachrichtigungseinstellungen",
      "Open the DMG": "DMG öffnen",
      "Optional: Enable MCP and Agent Extensions":
        "Optional: MCP und Agent-Erweiterungen aktivieren",
      "Plain Docker / Podman (no Compose)": "Reines Docker / Podman (ohne Compose)",
      "Plugin Architecture": "Plugin-Architektur",
      Plugin: "Plugin",
      "Port Discovery": "Port-Erkennung",
      Pricing: "Preise",
      "Progressive Web App": "Progressive Web App",
      "Provider payloads": "Anbieter-Payloads",
      "PWA & Service Worker": "PWA und Service Worker",
      "Reactive Mascot — Eight Moods": "Reaktives Maskottchen — acht Stimmungen",
      "Responsive Design": "Responsives Design",
      "Root Helper Scripts": "Hilfsskripte im Stammverzeichnis",
      "Rule types": "Regeltypen",
      "Run Claude": "Claude ausführen",
      "Run the Installer": "Installer ausführen",
      "Runs Alongside the Web Dashboard": "Läuft parallel zum Web-Dashboard",
      "Safety Model": "Sicherheitsmodell",
      Screenshots: "Screenshots",
      "Server Modules": "Servermodule",
      "Session Detail": "Sitzungsdetails",
      "Session Drill-In": "Sitzungs-Detailansicht",
      "Session State Machine": "Zustandsautomat der Sitzungen",
      Sessions: "Sitzungen",
      "Sessions Table": "Sitzungstabelle",
      Settings: "Einstellungen",
      "Settings & Management": "Einstellungen und Verwaltung",
      "Single-Instance Lock": "Einzelinstanz-Sperre",
      "Situation-Aware Command": "Situationsabhängiger Befehl",
      "Skill Usage Examples": "Beispiele zur Skill-Nutzung",
      "Soft Failure Semantics": "Weiche Fehlersemantik",
      "SQLite Configuration": "SQLite-Konfiguration",
      Start: "Starten",
      Statusline: "Statuszeile",
      "Subagent Hierarchy": "Subagent-Hierarchie",
      "Supported Source Layouts": "Unterstützte Quellstrukturen",
      "System Health": "Systemzustand",
      "Technical terms preserved": "Fachbegriffe bleiben erhalten",
      "The ⌘B Panel": "Das ⌘B-Panel",
      "Three Modes, One Pipeline": "Drei Modi, eine Pipeline",
      "Transcript Cache": "Transkript-Cache",
      "Two UI Surfaces": "Zwei UI-Oberflächen",
      "Upload Request Sequence": "Ablauf der Upload-Anfrage",
      "Use Claude": "Claude verwenden",
      Verification: "Überprüfung",
      "Volume Mounts": "Volume-Mounts",
      Webhooks: "Webhooks",
      "WebSocket Progress Events": "WebSocket-Fortschrittsereignisse",
      "WebSocket Push": "WebSocket-Push",
      "What It Adds": "Was sie hinzufügt",
      "Workflow Analytics": "Workflow-Analysen",
      "Workflow Graphs": "Workflow-Graphen",
      "Workflow Runs": "Workflow-Läufe",
      "ccam CLI": "ccam-CLI",
      Metrics: "Metriken",
      "How It Works": "Funktionsweise",
      "Data Scope": "Datenbereich",
      "Live Status": "Live-Status",
      "Security Model": "Sicherheitsmodell",
      "API Endpoints": "API-Endpunkte",
      "WebSocket Events": "WebSocket-Ereignisse",
      CLI: "CLI",
      "12 discovery tabs": "12 Erkundungs-Tabs",
      "Safe mutations": "Sichere Änderungen",
      "Keybindings editor": "Tastenkürzel-Editor",
      "Memory store": "Memory-Speicher",
      "Read-only by design": "Bewusst schreibgeschützt",
      "Live refresh": "Live-Aktualisierung",
      "Editable vs read-only": "Bearbeitbar vs. schreibgeschützt",
      "API endpoints": "API-Endpunkte",
      Workflows: "Workflows",
    },
    pt: {
      "Search docs...": "Pesquisar na documentação…",
      "No results found": "Nenhum resultado encontrado",
      "Project Wiki": "Wiki do projeto",
      "Real-time · Local-first · Zero-config": "Tempo real · Local primeiro · Zero configuração",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Uma plataforma profissional de monitoramento da atividade dos agentes do Claude Code. Captura sessões, agentes e eventos de ferramentas por meio de hooks nativos, persiste tudo no SQLite e transmite atualizações para uma interface React via WebSocket, sem nenhum serviço externo.",
      "Getting Started": "Primeiros passos",
      Architecture: "Arquitetura",
      "Data & APIs": "Dados e APIs",
      Integrations: "Integrações",
      "Ops & Reference": "Operação e referência",
      "◈ Architecture": "◈ Arquitetura",
      "◈ Components & UI": "◈ Componentes e interface",
      "◈ Configuration": "◈ Configuração",
      "◈ Data": "◈ Dados",
      "◈ Features": "◈ Recursos",
      "◈ Getting Started": "◈ Primeiros passos",
      "◈ Integrations": "◈ Integrações",
      "◈ Introduction": "◈ Introdução",
      "◈ Operations": "◈ Operação",
      "◈ Reference": "◈ Referência",
      Overview: "Visão geral",
      Features: "Recursos",
      "Quick Start": "Início rápido",
      Configuration: "Configuração",
      "Scripts Reference": "Referência de scripts",
      "System Overview": "Visão geral do sistema",
      "What's Included": "O que está incluído",
      "System Architecture": "Arquitetura do sistema",
      "Data Flow": "Fluxo de dados",
      "Server Architecture": "Arquitetura do servidor",
      "Client Architecture": "Arquitetura do cliente",
      "State Management": "Gerenciamento de estado",
      "Database Design": "Design do banco de dados",
      "API Reference": "Referência da API",
      "WebSocket Protocol": "Protocolo WebSocket",
      "Hook Integration": "Integração de hooks",
      "Import Pipeline": "Pipeline de importação",
      "MCP & Agent Extensions": "MCP e extensões de agente",
      "Plugin Marketplace": "Marketplace de plugins",
      "Statusline Utility": "Utilitário de linha de status",
      "VS Code Extension": "Extensão do VS Code",
      "Desktop App (macOS & Windows)": "App de desktop (macOS e Windows)",
      "Settings Page": "Página de configurações",
      "Alerts & Webhooks": "Alertas e webhooks",
      "Update Notifier": "Notificador de atualizações",
      "Connection Status": "Status da conexão",
      "Prometheus & Grafana": "Prometheus e Grafana",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — gato companheiro reativo",
      Internationalization: "Internacionalização",
      "Internationalization (i18n)": "Internacionalização (i18n)",
      "Deployment Modes": "Modos de implantação",
      "Docker / Podman": "Docker / Podman",
      Performance: "Desempenho",
      "Performance Characteristics": "Características de desempenho",
      Security: "Segurança",
      "Security Considerations": "Considerações de segurança",
      Troubleshooting: "Solução de problemas",
      "Tech Choices": "Escolhas técnicas",
      "Technology Choices": "Escolhas tecnológicas",
      "Check 1 — Is the server running?": "Verificação 1 — O servidor está rodando?",
      "Check 2 — Are hooks installed?": "Verificação 2 — Os hooks estão instalados?",
      "Check 3 — Start a new Claude Code session":
        "Verificação 3 — Inicie uma nova sessão do Claude Code",
      "Check 4 — Is Node.js in PATH?": "Verificação 4 — O Node.js está no PATH?",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "Opção A — baixar a última GitHub Release (recomendado)",
      "Option B — per-commit CI artifact": "Opção B — artefato de CI por commit",
      "Option C — build locally": "Opção C — compilar localmente",
      "14 first-class providers": "14 provedores com suporte nativo",
      "5-min Scheduler": "Agendador de 5 min",
      "Accessibility & Resilience": "Acessibilidade e resiliência",
      "Activity Feed": "Feed de atividade",
      "Agent Extension Layout": "Estrutura das extensões de agente",
      "Agent State Machine": "Máquina de estados dos agentes",
      Agents: "Agentes",
      Alerts: "Alertas",
      "Alternative: Docker / Podman": "Alternativa: Docker / Podman",
      Analytics: "Análises",
      "API Surface": "Superfície da API",
      "Ask → Run Claude Handoff": "Passagem Perguntar → Executar Claude",
      "Auto-Reload on Update": "Recarregamento automático na atualização",
      "Auto-Start at Login": "Início automático no login",
      "Auto-Surface Speech Bubbles": "Balões de fala automáticos",
      "Available Plugins": "Plugins disponíveis",
      "Bounded Cache Memory": "Memória de cache limitada",
      "Browser Notifications": "Notificações do navegador",
      "Claude + Codex Extensions": "Extensões Claude + Codex",
      "Agent Config — Claude Code and Codex explorers":
        "Configuração do agente — exploradores do Claude Code e do Codex",
      "Claude Config Explorer": "Explorador de configuração do Claude",
      "Clear Quarantine": "Remover a quarentena",
      "Clear SmartScreen": "Liberar o SmartScreen",
      "CLI Tools": "Ferramentas de CLI",
      "Client Data Loading Pattern": "Padrão de carregamento de dados no cliente",
      "Client Routes": "Rotas do cliente",
      Clone: "Clonar",
      "Close Hides, Server Stays Up": "Fechar oculta, o servidor continua ativo",
      "Common Issues": "Problemas comuns",
      "Concurrency Timeline": "Linha do tempo de concorrência",
      "Constant-Time Sweep": "Varredura em tempo constante",
      "Container Runtime (Docker / Podman)": "Runtime de contêineres (Docker / Podman)",
      "Continuous Project Sync": "Sincronização contínua de projetos",
      "Cost Tracking": "Rastreamento de custos",
      "Data Export": "Exportação de dados",
      "Data Management": "Gerenciamento de dados",
      "Data Model Reference": "Referência do modelo de dados",
      "Data Persistence & CLI Reliability": "Persistência de dados e confiabilidade da CLI",
      "Delivery engine": "Motor de entrega",
      "Detection & fallback": "Detecção e alternativa",
      "Dismissal Memory": "Memória de dispensa",
      "Docker Deployment": "Implantação com Docker",
      "Drag to Applications": "Arrastar para Aplicativos",
      "Environment Variables": "Variáveis de ambiente",
      "Error Propagation Map": "Mapa de propagação de erros",
      "Evaluation engine": "Motor de avaliação",
      "Event Ingestion Pipeline": "Pipeline de ingestão de eventos",
      "Embedded Dashboard & Deep Navigation": "Painel incorporado e navegação profunda",
      "Server startup": "Inicialização do servidor",
      "Hook-to-broadcast latency": "Latência do hook até a transmissão",
      "JS bundle (63 KB gzipped)": "Bundle JS (63 KB com gzip)",
      "SQLite inserts/sec (WAL)": "Inserções SQLite/s (WAL)",
      "Events, Stats, Analytics": "Eventos, estatísticas, análises",
      "First-Boot Bootstrap": "Inicialização na primeira execução",
      "Fresh-by-Default Caching": "Cache sempre atualizado por padrão",
      "GitHub Star History": "Histórico de estrelas no GitHub",
      "Guided setup": "Configuração guiada",
      Health: "Saúde",
      "History Import": "Importação do histórico",
      "Hook Configuration": "Configuração de hooks",
      "Hook latency": "Latência dos hooks",
      "Hook types captured": "Tipos de hook capturados",
      "Server memory": "Memória do servidor",
      "Events before slowdown": "Eventos antes da lentidão",
      "Hook Events Captured": "Eventos de hook capturados",
      "Hook Handler Design": "Design do manipulador de hooks",
      "Hook Installation Flow": "Fluxo de instalação dos hooks",
      "Hooks Ingestion": "Ingestão de hooks",
      "How to Get It": "Como obter",
      "Idempotence & Cost Accuracy": "Idempotência e precisão de custos",
      "Import History": "Importar histórico",
      "In-Process Architecture": "Arquitetura no mesmo processo",
      Indexes: "Índices",
      Install: "Instalar",
      Installation: "Instalação",
      "Kanban Board": "Quadro Kanban",
      "Key Client Modules": "Principais módulos do cliente",
      Launch: "Abrir",
      "Live Dashboard": "Painel ao vivo",
      "Live Monitoring Sidebar": "Barra lateral de monitoramento ao vivo",
      "Interactive Analytics & Usage": "Análises e uso interativos",
      "Smart Auto-Detection & Connection": "Detecção e conexão automáticas inteligentes",
      "Local MCP Server": "Servidor MCP local",
      "Local MCP Server Runtime": "Execução do servidor MCP local",
      "Locale-aware formatting": "Formatação conforme o idioma",
      "Menu-Bar / Notification-Area (Tray) Icon": "Ícone na barra de menus / área de notificação",
      "Message Envelope": "Envelope das mensagens",
      "Model Pricing": "Preços dos modelos",
      "Multi-Stage Build": "Build multiestágio",
      "Namespaced resources": "Recursos por namespace",
      "Native Application Menu": "Menu nativo do aplicativo",
      "No sessions appearing after starting Claude Code":
        "Nenhuma sessão aparece após iniciar o Claude Code",
      "Non-Blocking Detection": "Detecção não bloqueante",
      "Notification Preferences": "Preferências de notificação",
      "Open the DMG": "Abrir o DMG",
      "Optional: Enable MCP and Agent Extensions": "Opcional: ativar MCP e extensões de agente",
      "Plain Docker / Podman (no Compose)": "Docker / Podman puro (sem Compose)",
      "Plugin Architecture": "Arquitetura de plugins",
      Plugin: "Plugin",
      "Port Discovery": "Descoberta de porta",
      Pricing: "Preços",
      "Progressive Web App": "Progressive Web App",
      "Provider payloads": "Payloads por provedor",
      "PWA & Service Worker": "PWA e service worker",
      "Reactive Mascot — Eight Moods": "Mascote reativo — oito humores",
      "Responsive Design": "Design responsivo",
      "Root Helper Scripts": "Scripts auxiliares na raiz",
      "Rule types": "Tipos de regra",
      "Run Claude": "Executar Claude",
      "Run the Installer": "Executar o instalador",
      "Runs Alongside the Web Dashboard": "Roda junto com o painel web",
      "Safety Model": "Modelo de segurança",
      Screenshots: "Capturas de tela",
      "Server Modules": "Módulos do servidor",
      "Session Detail": "Detalhe da sessão",
      "Session Drill-In": "Detalhamento da sessão",
      "Session State Machine": "Máquina de estados das sessões",
      Sessions: "Sessões",
      "Sessions Table": "Tabela de sessões",
      Settings: "Configurações",
      "Settings & Management": "Configurações e gerenciamento",
      "Single-Instance Lock": "Bloqueio de instância única",
      "Situation-Aware Command": "Comando adaptado à situação",
      "Skill Usage Examples": "Exemplos de uso de skills",
      "Soft Failure Semantics": "Semântica de falha suave",
      "SQLite Configuration": "Configuração do SQLite",
      Start: "Iniciar",
      Statusline: "Linha de status",
      "Subagent Hierarchy": "Hierarquia de subagentes",
      "Supported Source Layouts": "Estruturas de origem suportadas",
      "System Health": "Saúde do sistema",
      "Technical terms preserved": "Termos técnicos preservados",
      "The ⌘B Panel": "O painel ⌘B",
      "Three Modes, One Pipeline": "Três modos, um pipeline",
      "Transcript Cache": "Cache de transcrições",
      "Two UI Surfaces": "Duas superfícies de interface",
      "Upload Request Sequence": "Sequência da requisição de envio",
      "Use Claude": "Usar o Claude",
      Verification: "Verificação",
      "Volume Mounts": "Montagens de volumes",
      Webhooks: "Webhooks",
      "WebSocket Progress Events": "Eventos de progresso via WebSocket",
      "WebSocket Push": "Push via WebSocket",
      "What It Adds": "O que ele acrescenta",
      "Workflow Analytics": "Análises de fluxos",
      "Workflow Graphs": "Grafos de fluxos",
      "Workflow Runs": "Execuções de fluxos",
      "ccam CLI": "CLI ccam",
      Metrics: "Métricas",
      "How It Works": "Como funciona",
      "Data Scope": "Escopo dos dados",
      "Live Status": "Status ao vivo",
      "Security Model": "Modelo de segurança",
      "API Endpoints": "Endpoints da API",
      "WebSocket Events": "Eventos WebSocket",
      CLI: "CLI",
      "12 discovery tabs": "12 abas de exploração",
      "Safe mutations": "Alterações seguras",
      "Keybindings editor": "Editor de atalhos",
      "Memory store": "Armazenamento de memória",
      "Read-only by design": "Somente leitura por design",
      "Live refresh": "Atualização ao vivo",
      "Editable vs read-only": "Editável vs. somente leitura",
      "API endpoints": "Endpoints da API",
      Workflows: "Fluxos",
    },
    it: {
      "Search docs...": "Cerca nella documentazione…",
      "No results found": "Nessun risultato trovato",
      "Project Wiki": "Wiki del progetto",
      "Real-time · Local-first · Zero-config": "Tempo reale · Local-first · Zero configurazione",
      "A professional monitoring platform for Claude Code agent activity. Captures sessions, agents, and tool events via native hooks, persists them in SQLite, and streams updates to a React UI over WebSocket — with no external services required.":
        "Una piattaforma professionale di monitoraggio dell'attività degli agenti di Claude Code. Acquisisce sessioni, agenti ed eventi degli strumenti tramite hook nativi, li salva in SQLite e trasmette gli aggiornamenti a un'interfaccia React tramite WebSocket, senza alcun servizio esterno.",
      "Getting Started": "Primi passi",
      Architecture: "Architettura",
      "Data & APIs": "Dati e API",
      Integrations: "Integrazioni",
      "Ops & Reference": "Operatività e riferimento",
      "◈ Architecture": "◈ Architettura",
      "◈ Components & UI": "◈ Componenti e interfaccia",
      "◈ Configuration": "◈ Configurazione",
      "◈ Data": "◈ Dati",
      "◈ Features": "◈ Funzionalità",
      "◈ Getting Started": "◈ Primi passi",
      "◈ Integrations": "◈ Integrazioni",
      "◈ Introduction": "◈ Introduzione",
      "◈ Operations": "◈ Operatività",
      "◈ Reference": "◈ Riferimento",
      Overview: "Panoramica",
      Features: "Funzionalità",
      "Quick Start": "Avvio rapido",
      Configuration: "Configurazione",
      "Scripts Reference": "Riferimento degli script",
      "System Overview": "Panoramica del sistema",
      "What's Included": "Cosa include",
      "System Architecture": "Architettura del sistema",
      "Data Flow": "Flusso dei dati",
      "Server Architecture": "Architettura del server",
      "Client Architecture": "Architettura del client",
      "State Management": "Gestione dello stato",
      "Database Design": "Progettazione del database",
      "API Reference": "Riferimento API",
      "WebSocket Protocol": "Protocollo WebSocket",
      "Hook Integration": "Integrazione degli hook",
      "Import Pipeline": "Pipeline di importazione",
      "MCP & Agent Extensions": "MCP ed estensioni degli agenti",
      "Plugin Marketplace": "Marketplace dei plugin",
      "Statusline Utility": "Utility della riga di stato",
      "VS Code Extension": "Estensione per VS Code",
      "Desktop App (macOS & Windows)": "App desktop (macOS e Windows)",
      "Settings Page": "Pagina delle impostazioni",
      "Alerts & Webhooks": "Avvisi e webhook",
      "Update Notifier": "Notifica degli aggiornamenti",
      "Connection Status": "Stato della connessione",
      "Prometheus & Grafana": "Prometheus e Grafana",
      Tabby: "Tabby",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — gatto compagno reattivo",
      Internationalization: "Internazionalizzazione",
      "Internationalization (i18n)": "Internazionalizzazione (i18n)",
      "Deployment Modes": "Modalità di deploy",
      "Docker / Podman": "Docker / Podman",
      Performance: "Prestazioni",
      "Performance Characteristics": "Caratteristiche prestazionali",
      Security: "Sicurezza",
      "Security Considerations": "Considerazioni sulla sicurezza",
      Troubleshooting: "Risoluzione dei problemi",
      "Tech Choices": "Scelte tecniche",
      "Technology Choices": "Scelte tecnologiche",
      "Check 1 — Is the server running?": "Verifica 1 — Il server è in esecuzione?",
      "Check 2 — Are hooks installed?": "Verifica 2 — Gli hook sono installati?",
      "Check 3 — Start a new Claude Code session":
        "Verifica 3 — Avvia una nuova sessione Claude Code",
      "Check 4 — Is Node.js in PATH?": "Verifica 4 — Node.js è nel PATH?",
      macOS: "macOS",
      Windows: "Windows",
      "Option A — download the latest GitHub Release (recommended)":
        "Opzione A — scarica l'ultima GitHub Release (consigliata)",
      "Option B — per-commit CI artifact": "Opzione B — artefatto CI per commit",
      "Option C — build locally": "Opzione C — compila in locale",
      "14 first-class providers": "14 provider supportati nativamente",
      "5-min Scheduler": "Scheduler di 5 min",
      "Accessibility & Resilience": "Accessibilità e resilienza",
      "Activity Feed": "Feed attività",
      "Agent Extension Layout": "Struttura delle estensioni degli agenti",
      "Agent State Machine": "Macchina a stati degli agenti",
      Agents: "Agenti",
      Alerts: "Avvisi",
      "Alternative: Docker / Podman": "Alternativa: Docker / Podman",
      Analytics: "Analisi",
      "API Surface": "Superficie API",
      "Ask → Run Claude Handoff": "Passaggio Chiedi → Esegui Claude",
      "Auto-Reload on Update": "Ricaricamento automatico all'aggiornamento",
      "Auto-Start at Login": "Avvio automatico all'accesso",
      "Auto-Surface Speech Bubbles": "Fumetti che compaiono automaticamente",
      "Available Plugins": "Plugin disponibili",
      "Bounded Cache Memory": "Memoria di cache limitata",
      "Browser Notifications": "Notifiche del browser",
      "Claude + Codex Extensions": "Estensioni Claude + Codex",
      "Agent Config — Claude Code and Codex explorers":
        "Configurazione agente — esploratori di Claude Code e Codex",
      "Claude Config Explorer": "Esplora configurazione di Claude",
      "Clear Quarantine": "Rimuovi la quarantena",
      "Clear SmartScreen": "Supera SmartScreen",
      "CLI Tools": "Strumenti CLI",
      "Client Data Loading Pattern": "Schema di caricamento dei dati lato client",
      "Client Routes": "Route del client",
      Clone: "Clona",
      "Close Hides, Server Stays Up": "Chiudere nasconde, il server resta attivo",
      "Common Issues": "Problemi comuni",
      "Concurrency Timeline": "Cronologia della concorrenza",
      "Constant-Time Sweep": "Pulizia a tempo costante",
      "Container Runtime (Docker / Podman)": "Runtime dei container (Docker / Podman)",
      "Continuous Project Sync": "Sincronizzazione continua dei progetti",
      "Cost Tracking": "Tracciamento dei costi",
      "Data Export": "Esportazione dei dati",
      "Data Management": "Gestione dei dati",
      "Data Model Reference": "Riferimento del modello dati",
      "Data Persistence & CLI Reliability": "Persistenza dei dati e affidabilità della CLI",
      "Delivery engine": "Motore di consegna",
      "Detection & fallback": "Rilevamento e fallback",
      "Dismissal Memory": "Memoria della chiusura",
      "Docker Deployment": "Deploy con Docker",
      "Drag to Applications": "Trascina in Applicazioni",
      "Environment Variables": "Variabili d'ambiente",
      "Error Propagation Map": "Mappa di propagazione degli errori",
      "Evaluation engine": "Motore di valutazione",
      "Event Ingestion Pipeline": "Pipeline di acquisizione degli eventi",
      "Embedded Dashboard & Deep Navigation": "Dashboard integrata e navigazione profonda",
      "Server startup": "Avvio del server",
      "Hook-to-broadcast latency": "Latenza dall'hook alla trasmissione",
      "JS bundle (63 KB gzipped)": "Bundle JS (63 KB compresso con gzip)",
      "SQLite inserts/sec (WAL)": "Inserimenti SQLite/s (WAL)",
      "Events, Stats, Analytics": "Eventi, statistiche, analisi",
      "First-Boot Bootstrap": "Bootstrap al primo avvio",
      "Fresh-by-Default Caching": "Cache sempre aggiornata per impostazione predefinita",
      "GitHub Star History": "Cronologia delle stelle su GitHub",
      "Guided setup": "Configurazione guidata",
      Health: "Stato",
      "History Import": "Importazione della cronologia",
      "Hook Configuration": "Configurazione degli hook",
      "Hook latency": "Latenza degli hook",
      "Hook types captured": "Tipi di hook acquisiti",
      "Server memory": "Memoria del server",
      "Events before slowdown": "Eventi prima del rallentamento",
      "Hook Events Captured": "Eventi hook acquisiti",
      "Hook Handler Design": "Progettazione del gestore degli hook",
      "Hook Installation Flow": "Flusso di installazione degli hook",
      "Hooks Ingestion": "Acquisizione degli hook",
      "How to Get It": "Come ottenerla",
      "Idempotence & Cost Accuracy": "Idempotenza e accuratezza dei costi",
      "Import History": "Importa cronologia",
      "In-Process Architecture": "Architettura in-process",
      Indexes: "Indici",
      Install: "Installa",
      Installation: "Installazione",
      "Kanban Board": "Bacheca Kanban",
      "Key Client Modules": "Moduli principali del client",
      Launch: "Avvia",
      "Live Dashboard": "Dashboard in diretta",
      "Live Monitoring Sidebar": "Barra laterale di monitoraggio in diretta",
      "Interactive Analytics & Usage": "Analisi e utilizzo interattivi",
      "Smart Auto-Detection & Connection": "Rilevamento e connessione automatici intelligenti",
      "Local MCP Server": "Server MCP locale",
      "Local MCP Server Runtime": "Runtime del server MCP locale",
      "Locale-aware formatting": "Formattazione in base alla lingua",
      "Menu-Bar / Notification-Area (Tray) Icon": "Icona nella barra dei menu / area di notifica",
      "Message Envelope": "Busta dei messaggi",
      "Model Pricing": "Prezzi dei modelli",
      "Multi-Stage Build": "Build multi-stage",
      "Namespaced resources": "Risorse per namespace",
      "Native Application Menu": "Menu nativo dell'applicazione",
      "No sessions appearing after starting Claude Code":
        "Nessuna sessione visibile dopo l'avvio di Claude Code",
      "Non-Blocking Detection": "Rilevamento non bloccante",
      "Notification Preferences": "Preferenze di notifica",
      "Open the DMG": "Apri il DMG",
      "Optional: Enable MCP and Agent Extensions":
        "Facoltativo: attiva MCP e le estensioni degli agenti",
      "Plain Docker / Podman (no Compose)": "Docker / Podman semplice (senza Compose)",
      "Plugin Architecture": "Architettura dei plugin",
      Plugin: "Plugin",
      "Port Discovery": "Rilevamento della porta",
      Pricing: "Prezzi",
      "Progressive Web App": "Progressive Web App",
      "Provider payloads": "Payload per provider",
      "PWA & Service Worker": "PWA e service worker",
      "Reactive Mascot — Eight Moods": "Mascotte reattiva — otto stati d'animo",
      "Responsive Design": "Design responsive",
      "Root Helper Scripts": "Script di supporto nella radice",
      "Rule types": "Tipi di regola",
      "Run Claude": "Esegui Claude",
      "Run the Installer": "Esegui il programma di installazione",
      "Runs Alongside the Web Dashboard": "Funziona insieme alla dashboard web",
      "Safety Model": "Modello di sicurezza",
      Screenshots: "Screenshot",
      "Server Modules": "Moduli del server",
      "Session Detail": "Dettaglio della sessione",
      "Session Drill-In": "Dettaglio della sessione",
      "Session State Machine": "Macchina a stati delle sessioni",
      Sessions: "Sessioni",
      "Sessions Table": "Tabella delle sessioni",
      Settings: "Impostazioni",
      "Settings & Management": "Impostazioni e gestione",
      "Single-Instance Lock": "Blocco a istanza singola",
      "Situation-Aware Command": "Comando adatto alla situazione",
      "Skill Usage Examples": "Esempi di uso delle skill",
      "Soft Failure Semantics": "Semantica di errore non bloccante",
      "SQLite Configuration": "Configurazione di SQLite",
      Start: "Avvia",
      Statusline: "Riga di stato",
      "Subagent Hierarchy": "Gerarchia dei subagenti",
      "Supported Source Layouts": "Strutture di origine supportate",
      "System Health": "Stato del sistema",
      "Technical terms preserved": "Termini tecnici preservati",
      "The ⌘B Panel": "Il pannello ⌘B",
      "Three Modes, One Pipeline": "Tre modalità, una pipeline",
      "Transcript Cache": "Cache delle trascrizioni",
      "Two UI Surfaces": "Due superfici di interfaccia",
      "Upload Request Sequence": "Sequenza della richiesta di caricamento",
      "Use Claude": "Usa Claude",
      Verification: "Verifica",
      "Volume Mounts": "Mount dei volumi",
      Webhooks: "Webhook",
      "WebSocket Progress Events": "Eventi di avanzamento WebSocket",
      "WebSocket Push": "Push WebSocket",
      "What It Adds": "Cosa aggiunge",
      "Workflow Analytics": "Analisi dei flussi",
      "Workflow Graphs": "Grafi dei flussi",
      "Workflow Runs": "Esecuzioni dei flussi",
      "ccam CLI": "CLI ccam",
      Metrics: "Metriche",
      "How It Works": "Come funziona",
      "Data Scope": "Ambito dei dati",
      "Live Status": "Stato in diretta",
      "Security Model": "Modello di sicurezza",
      "API Endpoints": "Endpoint API",
      "WebSocket Events": "Eventi WebSocket",
      CLI: "CLI",
      "12 discovery tabs": "12 schede di esplorazione",
      "Safe mutations": "Modifiche sicure",
      "Keybindings editor": "Editor delle scorciatoie",
      "Memory store": "Archivio della memoria",
      "Read-only by design": "In sola lettura per scelta",
      "Live refresh": "Aggiornamento in diretta",
      "Editable vs read-only": "Modificabile vs sola lettura",
      "API endpoints": "Endpoint API",
      Workflows: "Flussi",
    },
  };

  const PLAIN =
    ".logo-sub, .section-label, .nav-section, .nav-empty, .stat-label, .t-label, .main-content h2, .main-content h3, .main-content h4, .main-content th, .hero-desc";
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
  const H = {
    zh: CONTENT.zh || {},
    vi: CONTENT.vi || {},
    ko: CONTENT.ko || {},
    es: CONTENT.es || {},
    fr: CONTENT.fr || {},
    de: CONTENT.de || {},
    pt: CONTENT.pt || {},
    it: CONTENT.it || {},
  };
  // Attribute values do not participate in the body-content pass above. Keep
  // image descriptions and assistive labels localized in every wiki language.
  const ATTRIBUTE_TRANSLATIONS = {
    "Command Palette open over the Sessions page": {
      zh: "在会话页面上打开的命令面板",
      vi: "Bảng lệnh đang mở trên trang Phiên",
      ko: "세션 페이지 위에 열린 명령 팔레트",
      es: "La paleta de comandos abierta sobre la página de Sesiones",
      fr: "La palette de commandes ouverte sur la page Sessions",
      de: "Die Befehlspalette, geöffnet über der Seite Sitzungen",
      pt: "A paleta de comandos aberta sobre a página Sessões",
      it: "La palette dei comandi aperta sopra la pagina Sessioni",
    },
    "Wiki navigation": {
      zh: "维基导航",
      vi: "Điều hướng wiki",
      ko: "위키 탐색",
      es: "Navegación de la wiki",
      fr: "Navigation du wiki",
      de: "Wiki-Navigation",
      pt: "Navegação do wiki",
      it: "Navigazione del wiki",
    },
    "Toggle sidebar": {
      zh: "切换侧边栏",
      vi: "Bật hoặc tắt thanh bên",
      ko: "사이드바 전환",
      es: "Alternar barra lateral",
      fr: "Afficher ou masquer la barre latérale",
      de: "Seitenleiste ein- oder ausblenden",
      pt: "Mostrar ou ocultar a barra lateral",
      it: "Mostra o nascondi la barra laterale",
    },
    "Search docs...": {
      zh: "搜索文档…",
      vi: "Tìm tài liệu…",
      ko: "문서 검색…",
      es: "Buscar documentación…",
      fr: "Rechercher dans la doc…",
      de: "Dokumentation durchsuchen…",
      pt: "Pesquisar na documentação…",
      it: "Cerca nella documentazione…",
    },
    "Select language": {
      zh: "选择语言",
      vi: "Chọn ngôn ngữ",
      ko: "언어 선택",
      es: "Seleccionar idioma",
      fr: "Choisir la langue",
      de: "Sprache auswählen",
      pt: "Selecionar idioma",
      it: "Seleziona la lingua",
    },
    Language: {
      zh: "语言",
      vi: "Ngôn ngữ",
      ko: "언어",
      es: "Idioma",
      fr: "Langue",
      de: "Sprache",
      pt: "Idioma",
      it: "Lingua",
    },
    "Claude Code Agent Monitor dashboard showing live agent cards, stats, and recent activity feed":
      {
        zh: "Claude Code Agent Monitor 仪表盘，显示实时 Agent 卡片、统计数据和最近活动流",
        vi: "Bảng điều khiển Claude Code Agent Monitor hiển thị thẻ Agent trực tiếp, số liệu và luồng hoạt động gần đây",
        ko: "실시간 Agent 카드, 통계, 최근 활동 피드를 보여 주는 Claude Code Agent Monitor 대시보드",
        es: "Panel de Claude Code Agent Monitor con tarjetas de Agent en tiempo real, estadísticas y actividad reciente",
        fr: "Le tableau de bord de Claude Code Agent Monitor avec les cartes d'agents en direct, les statistiques et le flux d'activité récente",
        de: "Das Dashboard von Claude Code Agent Monitor mit Live-Agent-Karten, Statistiken und dem Feed der letzten Aktivität",
        pt: "O painel do Claude Code Agent Monitor com cartões de agentes ao vivo, estatísticas e o feed de atividade recente",
        it: "La dashboard di Claude Code Agent Monitor con le schede degli agenti in diretta, le statistiche e il feed dell'attività recente",
      },
    "Previous features": {
      zh: "上一组功能",
      vi: "Tính năng trước",
      ko: "이전 기능",
      es: "Funciones anteriores",
      fr: "Fonctionnalités précédentes",
      de: "Vorherige Funktionen",
      pt: "Recursos anteriores",
      it: "Funzionalità precedenti",
    },
    "Next features": {
      zh: "下一组功能",
      vi: "Tính năng tiếp theo",
      ko: "다음 기능",
      es: "Funciones siguientes",
      fr: "Fonctionnalités suivantes",
      de: "Nächste Funktionen",
      pt: "Próximos recursos",
      it: "Funzionalità successive",
    },
    "Dashboard Overview": {
      zh: "仪表盘概览",
      vi: "Tổng quan bảng điều khiển",
      ko: "대시보드 개요",
      es: "Resumen del panel",
      fr: "Vue d'ensemble du tableau de bord",
      de: "Dashboard-Übersicht",
      pt: "Visão geral do painel",
      it: "Panoramica della dashboard",
    },
    "Dashboard — System Health tab": {
      zh: "仪表盘 — 系统健康标签页",
      vi: "Bảng điều khiển — tab Sức khỏe hệ thống",
      ko: "대시보드 — 시스템 상태 탭",
      es: "Panel — pestaña Estado del sistema",
      fr: "Tableau de bord — onglet Santé du système",
      de: "Dashboard — Tab Systemzustand",
      pt: "Painel — aba Saúde do sistema",
      it: "Dashboard — scheda Stato del sistema",
    },
    "Kanban Board — Agents view": {
      zh: "看板 — Agent 视图",
      vi: "Bảng Kanban — chế độ xem Agent",
      ko: "칸반 보드 — Agent 보기",
      es: "Tablero Kanban — vista de Agent",
      fr: "Tableau Kanban — vue Agents",
      de: "Kanban-Board — Ansicht Agents",
      pt: "Quadro Kanban — visão Agentes",
      it: "Bacheca Kanban — vista Agenti",
    },
    "Kanban Board — Sessions view": {
      zh: "看板 — 会话视图",
      vi: "Bảng Kanban — chế độ xem phiên",
      ko: "칸반 보드 — 세션 보기",
      es: "Tablero Kanban — vista de sesiones",
      fr: "Tableau Kanban — vue Sessions",
      de: "Kanban-Board — Ansicht Sitzungen",
      pt: "Quadro Kanban — visão Sessões",
      it: "Bacheca Kanban — vista Sessioni",
    },
    "Sessions Overview": {
      zh: "会话概览",
      vi: "Tổng quan phiên",
      ko: "세션 개요",
      es: "Resumen de sesiones",
      fr: "Vue d'ensemble des sessions",
      de: "Sitzungsübersicht",
      pt: "Visão geral das sessões",
      it: "Panoramica delle sessioni",
    },
    "Session Detail — Agents tab": {
      zh: "会话详情 — Agent 标签页",
      vi: "Chi tiết phiên — tab Agent",
      ko: "세션 상세 — Agent 탭",
      es: "Detalle de sesión — pestaña Agent",
      fr: "Détail de la session — onglet Agents",
      de: "Sitzungsdetails — Tab Agents",
      pt: "Detalhe da sessão — aba Agentes",
      it: "Dettaglio della sessione — scheda Agenti",
    },
    "Task Progress panel on Session Detail": {
      zh: "会话详情中的任务进度面板",
      vi: "Bảng tiến độ tác vụ trong Chi tiết phiên",
      ko: "세션 상세의 작업 진행률 패널",
      es: "Panel de progreso de tareas en el detalle de sesión",
      fr: "Panneau Avancement des tâches dans le détail de la session",
      de: "Bereich Aufgabenfortschritt in den Sitzungsdetails",
      pt: "Painel Progresso das tarefas no detalhe da sessão",
      it: "Pannello Avanzamento attività nel dettaglio della sessione",
    },
    "Session Detail — Conversation tab": {
      zh: "会话详情 — 对话标签页",
      vi: "Chi tiết phiên — tab Hội thoại",
      ko: "세션 상세 — 대화 탭",
      es: "Detalle de sesión — pestaña Conversación",
      fr: "Détail de la session — onglet Conversation",
      de: "Sitzungsdetails — Tab Konversation",
      pt: "Detalhe da sessão — aba Conversa",
      it: "Dettaglio della sessione — scheda Conversazione",
    },
    "Session Detail — Timeline tab": {
      zh: "会话详情 — 时间线标签页",
      vi: "Chi tiết phiên — tab Dòng thời gian",
      ko: "세션 상세 — 타임라인 탭",
      es: "Detalle de sesión — pestaña Cronología",
      fr: "Détail de la session — onglet Chronologie",
      de: "Sitzungsdetails — Tab Zeitleiste",
      pt: "Detalhe da sessão — aba Linha do tempo",
      it: "Dettaglio della sessione — scheda Cronologia",
    },
    "Activity Feed Overview": {
      zh: "活动流概览",
      vi: "Tổng quan luồng hoạt động",
      ko: "활동 피드 개요",
      es: "Resumen del feed de actividad",
      fr: "Vue d'ensemble du flux d'activité",
      de: "Übersicht des Aktivitäts-Feeds",
      pt: "Visão geral do feed de atividade",
      it: "Panoramica del feed attività",
    },
    "Analytics Overview": {
      zh: "分析概览",
      vi: "Tổng quan phân tích",
      ko: "분석 개요",
      es: "Resumen de análisis",
      fr: "Vue d'ensemble de l'analytique",
      de: "Analyseübersicht",
      pt: "Visão geral das análises",
      it: "Panoramica delle analisi",
    },
    "Workflows Overview": {
      zh: "工作流概览",
      vi: "Tổng quan quy trình",
      ko: "워크플로 개요",
      es: "Resumen de flujos de trabajo",
      fr: "Vue d'ensemble des workflows",
      de: "Workflow-Übersicht",
      pt: "Visão geral dos fluxos",
      it: "Panoramica dei flussi",
    },
    "Dynamic Workflow Runs on the Workflows page": {
      zh: "工作流页面上的动态工作流运行",
      vi: "Các lần chạy quy trình động trên trang Quy trình",
      ko: "워크플로 페이지의 동적 워크플로 실행",
      es: "Ejecuciones dinámicas en la página Flujos de trabajo",
      fr: "Exécutions de workflows dynamiques sur la page Workflows",
      de: "Dynamische Workflow-Läufe auf der Seite Workflows",
      pt: "Execuções de fluxos dinâmicos na página Fluxos",
      it: "Esecuzioni di flussi dinamici nella pagina Flussi",
    },
    "Dynamic Workflow Run expanded with phase filters and per-agent results": {
      zh: "展开的动态工作流运行，包含阶段筛选和逐 Agent 结果",
      vi: "Lần chạy quy trình động đã mở rộng với bộ lọc giai đoạn và kết quả theo Agent",
      ko: "단계 필터와 Agent별 결과를 펼쳐 본 동적 워크플로 실행",
      es: "Ejecución dinámica expandida con filtros de fase y resultados por Agent",
      fr: "Exécution de workflow dynamique dépliée avec filtres de phase et résultats par agent",
      de: "Aufgeklappter dynamischer Workflow-Lauf mit Phasenfiltern und Ergebnissen pro Agent",
      pt: "Execução de fluxo dinâmico expandida com filtros de fase e resultados por agente",
      it: "Esecuzione di flusso dinamico espansa con filtri di fase e risultati per agente",
    },
    "Dynamic Workflow Runs on the session detail page": {
      zh: "会话详情页面上的动态工作流运行",
      vi: "Các lần chạy quy trình động trên trang chi tiết phiên",
      ko: "세션 상세 페이지의 동적 워크플로 실행",
      es: "Ejecuciones dinámicas en la página de detalle de sesión",
      fr: "Exécutions de workflows dynamiques sur la page de détail de la session",
      de: "Dynamische Workflow-Läufe auf der Seite der Sitzungsdetails",
      pt: "Execuções de fluxos dinâmicos na página de detalhe da sessão",
      it: "Esecuzioni di flussi dinamici nella pagina di dettaglio della sessione",
    },
    "Agent Config — Claude Code and Codex explorers": {
      zh: "Agent 配置 — Claude Code 和 Codex 浏览器",
      vi: "Cấu hình Agent — trình khám phá Claude Code và Codex",
      ko: "Agent 구성 — Claude Code 및 Codex 탐색기",
      es: "Configuración de Agent — exploradores de Claude Code y Codex",
      fr: "Configuration de l'agent — explorateurs Claude Code et Codex",
      de: "Agent-Konfiguration — Explorer für Claude Code und Codex",
      pt: "Configuração do agente — exploradores do Claude Code e do Codex",
      it: "Configurazione agente — esploratori di Claude Code e Codex",
    },
    "Claude Config Explorer": {
      zh: "Claude 配置浏览器",
      vi: "Trình khám phá cấu hình Claude",
      ko: "Claude 구성 탐색기",
      es: "Explorador de configuración de Claude",
      fr: "Explorateur de configuration Claude",
      de: "Claude-Konfigurations-Explorer",
      pt: "Explorador de configuração do Claude",
      it: "Esplora configurazione di Claude",
    },
    "Codex Config Explorer — overview, configuration source, and workspace tabs": {
      zh: "Codex 配置浏览器 — 概览、配置源和工作区标签页",
      vi: "Trình khám phá cấu hình Codex — các tab tổng quan, nguồn cấu hình và workspace",
      ko: "Codex 구성 탐색기 — 개요, 구성 소스, 워크스페이스 탭",
      es: "Explorador de configuración de Codex — pestañas de resumen, fuente y espacio de trabajo",
      fr: "Explorateur de configuration Codex — vue d'ensemble, source de configuration et onglets de l'espace de travail",
      de: "Codex-Konfigurations-Explorer — Übersicht, Konfigurationsquelle und Workspace-Tabs",
      pt: "Explorador de configuração do Codex — visão geral, fonte da configuração e abas do workspace",
      it: "Esplora configurazione di Codex — panoramica, fonte della configurazione e schede del workspace",
    },
    "Claude Config Explorer — Skills tab": {
      zh: "Claude 配置浏览器 — 技能标签页",
      vi: "Trình khám phá cấu hình Claude — tab Skill",
      ko: "Claude 구성 탐색기 — 스킬 탭",
      es: "Explorador de configuración de Claude — pestaña Habilidades",
      fr: "Explorateur de configuration Claude — onglet Skills",
      de: "Claude-Konfigurations-Explorer — Tab Skills",
      pt: "Explorador de configuração do Claude — aba Skills",
      it: "Esplora configurazione di Claude — scheda Skill",
    },
    "Run Agent — Claude Code and Codex launch selection": {
      zh: "运行 Agent — 选择启动 Claude Code 或 Codex",
      vi: "Chạy Agent — chọn khởi chạy Claude Code hoặc Codex",
      ko: "Agent 실행 — Claude Code 및 Codex 실행 선택",
      es: "Ejecutar Agent — selección de Claude Code o Codex",
      fr: "Lancer un agent — choix du lancement Claude Code ou Codex",
      de: "Agent ausführen — Startauswahl für Claude Code und Codex",
      pt: "Executar agente — seleção de início do Claude Code e do Codex",
      it: "Esegui agente — scelta dell'avvio di Claude Code e Codex",
    },
    "Run Agent — live streaming output": {
      zh: "运行 Agent — 实时流式输出",
      vi: "Chạy Agent — đầu ra trực tiếp dạng luồng",
      ko: "Agent 실행 — 실시간 스트리밍 출력",
      es: "Ejecutar Agent — salida en streaming en tiempo real",
      fr: "Lancer un agent — sortie diffusée en direct",
      de: "Agent ausführen — live gestreamte Ausgabe",
      pt: "Executar agente — saída transmitida ao vivo",
      it: "Esegui agente — output trasmesso in diretta",
    },
    "Settings Overview": {
      zh: "设置概览",
      vi: "Tổng quan cài đặt",
      ko: "설정 개요",
      es: "Resumen de configuración",
      fr: "Vue d'ensemble des paramètres",
      de: "Übersicht der Einstellungen",
      pt: "Visão geral das configurações",
      it: "Panoramica delle impostazioni",
    },
    "Settings — Alerts & Webhooks": {
      zh: "设置 — 告警与 Webhook",
      vi: "Cài đặt — Cảnh báo & Webhook",
      ko: "설정 — 알림 및 Webhook",
      es: "Configuración — Alertas y Webhooks",
      fr: "Paramètres — Alertes et webhooks",
      de: "Einstellungen — Warnungen und Webhooks",
      pt: "Configurações — Alertas e webhooks",
      it: "Impostazioni — Avvisi e webhook",
    },
    "Settings — Remote Data Sources": {
      zh: "设置 — 远程数据源",
      vi: "Cài đặt — Nguồn dữ liệu từ xa",
      ko: "설정 — 원격 데이터 소스",
      es: "Configuración — Fuentes de datos remotas",
      fr: "Paramètres — Sources de données distantes",
      de: "Einstellungen — Entfernte Datenquellen",
      pt: "Configurações — Fontes de dados remotas",
      it: "Impostazioni — Fonti dati remote",
    },
    "Swagger UI API docs": {
      zh: "Swagger UI API 文档",
      vi: "Tài liệu API Swagger UI",
      ko: "Swagger UI API 문서",
      es: "Documentación de API de Swagger UI",
      fr: "Documentation de l'API dans Swagger UI",
      de: "API-Dokumentation in Swagger UI",
      pt: "Documentação da API no Swagger UI",
      it: "Documentazione API in Swagger UI",
    },
    "ReDoc API reference": {
      zh: "ReDoc API 参考",
      vi: "Tham khảo API ReDoc",
      ko: "ReDoc API 참조",
      es: "Referencia de API de ReDoc",
      fr: "Référence de l'API dans ReDoc",
      de: "API-Referenz in ReDoc",
      pt: "Referência da API no ReDoc",
      it: "Riferimento API in ReDoc",
    },
    "Grafana CCAM — Overview dashboard": {
      zh: "Grafana CCAM — 概览仪表盘",
      vi: "Grafana CCAM — bảng điều khiển tổng quan",
      ko: "Grafana CCAM — 개요 대시보드",
      es: "Grafana CCAM — panel de resumen",
      fr: "Grafana CCAM — tableau de bord Overview",
      de: "Grafana CCAM — Dashboard Overview",
      pt: "Grafana CCAM — painel Overview",
      it: "Grafana CCAM — dashboard Overview",
    },
    "Prometheus CCAM console": {
      zh: "Prometheus CCAM 控制台",
      vi: "Bảng điều khiển Prometheus CCAM",
      ko: "Prometheus CCAM 콘솔",
      es: "Consola de Prometheus CCAM",
      fr: "Console Prometheus CCAM",
      de: "Prometheus-CCAM-Konsole",
      pt: "Console Prometheus do CCAM",
      it: "Console Prometheus di CCAM",
    },
    "Prometheus Graph with CCAM PromQL": {
      zh: "使用 CCAM PromQL 的 Prometheus Graph",
      vi: "Prometheus Graph với CCAM PromQL",
      ko: "CCAM PromQL을 사용하는 Prometheus Graph",
      es: "Prometheus Graph con CCAM PromQL",
      fr: "Graphique Prometheus avec PromQL CCAM",
      de: "Prometheus-Graph mit CCAM-PromQL",
      pt: "Gráfico do Prometheus com PromQL do CCAM",
      it: "Grafico Prometheus con PromQL di CCAM",
    },
    "Interactive Swagger UI rendering the dashboard's OpenAPI 3.0 spec, with collapsible endpoint groups, request/response schemas, and try-it-out controls":
      {
        zh: "交互式 Swagger UI 展示仪表盘的 OpenAPI 3.0 规范，包含可折叠端点组、请求/响应模式和试用控件",
        vi: "Swagger UI tương tác hiển thị đặc tả OpenAPI 3.0 của bảng điều khiển, với nhóm endpoint có thể thu gọn, schema yêu cầu/phản hồi và điều khiển thử nghiệm",
        ko: "접을 수 있는 엔드포인트 그룹, 요청/응답 스키마, 실행 컨트롤과 함께 대시보드 OpenAPI 3.0 명세를 보여 주는 대화형 Swagger UI",
        es: "Swagger UI interactivo con la especificación OpenAPI 3.0, grupos plegables, esquemas de solicitud y respuesta y controles de prueba",
        fr: "Swagger UI interactif affichant la spécification OpenAPI 3.0 du tableau de bord, avec groupes de points de terminaison repliables, schémas de requête/réponse et contrôles pour tester",
        de: "Interaktive Swagger UI mit der OpenAPI-3.0-Spezifikation des Dashboards, einklappbaren Endpunktgruppen, Anfrage-/Antwortschemas und Try-it-out-Steuerelementen",
        pt: "Swagger UI interativo exibindo a especificação OpenAPI 3.0 do painel, com grupos de endpoints recolhíveis, esquemas de requisição/resposta e controles para testar",
        it: "Swagger UI interattivo che mostra la specifica OpenAPI 3.0 della dashboard, con gruppi di endpoint comprimibili, schemi di richiesta/risposta e controlli per provare le chiamate",
      },
    "ReDoc rendering the dashboard's OpenAPI 3.0 spec as a read-optimized three-panel reference, served self-hosted and fully offline":
      {
        zh: "ReDoc 将仪表盘 OpenAPI 3.0 规范呈现为便于阅读的三栏参考，自托管且完全离线",
        vi: "ReDoc hiển thị đặc tả OpenAPI 3.0 dưới dạng tài liệu ba bảng tối ưu cho việc đọc, tự lưu trữ và hoàn toàn ngoại tuyến",
        ko: "대시보드 OpenAPI 3.0 명세를 읽기 좋은 3패널 참조로 제공하는 자체 호스팅 완전 오프라인 ReDoc",
        es: "ReDoc presenta la especificación OpenAPI 3.0 como referencia de tres paneles optimizada para lectura, autohospedada y sin conexión",
        fr: "ReDoc affichant la spécification OpenAPI 3.0 du tableau de bord sous forme de référence à trois panneaux optimisée pour la lecture, auto-hébergée et entièrement hors ligne",
        de: "ReDoc zeigt die OpenAPI-3.0-Spezifikation des Dashboards als leseoptimierte Dreispalten-Referenz, selbst gehostet und vollständig offline",
        pt: "ReDoc exibindo a especificação OpenAPI 3.0 do painel como uma referência em três painéis otimizada para leitura, hospedada localmente e totalmente offline",
        it: "ReDoc che mostra la specifica OpenAPI 3.0 della dashboard come riferimento a tre pannelli ottimizzato per la lettura, self-hosted e completamente offline",
      },
    "Settings page Import History section showing rescan default folder, scan custom path, and upload controls with progress output":
      {
        zh: "设置页面的导入历史区域，显示重新扫描默认文件夹、扫描自定义路径和带进度输出的上传控件",
        vi: "Mục Lịch sử nhập trên trang Cài đặt với quét lại thư mục mặc định, quét đường dẫn tùy chỉnh và điều khiển tải lên có tiến độ",
        ko: "기본 폴더 재검색, 사용자 지정 경로 검색, 진행 출력이 있는 업로드 컨트롤을 보여 주는 설정 페이지의 가져오기 기록 섹션",
        es: "Sección Historial de importaciones con reescaneo de carpeta, ruta personalizada y controles de carga con progreso",
        fr: "Section Importer l'historique de la page Paramètres avec les contrôles de réanalyse du dossier par défaut, d'analyse d'un chemin personnalisé et de téléversement, et la sortie de progression",
        de: "Abschnitt Verlauf importieren der Einstellungsseite mit Steuerelementen zum erneuten Durchsuchen des Standardordners, Durchsuchen eines eigenen Pfads und Hochladen samt Fortschrittsausgabe",
        pt: "Seção Importar histórico da página de configurações com controles para examinar novamente a pasta padrão, examinar um caminho personalizado e enviar arquivos, com saída de progresso",
        it: "Sezione Importa cronologia della pagina delle impostazioni con i controlli per rianalizzare la cartella predefinita, analizzare un percorso personalizzato e caricare file, con l'output di avanzamento",
      },
    "Settings page Remote Data Sources section showing configured SSH sources with live status, the data-scope selector, and per-source sync controls":
      {
        zh: "设置页面的远程数据源区域，显示已配置 SSH 源的实时状态、数据范围选择器和逐源同步控件",
        vi: "Mục Nguồn dữ liệu từ xa với nguồn SSH đã cấu hình, trạng thái trực tiếp, bộ chọn phạm vi và điều khiển đồng bộ từng nguồn",
        ko: "구성된 SSH 소스의 실시간 상태, 데이터 범위 선택기, 소스별 동기화 컨트롤을 보여 주는 설정 페이지의 원격 데이터 소스 섹션",
        es: "Sección Fuentes remotas con orígenes SSH configurados, estado en vivo, selector de ámbito y controles de sincronización",
        fr: "Section Sources de données distantes de la page Paramètres avec les sources SSH configurées et leur statut en direct, le sélecteur de périmètre des données et les contrôles de synchronisation par source",
        de: "Abschnitt Entfernte Datenquellen der Einstellungsseite mit konfigurierten SSH-Quellen und Live-Status, dem Datenbereich-Wähler und Synchronisierungssteuerung pro Quelle",
        pt: "Seção Fontes de dados remotas da página de configurações com as fontes SSH configuradas e status ao vivo, o seletor de escopo dos dados e controles de sincronização por fonte",
        it: "Sezione Fonti dati remote della pagina delle impostazioni con le fonti SSH configurate e lo stato in diretta, il selettore dell'ambito dei dati e i controlli di sincronizzazione per fonte",
      },
    "MCP Server interactive REPL showing the MCP Tools banner, server info, and tool listing with colored output":
      {
        zh: "MCP Server 交互式 REPL，显示 MCP Tools 横幅、服务器信息和带彩色输出的工具列表",
        vi: "REPL tương tác của MCP Server hiển thị biểu ngữ MCP Tools, thông tin server và danh sách công cụ có màu",
        ko: "MCP Tools 배너, 서버 정보, 컬러 출력을 포함한 도구 목록을 보여 주는 MCP Server 대화형 REPL",
        es: "REPL interactivo del MCP Server con el banner MCP Tools, información del servidor y lista de herramientas en color",
        fr: "REPL interactif du serveur MCP affichant la bannière MCP Tools, les informations du serveur et la liste des outils en couleur",
        de: "Interaktive REPL des MCP-Servers mit dem MCP-Tools-Banner, Serverinfos und farbiger Tool-Liste",
        pt: "REPL interativo do servidor MCP exibindo o banner MCP Tools, as informações do servidor e a lista de ferramentas com saída colorida",
        it: "REPL interattivo del server MCP che mostra il banner MCP Tools, le informazioni del server e l'elenco degli strumenti con output a colori",
      },
    "CLI statusline showing model, user, git branch, context window bar, and token counts": {
      zh: "CLI 状态栏，显示模型、用户、Git 分支、上下文窗口条和 Token 计数",
      vi: "Statusline CLI hiển thị mô hình, người dùng, nhánh Git, thanh cửa sổ ngữ cảnh và số Token",
      ko: "모델, 사용자, Git 브랜치, 컨텍스트 창 막대, Token 수를 보여 주는 CLI 상태 표시줄",
      es: "Línea de estado de la CLI con modelo, usuario, rama Git, ventana de contexto y recuentos de Token",
      fr: "Barre d'état de la CLI affichant le modèle, l'utilisateur, la branche git, la jauge de la fenêtre de contexte et le nombre de tokens",
      de: "CLI-Statuszeile mit Modell, Benutzer, Git-Branch, Kontextfenster-Balken und Token-Zahlen",
      pt: "Linha de status da CLI exibindo modelo, usuário, branch do git, barra da janela de contexto e contagem de tokens",
      it: "Riga di stato della CLI che mostra modello, utente, branch git, barra della finestra di contesto e conteggio dei token",
    },
    "VS Code Extension sidebar showing live health, analytics, and navigation": {
      zh: "VS Code 扩展侧边栏，显示实时健康状态、分析和导航",
      vi: "Thanh bên tiện ích VS Code hiển thị sức khỏe trực tiếp, phân tích và điều hướng",
      ko: "실시간 상태, 분석, 탐색을 보여 주는 VS Code 확장 사이드바",
      es: "Barra lateral de la extensión de VS Code con estado, análisis y navegación en tiempo real",
      fr: "Barre latérale de l'extension VS Code affichant la santé en direct, l'analytique et la navigation",
      de: "Seitenleiste der VS-Code-Erweiterung mit Live-Zustand, Analysen und Navigation",
      pt: "Barra lateral da extensão do VS Code exibindo saúde ao vivo, análises e navegação",
      it: "Barra laterale dell'estensione VS Code con stato in diretta, analisi e navigazione",
    },
    "Claude Code Monitor running as a native desktop app": {
      zh: "作为原生桌面应用运行的 Claude Code Monitor",
      vi: "Claude Code Monitor chạy dưới dạng ứng dụng desktop gốc",
      ko: "네이티브 데스크톱 앱으로 실행되는 Claude Code Monitor",
      es: "Claude Code Monitor ejecutándose como aplicación de escritorio nativa",
      fr: "Claude Code Monitor fonctionnant comme application de bureau native",
      de: "Claude Code Monitor als native Desktop-App",
      pt: "Claude Code Monitor rodando como app de desktop nativo",
      it: "Claude Code Monitor in esecuzione come app desktop nativa",
    },
    "Claude Code Monitor running as a native desktop app on Windows, showing the Activity Feed, native Windows window menu, and Tabby companion":
      {
        zh: "在 Windows 上作为原生桌面应用运行的 Claude Code Monitor，显示活动流、原生窗口菜单和 Tabby 伴侣",
        vi: "Claude Code Monitor chạy như ứng dụng Windows gốc, hiển thị luồng hoạt động, menu cửa sổ và bạn đồng hành Tabby",
        ko: "Windows 네이티브 데스크톱 앱으로 실행되며 활동 피드, Windows 창 메뉴, Tabby 동반자를 보여 주는 Claude Code Monitor",
        es: "Claude Code Monitor como aplicación nativa de Windows, con actividad, menú de ventana y compañero Tabby",
        fr: "Claude Code Monitor fonctionnant comme application de bureau native sous Windows, avec le flux d'activité, le menu de fenêtre natif de Windows et le compagnon Tabby",
        de: "Claude Code Monitor als native Desktop-App unter Windows mit Aktivitäts-Feed, nativem Windows-Fenstermenü und Tabby-Begleiterin",
        pt: "Claude Code Monitor rodando como app de desktop nativo no Windows, exibindo o feed de atividade, o menu de janela nativo do Windows e o companheiro Tabby",
        it: "Claude Code Monitor in esecuzione come app desktop nativa su Windows, con il feed attività, il menu della finestra nativo di Windows e il compagno Tabby",
      },
    "Windows NSIS installer step 1 — Choose Installation Options": {
      zh: "Windows NSIS 安装程序第 1 步 — 选择安装选项",
      vi: "Trình cài đặt Windows NSIS bước 1 — Chọn tùy chọn cài đặt",
      ko: "Windows NSIS 설치 프로그램 1단계 — 설치 옵션 선택",
      es: "Instalador NSIS de Windows, paso 1 — Elegir opciones de instalación",
      fr: "Installateur NSIS Windows, étape 1 — choix des options d'installation",
      de: "Windows-NSIS-Installer, Schritt 1 — Installationsoptionen wählen",
      pt: "Instalador NSIS do Windows, etapa 1 — escolher as opções de instalação",
      it: "Programma di installazione NSIS di Windows, passaggio 1 — scelta delle opzioni di installazione",
    },
    "Windows NSIS installer step 2 — Choose Install Location": {
      zh: "Windows NSIS 安装程序第 2 步 — 选择安装位置",
      vi: "Trình cài đặt Windows NSIS bước 2 — Chọn vị trí cài đặt",
      ko: "Windows NSIS 설치 프로그램 2단계 — 설치 위치 선택",
      es: "Instalador NSIS de Windows, paso 2 — Elegir ubicación de instalación",
      fr: "Installateur NSIS Windows, étape 2 — choix de l'emplacement d'installation",
      de: "Windows-NSIS-Installer, Schritt 2 — Installationsort wählen",
      pt: "Instalador NSIS do Windows, etapa 2 — escolher o local de instalação",
      it: "Programma di installazione NSIS di Windows, passaggio 2 — scelta della posizione di installazione",
    },
    "Windows NSIS installer step 3 — Completing Setup": {
      zh: "Windows NSIS 安装程序第 3 步 — 完成设置",
      vi: "Trình cài đặt Windows NSIS bước 3 — Hoàn tất thiết lập",
      ko: "Windows NSIS 설치 프로그램 3단계 — 설정 완료",
      es: "Instalador NSIS de Windows, paso 3 — Completar la instalación",
      fr: "Installateur NSIS Windows, étape 3 — fin de l'installation",
      de: "Windows-NSIS-Installer, Schritt 3 — Einrichtung abschließen",
      pt: "Instalador NSIS do Windows, etapa 3 — concluindo a instalação",
      it: "Programma di installazione NSIS di Windows, passaggio 3 — completamento dell'installazione",
    },
    "Settings page with model pricing editor, hook status, data management, and system info": {
      zh: "设置页面，包含模型定价编辑器、Hook 状态、数据管理和系统信息",
      vi: "Trang Cài đặt với trình sửa giá mô hình, trạng thái hook, quản lý dữ liệu và thông tin hệ thống",
      ko: "모델 가격 편집기, Hook 상태, 데이터 관리, 시스템 정보를 포함한 설정 페이지",
      es: "Página Configuración con editor de precios, estado de Hooks, gestión de datos e información del sistema",
      fr: "Page Paramètres avec l'éditeur de tarification des modèles, le statut des hooks, la gestion des données et les informations système",
      de: "Einstellungsseite mit Modellpreis-Editor, Hook-Status, Datenverwaltung und Systeminfos",
      pt: "Página de configurações com o editor de preços dos modelos, status dos hooks, gerenciamento de dados e informações do sistema",
      it: "Pagina delle impostazioni con l'editor dei prezzi dei modelli, lo stato degli hook, la gestione dei dati e le informazioni di sistema",
    },
    "Claude Config Explorer — 12-tab inspector with overview counts, scope filter, and tab bar": {
      zh: "Claude 配置浏览器 — 带概览计数、范围筛选和标签栏的 12 标签检查器",
      vi: "Trình khám phá cấu hình Claude — bộ kiểm tra 12 tab với số liệu tổng quan, bộ lọc phạm vi và thanh tab",
      ko: "Claude 구성 탐색기 — 개요 수, 범위 필터, 탭 표시줄을 갖춘 12탭 검사기",
      es: "Explorador de configuración de Claude — inspector de 12 pestañas con recuentos, filtro de ámbito y barra de pestañas",
      fr: "Explorateur de configuration Claude — inspecteur à 12 onglets avec compteurs de synthèse, filtre de portée et barre d'onglets",
      de: "Claude-Konfigurations-Explorer — Inspektor mit 12 Tabs, Übersichtszählern, Bereichsfilter und Tab-Leiste",
      pt: "Explorador de configuração do Claude — inspetor com 12 abas, contadores da visão geral, filtro de escopo e barra de abas",
      it: "Esplora configurazione di Claude — ispettore a 12 schede con conteggi di riepilogo, filtro dell'ambito e barra delle schede",
    },
    "Claude Config Explorer — Skills tab with searchable skill list and edit actions": {
      zh: "Claude 配置浏览器 — 带可搜索技能列表和编辑操作的技能标签页",
      vi: "Trình khám phá cấu hình Claude — tab Skill với danh sách có thể tìm kiếm và thao tác chỉnh sửa",
      ko: "Claude 구성 탐색기 — 검색 가능한 스킬 목록과 편집 작업이 있는 스킬 탭",
      es: "Explorador de configuración de Claude — pestaña Habilidades con lista buscable y acciones de edición",
      fr: "Explorateur de configuration Claude — onglet Skills avec liste de skills consultable et actions de modification",
      de: "Claude-Konfigurations-Explorer — Tab Skills mit durchsuchbarer Skill-Liste und Bearbeitungsaktionen",
      pt: "Explorador de configuração do Claude — aba Skills com lista de skills pesquisável e ações de edição",
      it: "Esplora configurazione di Claude — scheda Skill con elenco di skill ricercabile e azioni di modifica",
    },
    "Settings — Alerts & Webhooks: rule list, fired-alert feed, and webhook channels": {
      zh: "设置 — 告警与 Webhook：规则列表、已触发告警流和 Webhook 渠道",
      vi: "Cài đặt — Cảnh báo & Webhook: danh sách quy tắc, luồng cảnh báo đã kích hoạt và kênh Webhook",
      ko: "설정 — 알림 및 Webhook: 규칙 목록, 발생한 알림 피드, Webhook 채널",
      es: "Configuración — Alertas y Webhooks: reglas, alertas activadas y canales Webhook",
      fr: "Paramètres — Alertes et webhooks : liste des règles, flux des alertes déclenchées et canaux webhook",
      de: "Einstellungen — Warnungen und Webhooks: Regelliste, Feed ausgelöster Warnungen und Webhook-Kanäle",
      pt: "Configurações — Alertas e webhooks: lista de regras, feed de alertas disparados e canais de webhook",
      it: "Impostazioni — Avvisi e webhook: elenco delle regole, feed degli avvisi attivati e canali webhook",
    },
    "Update modal showing commits-behind count and copy-to-clipboard command": {
      zh: "更新弹窗，显示落后提交数和复制到剪贴板命令",
      vi: "Hộp thoại cập nhật hiển thị số commit còn thiếu và lệnh sao chép",
      ko: "뒤처진 커밋 수와 클립보드 복사 명령을 보여 주는 업데이트 모달",
      es: "Modal de actualización con número de commits pendientes y comando para copiar",
      fr: "Fenêtre de mise à jour indiquant le nombre de commits de retard et la commande à copier",
      de: "Update-Dialog mit Anzahl der fehlenden Commits und Befehl zum Kopieren",
      pt: "Janela de atualização mostrando quantos commits faltam e o comando para copiar",
      it: "Finestra di aggiornamento con il numero di commit mancanti e il comando da copiare",
    },
    "Connection details modal with throughput sparkline, top event types, and recent activity": {
      zh: "连接详情弹窗，包含吞吐量迷你图、主要事件类型和最近活动",
      vi: "Hộp thoại chi tiết kết nối với biểu đồ nhỏ thông lượng, loại sự kiện hàng đầu và hoạt động gần đây",
      ko: "처리량 스파크라인, 주요 이벤트 유형, 최근 활동이 있는 연결 상세 모달",
      es: "Modal de conexión con minigráfico de rendimiento, principales eventos y actividad reciente",
      fr: "Fenêtre des détails de connexion avec mini-courbe de débit, principaux types d'événements et activité récente",
      de: "Dialog mit Verbindungsdetails, Durchsatz-Sparkline, häufigsten Ereignistypen und letzter Aktivität",
      pt: "Janela de detalhes da conexão com minigráfico de vazão, principais tipos de evento e atividade recente",
      it: "Finestra dei dettagli di connessione con sparkline del throughput, tipi di evento principali e attività recente",
    },
    "Grafana CCAM — Overview dashboard with live fleet metrics": {
      zh: "Grafana CCAM — 带实时集群指标的概览仪表盘",
      vi: "Grafana CCAM — bảng điều khiển tổng quan với số liệu fleet trực tiếp",
      ko: "Grafana CCAM — 실시간 플릿 메트릭이 있는 개요 대시보드",
      es: "Grafana CCAM — panel de resumen con métricas de flota en tiempo real",
      fr: "Grafana CCAM — tableau de bord Overview avec les métriques de la flotte en direct",
      de: "Grafana CCAM — Dashboard Overview mit Live-Flottenmetriken",
      pt: "Grafana CCAM — painel Overview com métricas da frota ao vivo",
      it: "Grafana CCAM — dashboard Overview con le metriche della flotta in diretta",
    },
    "Prometheus CCAM console landing page": {
      zh: "Prometheus CCAM 控制台首页",
      vi: "Trang đầu bảng điều khiển Prometheus CCAM",
      ko: "Prometheus CCAM 콘솔 시작 페이지",
      es: "Página de inicio de la consola Prometheus CCAM",
      fr: "Page d'accueil de la console Prometheus CCAM",
      de: "Startseite der Prometheus-CCAM-Konsole",
      pt: "Página inicial do console Prometheus do CCAM",
      it: "Pagina iniziale della console Prometheus di CCAM",
    },
    "Prometheus Graph UI running CCAM PromQL": {
      zh: "运行 CCAM PromQL 的 Prometheus Graph UI",
      vi: "Giao diện Prometheus Graph chạy CCAM PromQL",
      ko: "CCAM PromQL을 실행하는 Prometheus Graph UI",
      es: "Interfaz Prometheus Graph ejecutando CCAM PromQL",
      fr: "Interface Graph de Prometheus exécutant du PromQL CCAM",
      de: "Prometheus-Graph-Oberfläche mit CCAM-PromQL",
      pt: "Interface Graph do Prometheus executando PromQL do CCAM",
      it: "Interfaccia Graph di Prometheus che esegue PromQL di CCAM",
    },
    "Tabby Companion": {
      zh: "Tabby 伴侣",
      vi: "Bạn đồng hành Tabby",
      ko: "Tabby 동반자",
      es: "Compañero Tabby",
      fr: "Compagnon Tabby",
      de: "Tabby-Begleiterin",
      pt: "Companheiro Tabby",
      it: "Compagno Tabby",
    },
  };
  const ATTR = Object.fromEntries(
    ["zh", "vi", "ko", "es", "fr", "de", "pt", "it"].map((language) => [
      language,
      Object.fromEntries(
        Object.entries(ATTRIBUTE_TRANSLATIONS).map(([english, translations]) => [
          english,
          translations[language],
        ])
      ),
    ])
  );
  const META = {
    en: {
      title: "Claude Code Agent Monitor Wiki — Setup, API, Hooks & MCP",
      description:
        "Complete technical wiki for Claude Code Agent Monitor: install, hooks, REST API, SQLite schema, MCP tools, plugins, deployment, Cursor and Codex support.",
      socialTitle: "Claude Code Agent Monitor Wiki — Setup, API, Hooks & MCP",
      socialDescription:
        "Complete technical wiki for Claude Code Agent Monitor: install, hooks, REST API, SQLite schema, MCP tools, plugins, deployment, Cursor and Codex support.",
      twitterDescription:
        "Install, hooks, REST API, SQLite schema, MCP tools, plugins, and deployment for the local-first Claude Code, Cursor, and Codex dashboard.",
      socialImageAlt:
        "Claude Code Agent Monitor — real-time local dashboard for Claude Code, Cursor, and Codex",
    },
    zh: {
      title: "Claude Code Agent Monitor 维基 — 安装、API、Hook 与 MCP",
      description:
        "Claude Code Agent Monitor 完整技术维基：安装、Hook、REST API、SQLite 架构、MCP 工具、插件、部署，以及 Cursor 和 Codex 支持。",
      socialTitle: "Claude Code Agent Monitor 维基 — 安装、API、Hook 与 MCP",
      socialDescription:
        "Claude Code Agent Monitor 完整技术维基：安装、Hook、REST API、SQLite 架构、MCP 工具、插件、部署，以及 Cursor 和 Codex 支持。",
      twitterDescription:
        "本地优先的 Claude Code、Cursor 与 Codex 仪表盘的安装、Hook、REST API、SQLite 架构、MCP 工具、插件与部署指南。",
      socialImageAlt:
        "Claude Code Agent Monitor — 面向 Claude Code、Cursor 和 Codex 的本地实时仪表盘",
    },
    vi: {
      title: "Wiki Claude Code Agent Monitor — Cài đặt, API, Hook & MCP",
      description:
        "Wiki kỹ thuật đầy đủ cho Claude Code Agent Monitor: cài đặt, hook, REST API, lược đồ SQLite, công cụ MCP, plugin, triển khai, hỗ trợ Cursor và Codex.",
      socialTitle: "Wiki Claude Code Agent Monitor — Cài đặt, API, Hook & MCP",
      socialDescription:
        "Wiki kỹ thuật đầy đủ cho Claude Code Agent Monitor: cài đặt, hook, REST API, lược đồ SQLite, công cụ MCP, plugin, triển khai, hỗ trợ Cursor và Codex.",
      twitterDescription:
        "Cài đặt, hook, REST API, lược đồ SQLite, công cụ MCP, plugin và triển khai cho bảng điều khiển cục bộ dành cho Claude Code, Cursor và Codex.",
      socialImageAlt:
        "Claude Code Agent Monitor — bảng điều khiển cục bộ theo thời gian thực cho Claude Code, Cursor và Codex",
    },
    ko: {
      title: "Claude Code Agent Monitor 위키 — 설치, API, 훅, MCP",
      description:
        "Claude Code Agent Monitor 전체 기술 위키: 설치, 훅, REST API, SQLite 스키마, MCP 도구, 플러그인, 배포, Cursor 및 Codex 지원.",
      socialTitle: "Claude Code Agent Monitor 위키 — 설치, API, 훅, MCP",
      socialDescription:
        "Claude Code Agent Monitor 전체 기술 위키: 설치, 훅, REST API, SQLite 스키마, MCP 도구, 플러그인, 배포, Cursor 및 Codex 지원.",
      twitterDescription:
        "로컬 우선 Claude Code, Cursor, Codex 대시보드의 설치, 훅, REST API, SQLite 스키마, MCP 도구, 플러그인, 배포 안내.",
      socialImageAlt:
        "Claude Code Agent Monitor — Claude Code, Cursor, Codex를 위한 실시간 로컬 대시보드",
    },
    es: {
      title: "Wiki de Claude Code Agent Monitor — Instalación, API, Hooks y MCP",
      description:
        "Wiki técnica completa de Claude Code Agent Monitor: instalación, hooks, API REST, esquema SQLite, herramientas MCP, plugins, despliegue y soporte de Cursor y Codex.",
      socialTitle: "Wiki de Claude Code Agent Monitor — Instalación, API, Hooks y MCP",
      socialDescription:
        "Wiki técnica completa de Claude Code Agent Monitor: instalación, hooks, API REST, esquema SQLite, herramientas MCP, plugins, despliegue y soporte de Cursor y Codex.",
      twitterDescription:
        "Instalación, hooks, API REST, esquema SQLite, herramientas MCP, plugins y despliegue del panel local para Claude Code, Cursor y Codex.",
      socialImageAlt:
        "Claude Code Agent Monitor — panel local en tiempo real para Claude Code, Cursor y Codex",
    },
    fr: {
      title: "Wiki de Claude Code Agent Monitor — Installation, API, hooks et MCP",
      description:
        "Wiki technique complet de Claude Code Agent Monitor : installation, hooks, API REST, schéma SQLite, outils MCP, plugins, déploiement et prise en charge de Cursor et Codex.",
      socialTitle: "Wiki de Claude Code Agent Monitor — Installation, API, hooks et MCP",
      socialDescription:
        "Wiki technique complet de Claude Code Agent Monitor : installation, hooks, API REST, schéma SQLite, outils MCP, plugins, déploiement et prise en charge de Cursor et Codex.",
      twitterDescription:
        "Installation, hooks, API REST, schéma SQLite, outils MCP, plugins et déploiement du tableau de bord local pour Claude Code, Cursor et Codex.",
      socialImageAlt:
        "Claude Code Agent Monitor — tableau de bord local en temps réel pour Claude Code, Cursor et Codex",
    },
    de: {
      title: "Claude Code Agent Monitor Wiki — Installation, API, Hooks und MCP",
      description:
        "Vollständiges technisches Wiki zu Claude Code Agent Monitor: Installation, Hooks, REST-API, SQLite-Schema, MCP-Tools, Plugins, Deployment sowie Unterstützung für Cursor und Codex.",
      socialTitle: "Claude Code Agent Monitor Wiki — Installation, API, Hooks und MCP",
      socialDescription:
        "Vollständiges technisches Wiki zu Claude Code Agent Monitor: Installation, Hooks, REST-API, SQLite-Schema, MCP-Tools, Plugins, Deployment sowie Unterstützung für Cursor und Codex.",
      twitterDescription:
        "Installation, Hooks, REST-API, SQLite-Schema, MCP-Tools, Plugins und Deployment des lokalen Dashboards für Claude Code, Cursor und Codex.",
      socialImageAlt:
        "Claude Code Agent Monitor — lokales Echtzeit-Dashboard für Claude Code, Cursor und Codex",
    },
    pt: {
      title: "Wiki do Claude Code Agent Monitor — Instalação, API, hooks e MCP",
      description:
        "Wiki técnico completo do Claude Code Agent Monitor: instalação, hooks, API REST, esquema SQLite, ferramentas MCP, plugins, implantação e suporte ao Cursor e ao Codex.",
      socialTitle: "Wiki do Claude Code Agent Monitor — Instalação, API, hooks e MCP",
      socialDescription:
        "Wiki técnico completo do Claude Code Agent Monitor: instalação, hooks, API REST, esquema SQLite, ferramentas MCP, plugins, implantação e suporte ao Cursor e ao Codex.",
      twitterDescription:
        "Instalação, hooks, API REST, esquema SQLite, ferramentas MCP, plugins e implantação do painel local para Claude Code, Cursor e Codex.",
      socialImageAlt:
        "Claude Code Agent Monitor — painel local em tempo real para Claude Code, Cursor e Codex",
    },
    it: {
      title: "Wiki di Claude Code Agent Monitor — Installazione, API, hook e MCP",
      description:
        "Wiki tecnico completo di Claude Code Agent Monitor: installazione, hook, API REST, schema SQLite, strumenti MCP, plugin, deploy e supporto per Cursor e Codex.",
      socialTitle: "Wiki di Claude Code Agent Monitor — Installazione, API, hook e MCP",
      socialDescription:
        "Wiki tecnico completo di Claude Code Agent Monitor: installazione, hook, API REST, schema SQLite, strumenti MCP, plugin, deploy e supporto per Cursor e Codex.",
      twitterDescription:
        "Installazione, hook, API REST, schema SQLite, strumenti MCP, plugin e deploy della dashboard locale per Claude Code, Cursor e Codex.",
      socialImageAlt:
        "Claude Code Agent Monitor — dashboard locale in tempo reale per Claude Code, Cursor e Codex",
    },
  };
  const trH = (lang, en) => (lang === "en" ? en : (H[lang] && H[lang][norm(en)]) || en);
  // Heading / section-label translations from the content bundle fill any gaps
  // in T. Existing T entries always win, so this never regresses the scannable
  // layer — it only adds headings T didn't already cover.
  if (CONTENT.plain) {
    ["zh", "vi", "ko", "es", "fr", "de", "pt", "it"].forEach((lng) => {
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
  const attrNames = ["alt", "aria-label", "placeholder", "title"];
  const attrEls = Array.from(
    document.querySelectorAll("[alt], [aria-label], [placeholder], [title]")
  );
  const enAttrs = new Map();
  attrEls.forEach((el) => {
    const attrs = {};
    attrNames.forEach((name) => {
      if (el.hasAttribute(name)) attrs[name] = el.getAttribute(name);
    });
    enAttrs.set(el, attrs);
  });
  const languageLabels = {
    en: "English",
    zh: "中文",
    vi: "Tiếng Việt",
    ko: "한국어",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    pt: "Português",
    it: "Italiano",
  };
  const languageSwitches = Array.from(document.querySelectorAll(".lang-switch"));
  const languageTriggers = Array.from(document.querySelectorAll(".lang-select-trigger"));

  function setLanguageMenu(languageSwitch, open) {
    const languageTrigger = languageSwitch?.querySelector(".lang-select-trigger");
    const languageMenu = languageSwitch?.querySelector(".lang-select-menu");
    if (!languageTrigger || !languageMenu) return;
    languageTrigger.setAttribute("aria-expanded", String(open));
    languageMenu.hidden = !open;
  }

  function closeLanguageMenus() {
    languageSwitches.forEach((languageSwitch) => setLanguageMenu(languageSwitch, false));
  }

  function updateLanguageControl(activeLanguage) {
    document.querySelectorAll(".lang-select-current").forEach((languageCurrent) => {
      languageCurrent.textContent = languageLabels[activeLanguage] || languageLabels.en;
    });
    document.querySelectorAll(".lang-option").forEach((option) => {
      const active = option.dataset.lang === activeLanguage;
      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
    });
  }

  function updateMetadata(activeLanguage) {
    const meta = META[activeLanguage] || META.en;
    document.title = meta.title;
    const setContent = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute("content", value);
    };
    setContent('meta[name="description"]', meta.description);
    setContent('meta[property="og:title"]', meta.socialTitle);
    setContent('meta[property="og:description"]', meta.socialDescription);
    setContent('meta[property="og:image:alt"]', meta.socialImageAlt);
    setContent('meta[name="twitter:title"]', meta.socialTitle);
    setContent('meta[name="twitter:description"]', meta.twitterDescription);
    setContent('meta[name="twitter:image:alt"]', meta.socialImageAlt);
  }

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
    enAttrs.forEach((attrs, el) => {
      Object.entries(attrs).forEach(([name, en]) => {
        el.setAttribute(name, (ATTR[lang] && ATTR[lang][en]) || en);
      });
    });
    const search = document.getElementById("sidebar-search");
    if (search) search.placeholder = tr(lang, "Search docs...");
    document.documentElement.lang =
      lang === "zh"
        ? "zh-CN"
        : lang === "vi"
          ? "vi"
          : lang === "ko"
            ? "ko"
            : lang === "es"
              ? "es"
              : lang === "fr"
                ? "fr"
                : lang === "de"
                  ? "de"
                  : lang === "pt"
                    ? "pt-BR"
                    : lang === "it"
                      ? "it"
                      : "en";
    updateLanguageControl(lang);
    updateMetadata(lang);
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
            : n.indexOf("es") === 0
              ? "es"
              : n.indexOf("fr") === 0
                ? "fr"
                : n.indexOf("de") === 0
                  ? "de"
                  : n.indexOf("pt") === 0
                    ? "pt"
                    : n.indexOf("it") === 0
                      ? "it"
                      : "en";
  }

  if (!Object.hasOwn(languageLabels, lang)) lang = "en";

  document.querySelectorAll(".lang-option").forEach((option) => {
    option.addEventListener("click", () => {
      lang = option.dataset.lang;
      localStorage.setItem("wiki-lang", lang);
      apply(lang);
      closeLanguageMenus();
    });
  });

  languageTriggers.forEach((languageTrigger) => {
    languageTrigger.addEventListener("click", () => {
      const languageSwitch = languageTrigger.closest(".lang-switch");
      const isOpen = languageTrigger.getAttribute("aria-expanded") === "true";
      closeLanguageMenus();
      setLanguageMenu(languageSwitch, !isOpen);
    });
    languageTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLanguageMenus();
    });
  });
  document.addEventListener("mousedown", (event) => {
    if (!languageSwitches.some((languageSwitch) => languageSwitch.contains(event.target))) {
      closeLanguageMenus();
    }
  });

  apply(lang);
})();
