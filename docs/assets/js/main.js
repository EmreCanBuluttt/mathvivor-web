/* Mathvivor — site-wide behaviour: menu, contact wiring from config.js, reveal-on-scroll, ticker, chalk formulas. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var C = window.MATHVIVOR_CONFIG || {};
  window.MV = window.MV || {};

  /* ---------- mobile menu ---------- */
  var burger = $(".burger"), nav = $("#site-nav");
  if (burger && nav) {
    var setOpen = function (open) {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    };
    burger.addEventListener("click", function () { setOpen(burger.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); burger.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth > 1080) setOpen(false); });
  }

  /* ---------- contact wiring (config.js) ---------- */
  var phones = (C.phones || []).filter(Boolean);
  var wa = String(C.whatsapp || "").replace(/\D/g, "");
  var email = String(C.email || "").trim();
  var tel = function (p) { return "tel:" + p.replace(/[^\d+]/g, ""); };
  MV.contact = { phones: phones, whatsapp: wa, email: email, formEndpoint: C.formEndpoint || "" };
  MV.waLink = function (text) { return wa ? "https://wa.me/" + wa + (text ? "?text=" + encodeURIComponent(text) : "") : ""; };

  /* data-contact-phones="icon" puts a phone icon in front of each number (footer rows) */
  $$("[data-contact-phones]").forEach(function (el) {
    if (!phones.length) { el.hidden = true; return; }
    var icon = el.getAttribute("data-contact-phones") === "icon";
    var ico = icon ? '<svg class="ico-inline" aria-hidden="true"><use href="#i-phone"/></svg>' : "";
    el.innerHTML = phones.map(function (p) { return '<a href="' + tel(p) + '">' + ico + p + "</a>"; }).join(icon ? "" : "<br>");
  });
  $$("[data-phone]").forEach(function (el) {
    var p = phones[+el.getAttribute("data-phone") || 0];
    if (!p) { el.hidden = true; return; }
    if (el.tagName === "A") el.href = tel(p);
    var t = $("[data-phone-text]", el) || (el.children.length ? null : el);
    if (t) t.textContent = p;
  });
  $$("[data-whatsapp]").forEach(function (el) {
    if (!wa) { el.hidden = true; return; }
    el.href = MV.waLink(el.getAttribute("data-whatsapp") || "Merhaba, Mathvivor hakkında bilgi almak istiyorum.");
    el.target = "_blank"; el.rel = "noopener";
    el.hidden = false;
  });
  $$("[data-email]").forEach(function (el) {
    if (!email) return;
    if (el.tagName === "A") el.href = "mailto:" + email;
    ($("[data-email-text]", el) || el).textContent = email;
  });
  $$("[data-email-row]").forEach(function (el) { el.hidden = !email; });
  var anyChannel = phones.length || wa || email;
  $$("[data-contact-only]").forEach(function (el) { el.hidden = !anyChannel; });
  $$("[data-contact-empty]").forEach(function (el) { el.hidden = !!anyChannel; });

  /* ---------- ticker: duplicate track so the loop is seamless ---------- */
  $$(".ticker-track").forEach(function (t) {
    if (t.dataset.cloned) return;
    var items = $$(":scope > span", t);
    items.forEach(function (s) { var c = s.cloneNode(true); c.setAttribute("aria-hidden", "true"); t.appendChild(c); });
    t.dataset.cloned = "1";
  });

  /* ---------- chalk formulas: <div class="chalk-bg" data-formulas="a|b|c"></div>
     Formulas alternate between the outer left and right bands (anchored with left/right so they never
     spill off the edge) and are spread top to bottom; the middle, where the text sits, stays clear. ---------- */
  var FORMULAS = ["a² + b² = c²", "π ≈ 3,14", "x + 7 = 12", "6 × 7 = 42", "∑", "√49 = 7", "45°", "1 + 1 = takım", "3 × 3 = 9", "y = 2x + 1", "∞", "Δt", "%50", "4 + 4 + 4 = 12", "½ + ½ = 1"];
  $$(".chalk-bg").forEach(function (box, bi) {
    if (box.children.length) return;
    var list = box.getAttribute("data-formulas") ? box.getAttribute("data-formulas").split("|") : FORMULAS;
    var n = +box.getAttribute("data-count") || 9;
    var perSide = [Math.ceil(n / 2), Math.floor(n / 2) || 1];
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      s.textContent = list[(i + bi * 3) % list.length];
      var side = i % 2, slot = (i - side) / 2, step = 86 / perSide[side];
      s.style[side ? "right" : "left"] = (1 + ((i * 37 + bi * 11) % 8)) + "%";
      s.style.top = (2 + (slot + (side ? 0.62 : 0.22)) * step + ((i * 23 + bi * 7) % 7) - 3) + "%";
      s.style.setProperty("--rot", (((i * 47) % 22) - 11) + "deg");
      box.appendChild(s);
    }
    box.setAttribute("aria-hidden", "true");
  });

  /* ---------- reveal on scroll ---------- */
  var rev = $$(".reveal");
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rev.forEach(function (el, i) {
      if (!el.style.transitionDelay && el.parentElement && el.parentElement.classList.contains("stagger")) {
        var idx = Array.prototype.indexOf.call(el.parentElement.children, el);
        el.style.transitionDelay = Math.min(idx * 70, 420) + "ms";
      }
      io.observe(el);
    });
  } else {
    rev.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- count-up numbers: <span data-count-to="17">0</span> ---------- */
  var counters = $$("[data-count-to]");
  if (counters.length && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, to = +el.getAttribute("data-count-to"); cio.unobserve(el);
        if (reduce) { el.textContent = to; return; }
        var t0 = performance.now(), dur = 1100;
        (function tick(t) { var k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); })(t0);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { cio.observe(c); });
  } else counters.forEach(function (c) { c.textContent = c.getAttribute("data-count-to"); });

  /* ---------- header shadow once scrolled ---------- */
  var header = $(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---------- floating WhatsApp (phones only): tucked while the first screen is in view, so it never
     covers hero content at load, and while scrolling down; it slides back in on scroll up ---------- */
  var waBtn = $(".wa-float");
  if (waBtn) {
    var phoneMq = window.matchMedia ? window.matchMedia("(max-width: 760px)") : null;
    var lastY = window.scrollY, goingDown = false;
    var updateWa = function () {
      var y = window.scrollY, vh = window.innerHeight;
      if (Math.abs(y - lastY) >= 6) { goingDown = y > lastY; lastY = y; }
      var maxY = document.documentElement.scrollHeight - vh;
      /* a page too short to scroll past the first screen still gets the button */
      var firstScreen = y < vh * 0.6 && maxY > vh * 0.6 + 40;
      var tuck = !!(phoneMq && phoneMq.matches) && (firstScreen || (goingDown && y > 200));
      waBtn.classList.toggle("is-tucked", tuck);
    };
    window.addEventListener("scroll", updateWa, { passive: true });
    window.addEventListener("resize", updateWa);
    updateWa();
  }

  /* ---------- tiny confetti helper (used by games, quiz, badges) ---------- */
  MV.confetti = function (x, y, n) {
    if (reduce) return;
    var colors = ["#ffcd1f", "#d6111c", "#e0a93b", "#f4efe4", "#3aa0ff"];
    n = n || 40;
    for (var i = 0; i < n; i++) {
      var p = document.createElement("i");
      p.className = "mv-confetti";
      p.style.left = x + "px"; p.style.top = y + "px";
      p.style.background = colors[i % colors.length];
      var a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      p.style.setProperty("--dx", Math.cos(a) * v + "px");
      p.style.setProperty("--dy", (Math.sin(a) * v - 160) + "px");
      p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      document.body.appendChild(p);
      setTimeout(function (el) { el.remove(); }, 1300, p);
    }
  };
})();
