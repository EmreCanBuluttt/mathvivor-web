/* Mathvivor — Kurumsal page script.
   1) Tactics board. Markup: [data-taktik] > .tb-board with .tb-token buttons (data-id, data-x, data-y in %,
   data-to="2,3", data-q, data-cap, optional data-broken), .tb-lines svg, .tb-note (.tb-q, .tb-cap),
   .tb-roster li[data-id], [data-tb-reset], [data-tb-all], [data-tb-live].
   Select a player (click / Enter / Space on a token, or tap its roster row) to draw animated chalk
   pass-lines to teammates; drag players (pointer) or nudge them with the arrow keys (Shift = bigger steps);
   Escape clears; "Takımı bağla" links everyone.
   2) Audience sub-nav: .sy-tabs a[href^="#"] gets aria-current while its section is on screen.
   No globals, no external requests; respects prefers-reduced-motion. */
(function () {
  "use strict";
  var root = document.querySelector("[data-taktik]");
  if (!root) return;
  var board = root.querySelector(".tb-board");
  var svg = root.querySelector(".tb-lines");
  var tokens = Array.prototype.slice.call(root.querySelectorAll(".tb-token"));
  if (!board || !svg || !tokens.length || !svg.appendChild) return;

  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var note = root.querySelector(".tb-note");
  var qEl = root.querySelector(".tb-q");
  var capEl = root.querySelector(".tb-cap");
  var live = root.querySelector("[data-tb-live]");
  var resetBtn = root.querySelector("[data-tb-reset]");
  var allBtn = root.querySelector("[data-tb-all]");
  var rosterItems = Array.prototype.slice.call(root.querySelectorAll(".tb-roster li[data-id]"));
  var DUR = 520, STAGGER = 120;

  var players = {}, order = [];
  tokens.forEach(function (el) {
    var id = el.getAttribute("data-id");
    var x = parseFloat(el.getAttribute("data-x")), y = parseFloat(el.getAttribute("data-y"));
    if (!id || isNaN(x) || isNaN(y)) return;
    players[id] = {
      id: id, el: el, x: x, y: y, hx: x, hy: y,
      to: (el.getAttribute("data-to") || "").split(",").map(function (s) { return s.trim(); }).filter(function (t) { return t && t !== id; }),
      q: el.getAttribute("data-q") || "", cap: el.getAttribute("data-cap") || "",
      broken: el.hasAttribute("data-broken")
    };
    order.push(id);
  });
  if (!order.length) return;
  order.forEach(function (id) { players[id].to = players[id].to.filter(function (t) { return players[t]; }); });

  var empty = { q: qEl ? qEl.innerHTML : "", cap: capEl ? capEl.textContent : "" };
  var state = { mode: "none", sel: null };

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function joinTr(list) {
    if (list.length < 2) return list.join("");
    return list.slice(0, -1).join(", ") + " ve " + list[list.length - 1];
  }
  function announce(msg) {
    if (!live) return;
    live.textContent = "";
    window.setTimeout(function () { live.textContent = msg; }, 40);
  }
  function place(p) { p.el.style.left = p.x + "%"; p.el.style.top = p.y + "%"; }
  function margins() {
    var w = board.clientWidth || 1, h = board.clientHeight || 1, r = (tokens[0].offsetWidth || 50) / 2 + 4;
    return { x: r / w * 100, y: r / h * 100, yb: (r + 18) / h * 100 };
  }
  function setNote(qHtml, cap) {
    if (!note || !qEl || !capEl) return;
    qEl.innerHTML = qHtml;
    capEl.textContent = cap;
    note.classList.remove("is-writing");
    void note.offsetWidth;
    if (!reduce) note.classList.add("is-writing");
  }
  function mark(activeId, targets, all) {
    tokens.forEach(function (t) {
      var id = t.getAttribute("data-id");
      t.setAttribute("aria-pressed", String(id === activeId));
      t.classList.toggle("is-target", !!all || targets.indexOf(id) > -1);
    });
    rosterItems.forEach(function (li) {
      var id = li.getAttribute("data-id");
      li.classList.toggle("is-active", id === activeId || !!all);
      li.classList.toggle("is-target", targets.indexOf(id) > -1);
    });
    root.classList.toggle("has-sel", !!activeId);
  }

  /* ---------- geometry ---------- */
  var W = 0, H = 0;
  function measure() {
    W = board.clientWidth; H = board.clientHeight;
    if (W && H) svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  }
  function px(p) { return { x: p.x / 100 * W, y: p.y / 100 * H }; }
  function geom(L) {
    var a = px(players[L.a]), b = px(players[L.b]);
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var c = { x: (a.x + b.x) / 2 - dy / len * len * L.bend, y: (a.y + b.y) / 2 + dx / len * len * L.bend };
    var r = (players[L.a].el.offsetWidth || 50) / 2 + 6;
    function pull(p, toward, d) {
      var vx = toward.x - p.x, vy = toward.y - p.y, l = Math.sqrt(vx * vx + vy * vy) || 1;
      d = Math.min(d, l * 0.45);
      return { x: p.x + vx / l * d, y: p.y + vy / l * d };
    }
    return { a: pull(a, c, r), c: c, b: pull(b, c, r + 4) };
  }
  function lerp(p, q, t) { return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; }
  function qpt(g, t) { return lerp(lerp(g.a, g.c, t), lerp(g.c, g.b, t), t); }
  function f(n) { return Math.round(n * 10) / 10; }
  function partial(g, t, broken) {
    if (t <= 0) return "";
    if (!broken) {
      var c1 = lerp(g.a, g.c, t), e = qpt(g, t);
      return "M" + f(g.a.x) + " " + f(g.a.y) + " Q" + f(c1.x) + " " + f(c1.y) + " " + f(e.x) + " " + f(e.y);
    }
    var d = "", n = 14;
    for (var i = 0; i < n; i++) {
      var s0 = i / n, s1 = (i + 0.55) / n;
      if (s0 >= t) break;
      var p0 = qpt(g, s0), p1 = qpt(g, Math.min(s1, t));
      var j = (i % 2 ? 1 : -1) * 3;
      d += "M" + f(p0.x) + " " + f(p0.y + j) + " L" + f(p1.x) + " " + f(p1.y - j) + " ";
    }
    return d;
  }
  function arrow(g) {
    var vx = g.b.x - g.c.x, vy = g.b.y - g.c.y, l = Math.sqrt(vx * vx + vy * vy) || 1, s = 13;
    vx /= l; vy /= l;
    var ca = Math.cos(0.5), sa = Math.sin(0.5);
    var w1 = { x: g.b.x - s * (vx * ca - vy * sa), y: g.b.y - s * (vy * ca + vx * sa) };
    var w2 = { x: g.b.x - s * (vx * ca + vy * sa), y: g.b.y - s * (vy * ca - vx * sa) };
    return "M" + f(w1.x) + " " + f(w1.y) + " L" + f(g.b.x) + " " + f(g.b.y) + " L" + f(w2.x) + " " + f(w2.y);
  }

  /* ---------- line layer ---------- */
  var gLines = document.createElementNS(NS, "g"), gBalls = document.createElementNS(NS, "g");
  gLines.setAttribute("class", "tb-pass-g");
  svg.appendChild(gLines); svg.appendChild(gBalls);
  var lines = [], raf = 0, t0 = 0, onDone = null;

  function el(name, cls) { var n = document.createElementNS(NS, name); n.setAttribute("class", cls); return n; }
  function setLines(list, animate, done) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    while (gLines.firstChild) gLines.removeChild(gLines.firstChild);
    while (gBalls.firstChild) gBalls.removeChild(gBalls.firstChild);
    measure();
    var anim = animate && !reduce;
    lines = list.map(function (L, i) {
      var mod = L.all ? " tb-pass--all" : "";
      L.path = el("path", "tb-pass" + mod);
      L.head = el("path", "tb-head" + (L.all ? " tb-head--all" : ""));
      gLines.appendChild(L.path);
      if (anim) { L.ball = el("circle", "tb-ball"); L.ball.setAttribute("r", "6"); L.ball.style.opacity = "0"; gBalls.appendChild(L.ball); }
      L.delay = anim ? i * STAGGER : 0;
      L.done = !anim;
      return L;
    });
    onDone = anim ? (done || null) : null;
    t0 = performance.now();
    if (anim) raf = requestAnimationFrame(frame);
    else render(true);
    if (!anim && done && !reduce) done();
  }
  function render(full) {
    lines.forEach(function (L) {
      var g = geom(L);
      L.path.setAttribute("d", partial(g, full || L.done ? 1 : L.t || 0, L.broken));
      if (full || L.done) {
        if (!L.head.parentNode) gLines.appendChild(L.head);
        L.head.setAttribute("d", arrow(g));
        if (L.ball) L.ball.style.opacity = "0";
      }
    });
  }
  function frame(now) {
    var busy = false;
    lines.forEach(function (L) {
      if (L.done) return;
      var t = clamp((now - t0 - L.delay) / DUR, 0, 1);
      t = 1 - Math.pow(1 - t, 2);
      L.t = t;
      if (t >= 1) { L.done = true; } else busy = true;
      if (L.ball && t > 0 && t < 1) {
        var p = qpt(geom(L), t);
        L.ball.setAttribute("cx", f(p.x)); L.ball.setAttribute("cy", f(p.y)); L.ball.style.opacity = "1";
      }
    });
    render(false);
    if (busy) raf = requestAnimationFrame(frame);
    else { raf = 0; if (onDone) { var cb = onDone; onDone = null; cb(); } }
  }
  function finishNow() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lines.forEach(function (L) { L.done = true; });
    onDone = null;
  }

  /* ---------- modes ---------- */
  function passList(id) {
    var p = players[id];
    return p.to.map(function (to, i) { return { a: id, b: to, broken: p.broken, bend: (i % 2 ? -1 : 1) * 0.14 }; });
  }
  function chainList() {
    var cx = 0, cy = 0;
    order.forEach(function (id) { cx += players[id].x; cy += players[id].y; });
    cx /= order.length; cy /= order.length;
    var ring = order.slice().sort(function (a, b) {
      return Math.atan2(players[a].y - cy, players[a].x - cx) - Math.atan2(players[b].y - cy, players[b].x - cx);
    });
    return ring.map(function (id, i) { return { a: id, b: ring[(i + 1) % ring.length], all: true, bend: 0.1 }; });
  }
  function select(id, silent) {
    var p = players[id];
    if (!p) return;
    state.mode = "one"; state.sel = id;
    mark(id, p.to, false);
    setNote(escapeHtml(p.q), p.cap);
    setLines(passList(id), true);
    if (!silent) announce(id + " numara seçildi: " + p.q + " Pas çizgileri " + joinTr(p.to) + " numaralı oyunculara.");
  }
  function clearSel(msg) {
    state.mode = "none"; state.sel = null;
    mark(null, [], false);
    setNote(empty.q, empty.cap);
    setLines([], false);
    if (msg) announce(msg);
  }
  function connectAll() {
    state.mode = "all"; state.sel = null;
    mark(null, [], true);
    setNote('<span lang="en">Connecting People</span>', "Yedi soru, tek takım. Kim daha iyi çalışıyor değil, kim daha iyi takım oluyor, keşfedin.");
    setLines(chainList(), true, function () {
      if (window.MV && typeof window.MV.confetti === "function") {
        var r = board.getBoundingClientRect();
        window.MV.confetti(r.left + r.width / 2, r.top + r.height / 2, 60);
      }
    });
    announce("Tüm takım birbirine bağlandı.");
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function moved() {
    if (state.mode === "all") { setLines(chainList(), false); return; }
    finishNow(); measure(); render(true);
  }
  function reset() {
    root.classList.add("is-resetting");
    order.forEach(function (id) { var p = players[id]; p.x = p.hx; p.y = p.hy; place(p); });
    clearSel("Diziliş sıfırlandı.");
    window.setTimeout(function () { root.classList.remove("is-resetting"); }, 650);
  }

  /* ---------- input: click / keyboard / drag ---------- */
  var drag = null, suppressUntil = 0;
  tokens.forEach(function (tk) {
    var id = tk.getAttribute("data-id");
    if (!players[id]) return;
    tk.addEventListener("click", function () {
      if (performance.now() < suppressUntil) return;
      select(id);
    });
    tk.addEventListener("keydown", function (e) {
      var k = e.key, step = e.shiftKey ? 8 : 3, dx = 0, dy = 0;
      if (k === "Escape") { if (state.mode !== "none") { e.preventDefault(); clearSel("Seçim kaldırıldı."); } return; }
      if (k === "ArrowLeft") dx = -step; else if (k === "ArrowRight") dx = step;
      else if (k === "ArrowUp") dy = -step; else if (k === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      var p = players[id], m = margins();
      p.x = clamp(p.x + dx, m.x, 100 - m.x); p.y = clamp(p.y + dy, m.y, 100 - m.yb);
      place(p); moved();
    });
    tk.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      var r = board.getBoundingClientRect(), p = players[id];
      drag = { id: id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, r: r, moved: false,
        ox: e.clientX - (r.left + p.x / 100 * r.width), oy: e.clientY - (r.top + p.y / 100 * r.height) };
      try { tk.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
    });
    tk.addEventListener("pointermove", function (e) {
      if (!drag || drag.id !== id || e.pointerId !== drag.pid) return;
      if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 6) return;
      if (!drag.moved) { drag.moved = true; tk.classList.add("is-dragging"); }
      e.preventDefault();
      var r = drag.r, p = players[id], m = margins();
      p.x = clamp((e.clientX - drag.ox - r.left) / r.width * 100, m.x, 100 - m.x);
      p.y = clamp((e.clientY - drag.oy - r.top) / r.height * 100, m.y, 100 - m.yb);
      place(p); moved();
    });
    function end(e) {
      if (!drag || drag.id !== id || (e && e.pointerId !== drag.pid)) return;
      if (drag.moved) { suppressUntil = performance.now() + 350; tk.classList.remove("is-dragging"); }
      try { tk.releasePointerCapture(drag.pid); } catch (err) { /* already released */ }
      drag = null;
    }
    tk.addEventListener("pointerup", end);
    tk.addEventListener("pointercancel", end);
    tk.addEventListener("lostpointercapture", function () {
      if (drag && drag.id === id) { if (drag.moved) { suppressUntil = performance.now() + 350; tk.classList.remove("is-dragging"); } drag = null; }
    });
  });
  if (resetBtn) resetBtn.addEventListener("click", reset);
  if (allBtn) allBtn.addEventListener("click", connectAll);

  /* roster rows are a bigger pointer target for the same action (tokens stay the keyboard path) */
  var stage = root.querySelector(".tb-stage"), panel = root.querySelector(".tb-panel");
  function boardInView() {
    if (!stage || !panel || typeof stage.scrollIntoView !== "function") return;
    var s = stage.getBoundingClientRect(), p = panel.getBoundingClientRect();
    var stacked = p.top >= s.bottom - 1;
    var headerH = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 76;
    if (stacked && s.top < headerH) stage.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }
  rosterItems.forEach(function (li) {
    var id = li.getAttribute("data-id");
    if (!players[id]) return;
    li.addEventListener("click", function () { select(id); boardInView(); });
  });

  /* ---------- size changes ---------- */
  function onResize() { if (state.mode === "none") { measure(); return; } finishNow(); measure(); render(true); }
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(board);
  else window.addEventListener("resize", onResize);
  measure();

  /* ---------- first look: demo the leader's passes once the board is on screen ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (state.mode === "none") select(order[0], true);
      });
    }, { threshold: 0.45 });
    io.observe(board);
  }
})();

(function () {
  "use strict";
  var links = Array.prototype.slice.call(document.querySelectorAll('.sy-tabs a[href^="#"]'));
  if (!links.length || !("IntersectionObserver" in window)) return;
  var map = [];
  links.forEach(function (a) {
    var target = document.getElementById(a.getAttribute("href").slice(1));
    if (target) map.push({ a: a, el: target, on: false });
  });
  if (!map.length) return;
  function paint() {
    var active = null;
    map.forEach(function (m) { if (m.on && !active) active = m; });
    map.forEach(function (m) {
      if (m === active) m.a.setAttribute("aria-current", "true");
      else m.a.removeAttribute("aria-current");
    });
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      map.forEach(function (m) { if (m.el === e.target) m.on = e.isIntersecting; });
    });
    paint();
  }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
  map.forEach(function (m) { io.observe(m.el); });
})();
