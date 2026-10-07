/* Resomix design-reference prototype — NOT PRODUCTION.
   No libraries, no network, no scroll hijacking. Progressive enhancement only:
   the page is complete without this file. */

(function () {
  "use strict";

  var body = document.body;
  body.classList.add("js");

  /* ---------- review controls: motion + theme ---------- */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var params = new URLSearchParams(location.search);
  var motionOn = !(params.get("motion") === "off" || reduced);

  var motionBtn = document.getElementById("toggle-motion");
  var themeBtn = document.getElementById("toggle-theme");

  function applyMotion() {
    body.classList.toggle("motion-off", !motionOn);
    if (motionBtn) {
      motionBtn.textContent = "motion: " + (motionOn ? "on" : "off");
      motionBtn.setAttribute("aria-pressed", String(motionOn));
    }
    if (!motionOn) {
      // resolve every deferred state instantly
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      document.querySelectorAll(".sonic-core").forEach(function (el) { el.classList.add("in-view"); });
      litWords(words.length);
      drawConstellation(1);
    }
  }
  if (motionBtn) motionBtn.addEventListener("click", function () { motionOn = !motionOn; applyMotion(); });
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var light = document.documentElement.classList.toggle("light");
    themeBtn.textContent = "theme: " + (light ? "light" : "dark");
    themeBtn.setAttribute("aria-pressed", String(light));
    drawConstellation(lastProgress); // repaint with new tokens
  });

  /* ---------- reveals (IntersectionObserver) ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in", "in-view"); io.unobserve(e.target); }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll(".reveal, .sonic-core").forEach(function (el) { io.observe(el); });

  /* ---------- scene 2: scroll-scrubbed word emphasis ---------- */
  var par = document.getElementById("scrub-par");
  var words = [];
  if (par) {
    var keep = [];
    par.childNodes.forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (piece) {
          if (/^\s+$/.test(piece) || piece === "") { keep.push(document.createTextNode(piece)); }
          else {
            var s = document.createElement("span");
            s.className = "w"; s.textContent = piece; keep.push(s); words.push(s);
          }
        });
      } else { keep.push(node); }
    });
    par.textContent = "";
    keep.forEach(function (n) { par.appendChild(n); });
  }
  function litWords(n) {
    words.forEach(function (w, i) { w.classList.toggle("lit", i < n); });
  }
  function onScrollScrub() {
    if (!par || !motionOn) return;
    var r = par.parentElement.getBoundingClientRect();
    var vh = window.innerHeight;
    var progress = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height * 0.7)));
    litWords(Math.round(progress * words.length));
  }

  /* ---------- scene 3: catalogue constellation (canvas 2D) ---------- */
  var canvas = document.getElementById("constellation");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var lastProgress = 0;
  // deterministic pseudo-random node field
  var nodes = [];
  (function () {
    var seed = 42;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 46; i++) {
      nodes.push({ x: 40 + rnd() * 560, y: 40 + rnd() * 560, lit: rnd() });
    }
  })();
  var edges = [];
  nodes.forEach(function (a, i) {
    nodes.forEach(function (b, j) {
      if (j > i) {
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) edges.push([i, j, d]);
      }
    });
  });
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
           getComputedStyle(document.body).getPropertyValue(name).trim();
  }
  function drawConstellation(progress) {
    if (!ctx) return;
    lastProgress = progress;
    var fgDim = cssVar("--fg-dim") || "#b9b9b9";
    var accent = cssVar("--accent") || "#EE4A26";
    ctx.clearRect(0, 0, 640, 640);
    // edges appear with progress
    edges.forEach(function (e, idx) {
      var visible = idx / edges.length < progress;
      if (!visible) return;
      var a = nodes[e[0]], b = nodes[e[1]];
      ctx.strokeStyle = fgDim; ctx.globalAlpha = 0.28; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    // nodes: dormant → lit
    nodes.forEach(function (n, i) {
      var lit = (i / nodes.length) < progress;
      var isAccent = lit && n.lit > 0.86; // sparse orange highlights
      ctx.globalAlpha = lit ? 0.95 : 0.30;
      ctx.fillStyle = isAccent ? accent : fgDim;
      ctx.beginPath(); ctx.arc(n.x, n.y, isAccent ? 3.2 : 2, 0, Math.PI * 2); ctx.fill();
      if (isAccent) {
        ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(n.x, n.y, 9, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }
  function onScrollConstellation() {
    if (!canvas || !motionOn) return;
    var r = canvas.getBoundingClientRect();
    var vh = window.innerHeight;
    var progress = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (r.height + vh * 0.4)));
    drawConstellation(progress);
  }

  /* ---------- scroll wiring (passive; rAF-throttled) ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      onScrollScrub();
      onScrollConstellation();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  /* ---------- init ---------- */
  applyMotion();
  drawConstellation(motionOn ? 0.15 : 1);
  onScroll();
})();
