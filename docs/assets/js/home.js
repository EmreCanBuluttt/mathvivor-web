/* Mathvivor — home page behaviour (body.page-index).
   Hero spotlight, marquee pause buttons, 5-symbol compass tablist, equation snap-in,
   games rail controls, "kim ..." board highlight. Every block bails out quietly
   when its markup is missing. No globals. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* run cb once when el scrolls into view (immediately without IntersectionObserver) */
  function onView(el, cb, opts) {
    if (!hasIO) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, opts || { threshold: 0.35 });
    io.observe(el);
  }

  /* ---------- hero: soft spotlight that follows the pointer ---------- */
  var hero = $(".hm-hero"), spot = $(".hm-spot");
  if (hero && spot && !reduce && window.matchMedia("(pointer: fine)").matches) {
    var raf = 0, px = 0, py = 0;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; spot.style.transform = "translate3d(" + px + "px," + py + "px,0)"; });
    }, { passive: true });
  }

  /* ---------- marquee pause buttons (ticker + LED board) ---------- */
  if (!reduce) {
    $$("[data-hm-pause]").forEach(function (btn) {
      var box = btn.closest("[data-hm-marquee]");
      if (!box) return;
      var label = btn.querySelector(".sr-only");
      var stopText = label ? label.textContent : "";
      var playText = stopText.replace("durdur", "oynat");
      btn.hidden = false;
      btn.addEventListener("click", function () {
        var paused = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", String(paused));
        box.classList.toggle("is-paused", paused);
        if (label) label.textContent = paused ? playText : stopText;
      });
    });
  }

  /* ---------- 5 symbols: compass tablist ---------- */
  var sym = $("[data-hm-symbols]");
  var tabs = sym ? $$(".hm-sym__tab", sym) : [];
  var panels = sym ? $$(".hm-sym__panel", sym) : [];
  var compass = sym && $(".hm-compass", sym);
  var tablist = sym && $(".hm-sym__tabs", sym);
  if (sym && compass && tablist && tabs.length && tabs.length === panels.length) {
    var marks = $$(".hm-dial-marks circle", sym);
    var current = 0, angle = 0;
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Mathvivor sembolleri");
    tabs.forEach(function (t, i) {
      var p = panels[i];
      t.setAttribute("role", "tab");
      t.setAttribute("aria-controls", p.id);
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", t.id);
      p.tabIndex = 0;
      t.addEventListener("click", function () { select(i, false); });
      t.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") select(i, false); });
      t.addEventListener("keydown", function (e) {
        var n = tabs.length, next = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = n - 1;
        if (next < 0) return;
        e.preventDefault();
        select(next, true);
      });
    });

    var setNeedle = function (deg) { compass.style.setProperty("--needle", deg + "deg"); };
    var select = function (i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle("is-active", on);
        panels[k].classList.toggle("is-active", on);
        if (marks[k]) marks[k].classList.toggle("is-on", on);
      });
      if (focus) tabs[i].focus();
      if (i === current && sym.classList.contains("is-ready")) return;
      current = i;
      var target = +tabs[i].getAttribute("data-angle") || 0;
      var delta = ((target - angle) % 360 + 540) % 360 - 180; /* shortest swing */
      angle += delta;
      compass.classList.remove("is-intro");
      setNeedle(angle);
    };

    select(0, false);
    sym.classList.add("is-ready");

    /* playful intro: the needle spins in once when the compass first shows up */
    if (!reduce && hasIO) {
      compass.style.transition = "none";
      var needle = $(".hm-compass__needle", compass);
      if (needle) needle.style.transition = "none";
      setNeedle(-540);
      void compass.offsetWidth;
      if (needle) needle.style.transition = "";
      compass.style.transition = "";
      onView(compass, function () {
        if (angle !== 0 || current !== 0) { setNeedle(angle); return; }
        compass.classList.add("is-intro");
        setNeedle(0);
      }, { threshold: 0.45 });
    }
  }

  /* ---------- equation tiles snap in ---------- */
  var eq = $("[data-hm-eq]");
  if (eq && !reduce && hasIO) {
    eq.classList.add("is-armed");
    onView(eq, function () {
      eq.classList.add("is-in");
      var res = $(".hm-eq__tile--result", eq);
      setTimeout(function () {
        if (!res || !window.MV || typeof window.MV.confetti !== "function") return;
        var r = res.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        window.MV.confetti(r.left + r.width / 2, r.top + r.height / 2, 34);
      }, 1050);
    }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });
  }

  /* ---------- games rail: prev/next, progress, scroll hint ---------- */
  var railBox = $("[data-hm-rail]");
  var rail = railBox && $(".hm-rail", railBox);
  if (rail) {
    var btns = $$(".hm-rail__btn", railBox);
    var bar = $(".hm-rail__bar span", railBox);
    var step = function () {
      var card = $(".hm-card", rail);
      var gap = parseFloat(getComputedStyle($(".hm-rail__track", rail)).columnGap) || 20;
      var w = card ? card.getBoundingClientRect().width + gap : 300;
      return Math.max(w, Math.floor((rail.clientWidth * 0.8) / w) * w);
    };
    var update = function () {
      var max = rail.scrollWidth - rail.clientWidth;
      var x = rail.scrollLeft;
      if (bar) bar.style.setProperty("--p", max > 0 ? Math.max(0.08, (x + rail.clientWidth) / rail.scrollWidth).toFixed(3) : 1);
      btns.forEach(function (b) {
        var dir = +b.getAttribute("data-dir");
        var off = max <= 2 || (dir < 0 ? x <= 2 : x >= max - 2);
        b.setAttribute("aria-disabled", String(off));
      });
      if (x > 12) railBox.classList.add("is-scrolled");
    };
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-disabled") === "true") return;
        rail.scrollBy({ left: +b.getAttribute("data-dir") * step(), behavior: reduce ? "auto" : "smooth" });
      });
    });
    var ticking = false;
    rail.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    window.addEventListener("resize", update);
    update();

    /* mouse drag-to-scroll (touch already scrolls natively); a real drag never fires the card link */
    if (window.matchMedia("(pointer: fine)").matches) {
      var drag = null, swallow = false;
      rail.classList.add("is-draggable");
      rail.addEventListener("dragstart", function (e) { e.preventDefault(); });
      rail.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
      });
      window.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < 6) return;
        if (!drag.moved) { drag.moved = true; rail.classList.add("is-dragging"); }
        rail.scrollLeft = drag.left - dx;
      });
      var end = function () {
        if (!drag) return;
        if (drag.moved) {
          swallow = true;
          setTimeout(function () { swallow = false; }, 0);
          rail.classList.remove("is-dragging");
        }
        drag = null;
      };
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      rail.addEventListener("click", function (e) { if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true);
    }
  }

  /* ---------- "kim ..." board: chalk circle hops from line to line while visible ---------- */
  var who = $(".hm-who");
  if (who && !reduce && hasIO) {
    var items = $$("li", who), idx = -1, timer = 0;
    var tick = function () {
      if (items[idx]) items[idx].classList.remove("is-on");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("is-on");
    };
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !timer) { tick(); timer = setInterval(tick, 1500); }
        else if (!e.isIntersecting && timer) { clearInterval(timer); timer = 0; }
      });
    }, { threshold: 0.3 });
    vio.observe(who);
  }
})();
