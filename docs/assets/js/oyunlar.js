/* Mathvivor — Oyunları Keşfet: category filter, Turkish-aware search with highlights,
   compact search swap on narrow bars, slot-machine "Bana bir oyun seç!" picker, anchor
   handling for card ids (filters never hide a linked card), card tilt, keyboard access
   for the Connect photo strip. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.getElementById("oy-katalog");
  if (!root) return;

  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq("(prefers-reduced-motion: reduce)");
  var MV = window.MV || {};

  var CAT_PLURAL = { parkur: "Parkurlar", destek: "Destekleyici oyunlar", atolye: "Atölyeler", ozel: "Özel projeler" };
  var CAT_ONE = { parkur: "Parkur", destek: "Destekleyici oyun", atolye: "Atölye", ozel: "Özel proje" };

  /* ---------- Turkish-aware folding: İ/I/ı → i, ç ğ ö ş ü → c g o s u (length-preserving) ---------- */
  var FOLD = { "İ": "i", "I": "i", "ı": "i", "Ç": "c", "ç": "c", "Ğ": "g", "ğ": "g", "Ö": "o", "ö": "o", "Ş": "s", "ş": "s", "Ü": "u", "ü": "u", "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u" };
  function fold(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i), f = FOLD[ch];
      if (!f) { f = ch.toLowerCase(); if (f.length !== 1) f = ch; }
      out += f;
    }
    return out;
  }
  function tokensOf(q) { return fold(q).split(/[\s\/,.;:!?()\[\]"'’“”\-–—]+/).filter(Boolean); }

  /* ---------- elements ---------- */
  var bar = $(".oy-bar", root);
  var chips = $$(".oy-chip", root);
  var input = $("#oy-q");
  var searchBox = input ? input.closest(".oy-search") : null;
  var clearBtn = $(".oy-search-clear", root);
  var toggle = $(".oy-search-toggle", root);
  var dot = toggle ? $(".oy-search-dot", toggle) : null;
  var chipBox = $(".oy-chips", root);
  var status = $("#oy-status");
  var sections = $$(".oy-cat", root);
  var empty = $(".oy-empty", root);
  var emptyQ = empty ? $("[data-oy-q]", empty) : null;
  var header = $(".site-header");

  var items = $$(".oy-cell", root).map(function (li) {
    var card = $(".oy-card", li), nameEl = card ? $(".oy-card-name", card) : null;
    if (!card || !nameEl) return null;
    var extra = $$(".oy-card-cat, .oy-card-sub", card).map(function (e) { return e.textContent; }).join(" ");
    return {
      li: li, card: card, id: card.id, cat: card.getAttribute("data-cat"), no: card.getAttribute("data-no") || "",
      nameEl: nameEl, nameHTML: nameEl.innerHTML, name: nameEl.textContent.replace(/\s+/g, " ").trim(),
      hay: fold((nameEl.textContent + " " + extra).replace(/\s+/g, " ")), marked: ""
    };
  }).filter(Boolean);
  if (!items.length) return;

  /* decorative watermark: a big cropped copy of each drawn card's icon */
  $$(".oy-card-art--draw", root).forEach(function (art) {
    var g = $(".oy-glyph svg", art);
    if (!g || $(".oy-mark", art)) return;
    var m = doc.createElement("span");
    m.className = "oy-mark";
    m.setAttribute("aria-hidden", "true");
    m.appendChild(g.cloneNode(true));
    art.insertBefore(m, art.firstChild);
  });

  var state = { filter: "all", q: "" };
  var headerH = function () { return header ? header.getBoundingClientRect().height : 76; };
  var smooth = function () { return reduce ? "instant" : "smooth"; };

  /* ---------- live region ---------- */
  var annT = 0;
  function announce(text, delay) {
    if (!status) return;
    clearTimeout(annT);
    annT = setTimeout(function () { status.textContent = ""; setTimeout(function () { status.textContent = text; }, 40); }, delay || 0);
  }

  /* ---------- search highlight inside the card name (keeps lang spans intact) ---------- */
  function mark(it, tokens) {
    var key = tokens.join(" ");
    if (key === it.marked) return;
    it.marked = key;
    it.nameEl.innerHTML = it.nameHTML;
    if (!tokens.length) return;
    var walker = doc.createTreeWalker(it.nameEl, 4 /* NodeFilter.SHOW_TEXT */, null), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue, f = fold(text), ranges = [];
      tokens.forEach(function (t) {
        var from = 0, k;
        while ((k = f.indexOf(t, from)) > -1) { ranges.push([k, k + t.length]); from = k + t.length; }
      });
      if (!ranges.length) return;
      ranges.sort(function (a, b) { return a[0] - b[0]; });
      var merged = [ranges[0]];
      for (var i = 1; i < ranges.length; i++) {
        var last = merged[merged.length - 1];
        if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]); else merged.push(ranges[i]);
      }
      var frag = doc.createDocumentFragment(), pos = 0;
      merged.forEach(function (r) {
        if (r[0] > pos) frag.appendChild(doc.createTextNode(text.slice(pos, r[0])));
        var m = doc.createElement("mark");
        m.className = "oy-hit";
        m.textContent = text.slice(r[0], r[1]);
        frag.appendChild(m);
        pos = r[1];
      });
      if (pos < text.length) frag.appendChild(doc.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* ---------- filter + search ---------- */
  var popT = 0;
  function apply(opts) {
    opts = opts || {};
    var tokens = tokensOf(state.q);
    var counts = { parkur: 0, destek: 0, atolye: 0, ozel: 0 }, total = 0, shown = [];
    items.forEach(function (it) {
      var match = tokens.every(function (t) { return it.hay.indexOf(t) > -1; });
      if (match) { counts[it.cat]++; total++; }
      var show = match && (state.filter === "all" || state.filter === it.cat);
      it.li.hidden = !show;
      if (show) shown.push(it);
      mark(it, show ? tokens : []);
    });
    sections.forEach(function (sec) {
      var c = sec.getAttribute("data-cat");
      sec.hidden = !((state.filter === "all" || state.filter === c) && counts[c] > 0);
    });
    chips.forEach(function (ch) {
      var f = ch.getAttribute("data-filter"), n = f === "all" ? total : counts[f] || 0;
      ch.setAttribute("aria-pressed", f === state.filter ? "true" : "false");
      ch.classList.toggle("is-zero", n === 0);
      var nEl = $(".oy-chip-n", ch);
      if (nEl && nEl.textContent !== String(n)) {
        nEl.textContent = n;
        if (!reduce) { nEl.classList.remove("is-bump"); void nEl.offsetWidth; nEl.classList.add("is-bump"); }
      }
    });
    if (empty) empty.hidden = shown.length > 0;
    if (emptyQ) emptyQ.textContent = state.q.trim();
    if (clearBtn) clearBtn.hidden = !state.q;
    if (searchBox) searchBox.classList.toggle("has-value", !!state.q);
    if (dot) dot.hidden = !state.q;
    root.classList.toggle("is-query", tokens.length > 0);

    if (opts.pop && !reduce) {
      clearTimeout(popT);
      items.forEach(function (it) { it.li.classList.remove("is-pop"); });
      void root.offsetWidth;
      shown.forEach(function (it, k) {
        it.li.classList.add("is-in");
        it.li.style.setProperty("--k", Math.min(k, 14));
        it.li.classList.add("is-pop");
      });
      popT = setTimeout(function () { items.forEach(function (it) { it.li.classList.remove("is-pop"); }); }, 1100);
    }
    return { shown: shown.length, total: total };
  }

  function statusText(r) {
    var q = state.q.trim();
    if (!q) {
      return state.filter === "all"
        ? "Tüm kategoriler gösteriliyor: " + r.shown + " kart."
        : CAT_PLURAL[state.filter] + ": " + r.shown + " kart gösteriliyor.";
    }
    var where = state.filter === "all" ? "" : CAT_PLURAL[state.filter] + " içinde ";
    return "“" + q + "” için " + where + r.shown + " sonuç.";
  }

  function toResultsTop(behavior) {
    var top = root.getBoundingClientRect().top, hh = headerH();
    if (top < hh - 2) window.scrollTo({ top: window.pageYOffset + top - hh, behavior: behavior });
  }

  function setQuery(q) {
    state.q = q;
    if (input && input.value !== q) input.value = q;
  }
  function resetAll() {
    state.filter = "all"; setQuery("");
    if (doc.activeElement !== input) closeSearch(false);
    return apply();
  }

  /* ---------- compact bar (≤1180px): the search field swaps in over the chips ---------- */
  var compact = function () { return !!toggle && mq("(max-width: 1180px)"); };
  function openSearch() {
    if (!bar) return;
    bar.classList.add("is-search-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (state.filter !== "all") { state.filter = "all"; announce(statusText(apply()), 60); }
    if (input) input.focus({ preventScroll: true });
  }
  function closeSearch(focusToggle) {
    if (!bar || !bar.classList.contains("is-search-open")) return;
    bar.classList.remove("is-search-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (focusToggle && compact()) toggle.focus();
    chipFade();
  }
  if (toggle) toggle.addEventListener("click", openSearch);
  if (input) input.addEventListener("blur", function () {
    setTimeout(function () {
      var a = doc.activeElement;
      if (!state.q && a !== input && a !== clearBtn) closeSearch(false);
    }, 140);
  });

  /* ---------- chips: edge fades while the row scrolls, keep the pressed chip in view ---------- */
  function chipFade() {
    if (!chipBox) return;
    var over = chipBox.scrollWidth > chipBox.clientWidth + 2, x = chipBox.scrollLeft;
    chipBox.classList.toggle("is-overflow", over);
    chipBox.classList.toggle("is-scrolled", over && x > 4);
    chipBox.classList.toggle("is-end", over && x + chipBox.clientWidth >= chipBox.scrollWidth - 4);
  }
  function chipIntoView(ch) {
    if (!chipBox || chipBox.scrollWidth <= chipBox.clientWidth + 2) return;
    var left = ch.offsetLeft - chipBox.offsetLeft - (chipBox.clientWidth - ch.offsetWidth) / 2;
    chipBox.scrollTo({ left: Math.max(0, left), behavior: smooth() });
  }
  if (chipBox) {
    chipBox.addEventListener("scroll", chipFade, { passive: true });
    window.addEventListener("resize", chipFade);
    if ("ResizeObserver" in window) new ResizeObserver(chipFade).observe(chipBox);
  }

  chips.forEach(function (ch) {
    ch.addEventListener("click", function () {
      state.filter = ch.getAttribute("data-filter") || "all";
      var r = apply({ pop: true });
      chipIntoView(ch);
      toResultsTop(smooth());
      announce(statusText(r), 60);
    });
  });

  if (input) {
    input.addEventListener("input", function () {
      setQuery(input.value);
      var r = apply();
      toResultsTop("instant");
      announce(statusText(r), 500);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && (input.value || compact())) {
        e.preventDefault(); e.stopPropagation();
        if (input.value) { setQuery(""); announce(statusText(apply()), 60); }
        if (compact()) closeSearch(true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        var first = items.filter(function (it) { return !it.li.hidden; })[0];
        if (first) { if (mq("(hover: none)")) input.blur(); goTo(first.card, { behavior: smooth(), flash: true }); }
      }
    });
  }
  if (clearBtn) clearBtn.addEventListener("click", function () {
    setQuery(""); announce(statusText(apply()), 60);
    if (compact()) closeSearch(true); else if (input) input.focus();
  });
  $$("[data-oy-reset]", root).forEach(function (b) {
    b.addEventListener("click", function () { var r = resetAll(); announce(statusText(r), 60); if (input) input.focus({ preventScroll: true }); toResultsTop(smooth()); });
  });

  /* "/" focuses the search box */
  doc.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || !input) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    e.preventDefault();
    if (compact()) openSearch(); else input.focus();
  });

  /* ---------- sticky bar metrics: scroll-margin for anchors = header + bar ---------- */
  function measure() {
    if (!bar) return;
    root.style.setProperty("--oy-stick", Math.round(headerH() + bar.getBoundingClientRect().height + 14) + "px");
  }
  measure();
  window.addEventListener("resize", measure);
  if (bar && "ResizeObserver" in window) new ResizeObserver(measure).observe(bar);

  var sentinel = $(".oy-sentinel", root);
  if (bar && sentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      var e = es[0];
      bar.classList.toggle("is-stuck", !e.isIntersecting && e.boundingClientRect.top < headerH() + 2);
    }, { rootMargin: "-" + (Math.round(headerH()) + 1) + "px 0px 0px 0px", threshold: 0 }).observe(sentinel);
  }

  /* ---------- anchors: #golf-connect etc. always lands on a visible card ---------- */
  function findTarget(id) {
    if (!id) return null;
    try { id = decodeURIComponent(id); } catch (err) { /* keep raw */ }
    var el = doc.getElementById(id);
    return el && root.contains(el) && (el.classList.contains("oy-card") || el.classList.contains("oy-cat")) ? el : null;
  }
  function ensureVisible(el) {
    if (el.closest("[hidden]")) { var r = resetAll(); announce(statusText(r), 60); }
    var li = el.closest(".oy-cell");
    if (li && !li.classList.contains("is-in")) {
      /* finish the reveal instantly so scrollIntoView measures the final position */
      li.style.transition = "none";
      li.classList.add("is-in");
      void li.offsetWidth;
      requestAnimationFrame(function () { li.style.transition = ""; });
    }
  }
  function flash(card) {
    card.classList.remove("is-target");
    void card.offsetWidth;
    card.classList.add("is-target");
    clearTimeout(card._oyFlash);
    card._oyFlash = setTimeout(function () { card.classList.remove("is-target"); }, 2600);
  }
  function goTo(el, how) {
    how = how || {};
    ensureVisible(el);
    measure();
    if (el.classList.contains("is-picked")) {
      /* leave room above the card for the "Senin oyunun!" sticker */
      var stick = parseFloat(root.style.getPropertyValue("--oy-stick")) || 170;
      window.scrollTo({ top: Math.max(0, window.pageYOffset + el.getBoundingClientRect().top - stick - 22), behavior: how.behavior || "instant" });
    } else {
      el.scrollIntoView({ block: "start", behavior: how.behavior || "instant" });
    }
    if (el.classList.contains("oy-card")) {
      if (how.flash) flash(el);
      if (how.focus) el.focus({ preventScroll: true });
    }
  }

  window.addEventListener("hashchange", function () {
    var el = findTarget(location.hash.slice(1));
    if (el) goTo(el, { behavior: smooth(), flash: true });
  });
  doc.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.classList.contains("oy-slot-go")) return;
    var id = a.getAttribute("href").slice(1), el = findTarget(id);
    if (el && location.hash.slice(1) === id) { e.preventDefault(); goTo(el, { behavior: smooth(), flash: true }); }
  });

  var initial = findTarget(location.hash.slice(1));
  if (initial) {
    var moved = false, onMove = function () { moved = true; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) { window.addEventListener(ev, onMove, { passive: true, once: true }); });
    requestAnimationFrame(function () { goTo(initial, { flash: true }); });
    window.addEventListener("load", function () { if (!moved) goTo(initial, {}); });
  }

  /* ---------- hero hand: a category card filters the catalogue ---------- */
  $$(".oy-hand-card").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var sec = findTarget((a.getAttribute("href") || "").slice(1));
      var cat = sec && sec.getAttribute("data-cat");
      if (!cat || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      state.filter = cat; setQuery(""); closeSearch(false);
      var r = apply({ pop: true });
      var chip = $('.oy-chip[data-filter="' + cat + '"]', root);
      if (chip) chipIntoView(chip);
      window.scrollTo({ top: Math.max(0, window.pageYOffset + root.getBoundingClientRect().top - headerH() + 1), behavior: smooth() });
      announce(statusText(r), 60);
    });
  });

  /* ---------- trading-card tilt + foil (mouse only) ---------- */
  if (!reduce && mq("(hover: hover) and (pointer: fine)")) {
    var tc = null, raf = 0, px = 0, py = 0;
    var untilt = function (c) {
      ["--rx", "--ry"].forEach(function (p) { c.style.removeProperty(p); });
      c.classList.remove("is-tilt");
    };
    root.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var c = e.target.closest ? e.target.closest(".oy-card") : null;
      if (c !== tc) { if (tc) untilt(tc); tc = c; }
      if (!c) return;
      px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!tc) return;
        var r = tc.parentNode.getBoundingClientRect();
        var x = Math.min(1, Math.max(0, (px - r.left) / r.width)), y = Math.min(1, Math.max(0, (py - r.top) / r.height));
        tc.style.setProperty("--rx", ((0.5 - y) * 9).toFixed(2) + "deg");
        tc.style.setProperty("--ry", ((x - 0.5) * 11).toFixed(2) + "deg");
        tc.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
        tc.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
        tc.classList.add("is-tilt");
      });
    });
    root.addEventListener("pointerleave", function () { if (tc) untilt(tc); tc = null; });
  }

  /* ---------- "Bana bir oyun seç!" slot machine ---------- */
  var slot = doc.getElementById("oy-slot");
  var triggers = $$("[data-oy-pick]");
  if (slot && triggers.length) {
    var reel = $(".oy-slot-reel", slot), result = $(".oy-slot-result", slot);
    var goBtn = $(".oy-slot-go", slot), againBtn = $(".oy-slot-again", slot);
    var closeBtn = $(".oy-slot-close", slot), askBtn = $(".oy-slot-ask", slot);
    var spinning = false, lastPick = null, chosen = null, picked = null, opener = null;
    var landT = 0, doneT = 0, flickT = 0, flickCard = null, badge = null;
    var rnd = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

    var rowHTML = function (it) {
      return '<li class="oy-reel-row oy-c-' + it.cat + '"><span class="oy-reel-no">' + it.no + '</span><span class="oy-reel-name">' + it.nameHTML + "</span></li>";
    };
    var stopFlicker = function () {
      clearInterval(flickT); flickT = 0;
      if (flickCard) flickCard.classList.remove("is-shuffle");
      flickCard = null;
    };
    var startFlicker = function (pool) {
      var vh = window.innerHeight;
      var vis = pool.filter(function (it) { var r = it.card.getBoundingClientRect(); return r.bottom > 0 && r.top < vh && r.height > 0; });
      if (!vis.length) return;
      flickT = setInterval(function () {
        if (flickCard) flickCard.classList.remove("is-shuffle");
        flickCard = rnd(vis).card;
        flickCard.classList.add("is-shuffle");
      }, 115);
    };
    var setRolling = function (on) { triggers.forEach(function (t) { t.classList.toggle("is-rolling", on); }); };

    var openSlot = function () {
      if (!slot.hidden) return;
      slot.hidden = false;
      if (!reduce) { slot.classList.remove("is-enter"); void slot.offsetWidth; slot.classList.add("is-enter"); }
    };
    var closeSlot = function (restoreFocus) {
      if (slot.hidden) return;
      var hadFocus = slot.contains(doc.activeElement);
      clearTimeout(landT); clearTimeout(doneT);
      stopFlicker(); setRolling(false);
      spinning = false;
      slot.removeAttribute("aria-busy");
      slot.hidden = true;
      if (restoreFocus && hadFocus) {
        if (picked && !picked.li.hidden) picked.card.focus({ preventScroll: true });
        else if (opener && opener.isConnected) opener.focus();
      }
    };

    var pickCard = function (it) {
      ensureVisible(it.card);
      items.forEach(function (x) { x.card.classList.remove("is-picked"); });
      it.card.classList.add("is-picked");
      picked = it;
      if (!badge) {
        badge = doc.createElement("span");
        badge.className = "oy-pick-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "Senin oyunun!";
      }
      it.card.appendChild(badge);
      if (!reduce) { badge.classList.remove("is-pop"); void badge.offsetWidth; badge.classList.add("is-pop"); }
      goTo(it.card, { behavior: smooth() });
      if (!reduce && MV.confetti) {
        setTimeout(function () {
          var r = it.card.getBoundingClientRect();
          if (r.bottom > 0 && r.top < window.innerHeight) MV.confetti(r.left + r.width / 2, r.top + Math.min(r.height / 2, 110), 46);
        }, 800);
      }
    };

    var land = function () {
      spinning = false;
      stopFlicker(); setRolling(false);
      slot.removeAttribute("aria-busy");
      slot.classList.add("is-landed");
      var it = chosen;
      result.innerHTML = "Senin oyunun:<strong>" + it.nameHTML + '</strong><span class="oy-slot-cat oy-c-' + it.cat + '">' + CAT_ONE[it.cat] + " · " + it.no + "</span>";
      goBtn.setAttribute("href", "#" + it.id);
      var wa = MV.waLink ? MV.waLink("Merhaba, " + it.name + " hakkında bilgi almak istiyorum.") : "";
      if (askBtn) {
        askBtn.hidden = !wa;
        if (wa) { askBtn.href = wa; askBtn.target = "_blank"; askBtn.rel = "noopener"; askBtn.setAttribute("aria-label", it.name + " hakkında WhatsApp’tan sor"); }
      }
      announce("Senin oyunun: " + it.name + " (" + CAT_ONE[it.cat] + ", " + it.no + ").", 0);
      doneT = setTimeout(function () { slot.classList.add("is-done"); pickCard(it); }, reduce ? 0 : 650);
    };

    var spin = function () {
      if (spinning) return;
      var pool = items.filter(function (it) { return !it.li.hidden; });
      if (!pool.length) { resetAll(); pool = items.slice(); }
      var choices = pool.length > 1 ? pool.filter(function (it) { return it !== lastPick; }) : pool;
      chosen = lastPick = rnd(choices);

      openSlot();
      clearTimeout(doneT);
      slot.classList.remove("is-landed", "is-done");
      slot.setAttribute("aria-busy", "true");
      result.innerHTML = '<span class="oy-slot-wait">Çark dönüyor…</span>';
      if (askBtn) askBtn.hidden = true;

      var n = reduce ? 3 : 24 + Math.floor(Math.random() * 6), rows = [], prev = null, r;
      for (var i = 0; i < n - 2; i++) {
        var guard = 0;
        do { r = rnd(pool); } while (pool.length > 2 && (r === prev || (r === chosen && i > n - 7)) && guard++ < 12);
        rows.push(r); prev = r;
      }
      rows.push(chosen);
      var after = rnd(pool), g2 = 0;
      while (pool.length > 1 && after === chosen && g2++ < 12) after = rnd(pool);
      rows.push(after);
      reel.innerHTML = rows.map(rowHTML).join("");

      /* offsetHeight ignores the panel's entrance scale; getBoundingClientRect would not */
      var rowH = reel.firstElementChild ? reel.firstElementChild.offsetHeight : 54;
      var dist = (rows.length - 3) * rowH;
      reel.style.transition = "none";
      reel.style.transform = "translateY(0)";
      if (reduce) { reel.style.transform = "translateY(" + (-dist) + "px)"; land(); return; }
      void reel.offsetWidth;
      var dur = Math.round(2000 + Math.random() * 600);
      reel.style.transition = "transform " + dur + "ms cubic-bezier(.12,.7,.14,1)";
      reel.style.transform = "translateY(" + (-dist) + "px)";
      spinning = true;
      setRolling(true);
      startFlicker(pool);
      clearTimeout(landT);
      landT = setTimeout(land, dur + 80);
    };

    triggers.forEach(function (t) {
      t.addEventListener("click", function () {
        opener = t;
        spin();
        if (!slot.contains(doc.activeElement)) slot.focus({ preventScroll: true });
      });
    });
    againBtn.addEventListener("click", spin);
    closeBtn.addEventListener("click", function () { closeSlot(true); });
    goBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (!chosen) return;
      var card = chosen.card;
      closeSlot(false);
      goTo(card, { behavior: smooth(), focus: true });
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !slot.hidden) { e.preventDefault(); closeSlot(true); }
    });
    doc.addEventListener("click", function (e) {
      if (slot.hidden || spinning) return;
      var t = e.target;
      if (!t || !t.isConnected || slot.contains(t) || (t.closest && t.closest("[data-oy-pick]"))) return;
      closeSlot(false);
    });
  }

  /* ---------- Connect photo strip: focusable only when it scrolls (mobile) ---------- */
  var wall = $(".oy-wall");
  if (wall) {
    var fitWall = function () {
      if (wall.scrollWidth > wall.clientWidth + 2) wall.setAttribute("tabindex", "0");
      else wall.removeAttribute("tabindex");
    };
    fitWall();
    window.addEventListener("resize", fitWall);
    window.addEventListener("load", fitWall);
  }

  apply();
  chipFade();
})();
