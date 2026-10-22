/* Mathvivor — gallery page: filter chips, pointer tilt on thumbnails, custom lightbox (<dialog>). */
(function () {
  "use strict";
  var root = document.querySelector("[data-galeri]");
  if (!root) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var tiles = $$(".ar-tile");
  var chips = $$("[data-filter]");
  var countEl = $("[data-gal-count]");
  if (!tiles.length) return;

  var visibleTiles = function () { return tiles.filter(function (t) { return !t.hidden; }); };

  /* ---------- filter chips ---------- */
  var applyFilter = function (cat) {
    var shown = 0;
    tiles.forEach(function (t) {
      var match = cat === "hepsi" || t.getAttribute("data-cat") === cat;
      t.hidden = !match;
      t.classList.remove("is-pop");
      if (match) {
        if (!reduce) {
          t.style.setProperty("--d", Math.min(shown * 60, 360) + "ms");
          void t.offsetWidth;
          t.classList.add("is-pop");
        }
        shown++;
      }
    });
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-filter") === cat)); });
    if (countEl) countEl.textContent = shown;
  };
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      if (c.getAttribute("aria-pressed") === "true") return;
      applyFilter(c.getAttribute("data-filter"));
    });
  });
  tiles.forEach(function (t) { t.addEventListener("animationend", function () { t.classList.remove("is-pop"); }); });

  /* ---------- pointer tilt (fine pointers only) ---------- */
  if (finePointer && !reduce) {
    $$(".ar-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", ((px - 0.5) * 7).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - py) * 6).toFixed(2) + "deg");
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      });
    });
  }

  /* ---------- lightbox ---------- */
  var dlg = $("[data-lb]");
  if (!dlg || typeof dlg.showModal !== "function") return;
  var stage = $("[data-lb-stage]", dlg);
  var elI = $("[data-lb-i]", dlg), elN = $("[data-lb-n]", dlg);
  var elTitle = $("[data-lb-title]", dlg), elCap = $("[data-lb-cap]", dlg), elStatus = $("[data-lb-status]", dlg);
  var btnPrev = $("[data-lb-prev]", dlg), btnNext = $("[data-lb-next]", dlg), btnClose = $("[data-lb-close]", dlg);
  if (!stage || !btnPrev || !btnNext || !btnClose) return;

  var img = document.createElement("img");
  img.decoding = "async";
  img.alt = "";
  img.draggable = false;
  var list = [], idx = 0, opener = null, loadToken = 0;
  var cache = {};

  var preload = function (i) {
    var t = list[(i + list.length) % list.length];
    if (!t) return;
    var src = t.querySelector(".ar-card").getAttribute("href");
    if (cache[src]) return;
    var p = new Image();
    p.decoding = "async";
    p.src = src;
    cache[src] = p;
  };

  var show = function (i, dir) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    var tile = list[idx];
    var a = tile.querySelector(".ar-card"), thumb = a.querySelector("img");
    var src = a.getAttribute("href");
    var alt = thumb.getAttribute("alt") || "";
    var title = a.getAttribute("data-title") || "";
    var token = ++loadToken;

    var done = false;
    var reveal = function () {
      if (done || token !== loadToken) return;
      done = true;
      stage.classList.remove("is-loading");
      img.classList.remove("is-in-next", "is-in-prev", "is-in-zoom");
      if (reduce) return;
      void img.offsetWidth;
      img.classList.add(dir > 0 ? "is-in-next" : dir < 0 ? "is-in-prev" : "is-in-zoom");
    };
    stage.classList.add("is-loading");
    img.style.transform = "";
    img.onload = reveal;
    img.onerror = function () { if (token === loadToken) stage.classList.remove("is-loading"); };
    img.alt = alt;
    img.src = src;
    if (img.complete && img.naturalWidth) reveal();

    elI.textContent = String(idx + 1);
    elN.textContent = String(list.length);
    elTitle.textContent = title;
    elCap.textContent = alt;
    elStatus.textContent = "Görsel " + (idx + 1) + " / " + list.length + ": " + title;
    var single = list.length < 2;
    btnPrev.hidden = single;
    btnNext.hidden = single;
    preload(idx + 1);
    preload(idx - 1);
  };

  var open = function (tile) {
    list = visibleTiles();
    var i = list.indexOf(tile);
    if (i < 0) return;
    opener = tile.querySelector(".ar-card");
    if (!img.parentNode) stage.appendChild(img);
    document.documentElement.classList.add("ar-lock");
    dlg.showModal();
    show(i, 0);
    btnClose.focus();
  };

  var close = function () { if (dlg.open) dlg.close(); };

  dlg.addEventListener("close", function () {
    document.documentElement.classList.remove("ar-lock");
    elStatus.textContent = "";
    if (opener && document.contains(opener)) {
      try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); }
    }
  });

  tiles.forEach(function (t) {
    var a = t.querySelector(".ar-card");
    if (!a) return;
    a.addEventListener("click", function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(t);
    });
  });

  btnPrev.addEventListener("click", function () { show(idx - 1, -1); });
  btnNext.addEventListener("click", function () { show(idx + 1, 1); });
  btnClose.addEventListener("click", close);

  dlg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1, 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1, -1); }
    else if (e.key === "Home") { e.preventDefault(); show(0, -1); }
    else if (e.key === "End") { e.preventDefault(); show(list.length - 1, 1); }
  });

  /* click on the empty stage (outside the picture) closes */
  stage.addEventListener("click", function (e) { if (e.target === stage && !dragged) close(); });

  /* ---------- swipe (touch / pen / mouse drag) ---------- */
  var sx = 0, sy = 0, dx = 0, tracking = false, dragged = false, pid = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    tracking = true; dragged = false; pid = e.pointerId;
    sx = e.clientX; sy = e.clientY; dx = 0;
  });
  stage.addEventListener("pointermove", function (e) {
    if (!tracking || e.pointerId !== pid) return;
    dx = e.clientX - sx;
    var dy = e.clientY - sy;
    if (!dragged && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      dragged = true;
      stage.classList.add("is-dragging");
      try { stage.setPointerCapture(pid); } catch (err) {}
    }
    if (dragged && !reduce) {
      img.classList.remove("is-in-next", "is-in-prev", "is-in-zoom");
      img.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 60).toFixed(2) + "deg)";
    }
  });
  var endDrag = function (e) {
    if (!tracking || (e && e.pointerId !== pid)) return;
    tracking = false;
    stage.classList.remove("is-dragging");
    img.style.transform = "";
    if (dragged && Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    setTimeout(function () { dragged = false; }, 0);
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
})();
