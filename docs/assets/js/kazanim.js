/* Mathvivor — Kazanımlar: collectible badge wall (flip + unlock, scoreboard, filters, "Tam kadro!")
   and the scroll-linked hero seal. Progress persists in localStorage "mv-badges" (array of badge ids). */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MV = window.MV || {};

  /* ---------- hero seal turns with the scroll ---------- */
  var ring = document.querySelector(".kz-seal-ring");
  if (ring && !reduce) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ring.style.setProperty("--spin", (window.scrollY * 0.18) + "deg"); ticking = false; });
    }, { passive: true });
  }

  /* ---------- badge wall ---------- */
  var wall = document.querySelector("[data-kz-wall]");
  if (!wall) return;
  var badges = Array.prototype.slice.call(wall.querySelectorAll(".kz-badge[data-kz]"));
  if (!badges.length) return;

  var KEY = "mv-badges";
  var total = badges.length;
  var numEl = wall.querySelector("[data-kz-count]");
  var meter = Array.prototype.slice.call(wall.querySelectorAll(".kz-meter i"));
  var allBtn = wall.querySelector("[data-kz-all]");
  var resetBtns = Array.prototype.slice.call(wall.querySelectorAll("[data-kz-reset]"));
  var fullBox = wall.querySelector("[data-kz-full]");
  var live = wall.querySelector("[data-kz-live]");
  var chips = Array.prototype.slice.call(wall.querySelectorAll("[data-kz-filter]"));
  var board = wall.querySelector(".kz-board");
  var unlocked = {};
  var busy = false;
  var lastCount = -1;

  function nameOf(li) { var h = li.querySelector(".kz-name"); return h ? h.textContent.trim() : ""; }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) arr.forEach(function (id) { unlocked[id] = true; });
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
  }
  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(badges.map(function (b) { return b.getAttribute("data-kz"); }).filter(function (id) { return unlocked[id]; })));
    } catch (e) { /* ignore */ }
  }
  function count() { return badges.filter(function (b) { return unlocked[b.getAttribute("data-kz")]; }).length; }

  var liveTimer;
  function say(msg) {
    if (!live) return;
    live.textContent = "";
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { live.textContent = msg; }, 60);
  }

  function paintBadge(li) {
    var on = !!unlocked[li.getAttribute("data-kz")];
    li.classList.toggle("is-unlocked", on);
    var st = li.querySelector(".kz-state-txt");
    if (st) st.textContent = on ? "Açıldı" : "Kilitli";
  }

  function render() {
    var n = count();
    if (numEl && n !== lastCount) {
      numEl.textContent = String(n);
      if (lastCount !== -1 && !reduce) { numEl.classList.remove("is-tick"); void numEl.offsetWidth; numEl.classList.add("is-tick"); }
    }
    lastCount = n;
    meter.forEach(function (m, i) { m.classList.toggle("on", i < n); });
    var full = n === total;
    wall.classList.toggle("is-full", full);
    var hadFocus = !!allBtn && document.activeElement === allBtn;
    resetBtns.forEach(function (b) { b.hidden = n === 0; });
    /* aria-disabled (not disabled) so a keyboard user keeps focus on the button while the cascade runs */
    if (allBtn) { allBtn.hidden = full; allBtn.setAttribute("aria-disabled", String(busy)); }
    if (full && hadFocus) {
      /* "Hepsini aç" just disappeared under the keyboard: hand focus to the visible reset button */
      var vis = resetBtns.filter(function (b) { return b.offsetParent !== null; })[0];
      if (vis) vis.focus();
    }
    if (fullBox) fullBox.hidden = !full;
    chips.forEach(function (c) {
      var g = c.getAttribute("data-kz-filter");
      var group = badges.filter(function (b) { return g === "all" || b.getAttribute("data-group") === g; });
      var got = group.filter(function (b) { return unlocked[b.getAttribute("data-kz")]; }).length;
      var out = c.querySelector(".kz-chip-n");
      if (out) out.textContent = got + "/" + group.length;
    });
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function celebrate() {
    say("Tam kadro! " + total + " / " + total + " kazanım açıldı.");
    if (typeof MV.confetti === "function" && board) {
      var c = centerOf(board);
      MV.confetti(c.x, c.y, 70);
      setTimeout(function () { MV.confetti(window.innerWidth * 0.25, window.innerHeight * 0.35, 40); MV.confetti(window.innerWidth * 0.75, window.innerHeight * 0.35, 40); }, 320);
    }
  }

  function fx(li) {
    if (reduce) return;
    li.classList.remove("kz-burst", "kz-just");
    void li.offsetWidth;
    li.classList.add("kz-burst", "kz-just");
    setTimeout(function () { li.classList.remove("kz-burst", "kz-just"); }, 1200);
  }

  function plusOne(li) {
    if (reduce) return;
    var p = document.createElement("span");
    p.className = "kz-plus";
    p.setAttribute("aria-hidden", "true");
    p.textContent = "+1";
    li.appendChild(p);
    setTimeout(function () { p.remove(); }, 1000);
  }

  function unlock(li, opts) {
    var id = li.getAttribute("data-kz");
    if (unlocked[id]) return false;
    unlocked[id] = true;
    wall.classList.remove("is-fresh");
    paintBadge(li);
    if (!opts || !opts.quiet) fx(li);
    return true;
  }

  function toggle(li) {
    if (busy) return;
    var btn = li.querySelector(".kz-hit");
    var flipped = !li.classList.contains("is-flipped");
    li.classList.toggle("is-flipped", flipped);
    if (btn) btn.setAttribute("aria-pressed", String(flipped));
    if (flipped && unlock(li)) {
      plusOne(li);
      save();
      render();
      var n = count();
      if (n === total) {
        celebrate();
      } else {
        say(nameOf(li) + " rozeti açıldı. " + n + " / " + total + " kazanım açıldı.");
        if (typeof MV.confetti === "function") { var c = centerOf(li); MV.confetti(c.x, c.y, 14); }
      }
    }
  }

  function unlockAll() {
    if (busy) return;
    var todo = badges.filter(function (b) { return !unlocked[b.getAttribute("data-kz")]; });
    if (!todo.length) return;
    busy = true;
    render();
    var shown = todo.filter(function (b) { return !b.hidden; });
    var hiddenOnes = todo.filter(function (b) { return b.hidden; });
    hiddenOnes.forEach(function (b) { unlock(b, { quiet: true }); });
    var step = reduce ? 0 : 90;
    var finish = function () { busy = false; save(); render(); celebrate(); };
    if (!step) { shown.forEach(function (b) { unlock(b, { quiet: true }); }); finish(); return; }
    shown.forEach(function (b, i) {
      setTimeout(function () {
        unlock(b);
        render();
        if (i === shown.length - 1) setTimeout(finish, 350);
      }, i * step);
    });
    if (!shown.length) finish();
  }

  function resetAll() {
    if (busy) return;
    unlocked = {};
    badges.forEach(function (b) {
      b.classList.remove("is-flipped");
      var btn = b.querySelector(".kz-hit");
      if (btn) btn.setAttribute("aria-pressed", "false");
      paintBadge(b);
    });
    save();
    render();
    wall.classList.add("is-fresh");
    say("Rozetler sıfırlandı. 0 / " + total + " kazanım açıldı.");
    if (allBtn) allBtn.focus();
  }

  function setFilter(g) {
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-kz-filter") === g)); });
    var shown = 0;
    badges.forEach(function (b) {
      var vis = g === "all" || b.getAttribute("data-group") === g;
      b.hidden = !vis;
      if (vis) {
        shown++;
        b.classList.add("is-in");
        if (!reduce && b.animate) b.animate([{ opacity: 0, transform: "translateY(14px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: Math.min(shown * 35, 300), easing: "cubic-bezier(.22,.61,.36,1)", fill: "backwards" });
      }
    });
    var label = { all: "Tüm kazanımlar", zihin: "Zihin grubu", takim: "Takım grubu", hareket: "Hareket grubu" }[g] || "";
    say(label + ": " + shown + " rozet gösteriliyor.");
  }

  /* pointer tilt — fine pointers only */
  function bindTilt(li) {
    var tilt = li.querySelector(".kz-tilt");
    if (!tilt) return;
    li.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = li.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--ry", (px * 14).toFixed(2) + "deg");
      tilt.style.setProperty("--rx", (-py * 12).toFixed(2) + "deg");
    });
    li.addEventListener("pointerleave", function () {
      tilt.style.removeProperty("--rx");
      tilt.style.removeProperty("--ry");
    });
  }

  /* ---------- init ---------- */
  load();
  badges.forEach(function (li) {
    paintBadge(li);
    var btn = li.querySelector(".kz-hit");
    if (btn) btn.addEventListener("click", function () { toggle(li); });
    if (!reduce && window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) bindTilt(li);
  });
  if (count() === 0) wall.classList.add("is-fresh");
  if (allBtn) allBtn.addEventListener("click", unlockAll);
  resetBtns.forEach(function (b) { b.addEventListener("click", resetAll); });
  chips.forEach(function (c) { c.addEventListener("click", function () { setFilter(c.getAttribute("data-kz-filter")); }); });
  render();
})();
