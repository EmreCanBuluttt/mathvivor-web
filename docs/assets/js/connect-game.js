/* Mathvivor — "Basketbol Connect — Online Isınma Turu": the signature hero mini-game.
   Mounts into every [data-connect-game] element (its fallback content is replaced).
   SEN (red ball) vs ARENA (yellow ball) on a 7×6 Connect-Four board with seven hoops: pick a hoop,
   solve the maths question before the 8-second shot clock runs out and the ball drops into that column.
   Pure DOM + CSS, no libraries, no requests, no globals.
   Storage: localStorage "mv-connect-best" = best streak of correct answers. */
(function () {
  "use strict";
  var hosts = document.querySelectorAll("[data-connect-game]");
  if (!hosts.length) return;

  var COLS = 7, ROWS = 6, YOU = 1, AI = 2;
  var CLOCK_MS = 8000, AI_DELAY = 700, AI_MISS = 0.2;
  var STORE_KEY = "mv-connect-best";
  var CENTER = [0, 1, 2, 3, 2, 1, 0];
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  var NS = "http://www.w3.org/2000/svg";
  var QM = '<b class="cg-qm">?</b>';
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var canAnimate = typeof Element === "function" && typeof Element.prototype.animate === "function";
  var IMG = "assets/img/marka/";
  try {
    if (document.currentScript && document.currentScript.src) IMG = new URL("../img/marka/", document.currentScript.src).href;
  } catch (e) { /* keep the page-relative path */ }
  var uid = 0;

  /* ---------- helpers ---------- */
  function calm() { return !canAnimate || !!(mq && mq.matches); }
  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = list[i];
      list[i] = list[j]; list[j] = t;
    }
    return list;
  }
  function loadBest() {
    try { var v = parseInt(window.localStorage.getItem(STORE_KEY), 10); return v > 0 ? v : 0; } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { window.localStorage.setItem(STORE_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }
  function focusQuiet(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ---------- questions: { html, speech, answer, options[3], long } ---------- */
  function withOptions(q, cands) {
    var seen = {}, picks = [], k;
    seen[q.answer] = true;
    shuffle(cands.slice()).forEach(function (v) {
      if (picks.length < 2 && v >= 0 && v % 1 === 0 && !seen[v]) { seen[v] = true; picks.push(v); }
    });
    for (k = 1; picks.length < 2; k++) {
      [q.answer + k, q.answer - k].forEach(function (v) {
        if (picks.length < 2 && v >= 0 && !seen[v]) { seen[v] = true; picks.push(v); }
      });
    }
    q.options = shuffle([q.answer].concat(picks));
    return q;
  }

  function junior() {
    var a, b, r;
    if (Math.random() < 0.5) {
      a = rand(2, 15); b = rand(2, 20 - a); r = a + b;
      return withOptions({ html: a + " + " + b + " = " + QM, speech: a + " artı " + b + " kaç?", answer: r },
        [r + 1, r - 1, r + 2, r - 2, r + 10, r - 10]);
    }
    a = rand(7, 20); b = rand(2, a - 1); r = a - b;
    return withOptions({ html: a + " − " + b + " = " + QM, speech: a + " eksi " + b + " kaç?", answer: r },
      [r + 1, r - 1, r + 2, r - 2, a + b, r + 10]);
  }

  function pro() {
    var k = Math.random(), a, b, p, r;
    if (k < 0.4) {
      a = rand(3, 9); b = rand(3, 9); p = a * b;
      return withOptions({ html: a + " × " + b + " = " + QM, speech: a + " çarpı " + b + " kaç?", answer: p },
        [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, p + 1, p - 1, p + 10]);
    }
    if (k < 0.56) {
      a = rand(3, 9); b = rand(3, 9); p = a * b;
      return withOptions({ html: p + " ÷ " + a + " = " + QM, speech: p + " bölü " + a + " kaç?", answer: b },
        [b + 1, b - 1, b + 2, b - 2, a === b ? b + 3 : a]);
    }
    if (k < 0.78) {
      a = rand(13, 69); b = rand(11, 98 - a); r = a + b;
      return withOptions({ html: a + " + " + b + " = " + QM, speech: a + " artı " + b + " kaç?", answer: r },
        [r + 10, r - 10, r + 1, r - 1, r + 11, r - 9]);
    }
    a = rand(41, 98); b = rand(12, a - 12); r = a - b;
    return withOptions({ html: a + " − " + b + " = " + QM, speech: a + " eksi " + b + " kaç?", answer: r },
      [r + 10, r - 10, r + 1, r - 1, r + 2]);
  }

  function allstar() {
    var k = Math.random(), t = rand(0, 3), a, b, c, p, r, n, pct, suf;
    if (k < 0.36) { /* order of operations: the trap is reading left to right */
      if (t === 0) {
        a = rand(2, 12); b = rand(2, 9); c = rand(2, 9); r = a + b * c;
        return withOptions({ html: a + " + " + b + " × " + c + " = " + QM, speech: a + " artı " + b + " çarpı " + c + " kaç?", answer: r },
          [(a + b) * c, r + 1, r - 1, r + 2, r - 2]);
      }
      if (t === 1) {
        b = rand(2, 6); c = rand(2, 6); a = rand(b * c + 2, b * c + 20); r = a - b * c;
        return withOptions({ html: a + " − " + b + " × " + c + " = " + QM, speech: a + " eksi " + b + " çarpı " + c + " kaç?", answer: r },
          [(a - b) * c, r + 1, r - 1, r + 2, r + 10]);
      }
      if (t === 2) {
        a = rand(2, 9); b = rand(2, 9); c = rand(2, 6); r = (a + b) * c;
        return withOptions({ html: "(" + a + " + " + b + ") × " + c + " = " + QM, speech: "parantez içinde " + a + " artı " + b + ", çarpı " + c + " kaç?", answer: r },
          [a + b * c, r + c, r - c, r + 1, r - 1]);
      }
      c = rand(2, 6); n = rand(2, 9); b = c * n; a = c * rand(1, 4); r = a + n;
      return withOptions({ html: a + " + " + b + " ÷ " + c + " = " + QM, speech: a + " artı " + b + " bölü " + c + " kaç?", answer: r },
        [(a + b) / c, r + 1, r - 1, r + 2, a + b]);
    }
    if (k < 0.7) { /* missing number */
      a = rand(3, 9); b = rand(3, 9); p = a * b;
      if (t === 0) {
        return withOptions({ html: QM + " × " + b + " = " + p, speech: "Kaç çarpı " + b + ", " + p + " eder?", answer: a },
          [a + 1, a - 1, a + 2, a === b ? a - 2 : b]);
      }
      if (t === 1) {
        return withOptions({ html: a + " × " + QM + " = " + p, speech: a + " çarpı kaç, " + p + " eder?", answer: b },
          [b + 1, b - 1, b + 2, a === b ? b - 2 : a]);
      }
      if (t === 2) {
        return withOptions({ html: p + " ÷ " + QM + " = " + b, speech: p + " bölü kaç, " + b + " eder?", answer: a },
          [a + 1, a - 1, a + 2, a === b ? a - 2 : b]);
      }
      a = rand(12, 48); b = rand(13, 49); p = a + b;
      return withOptions({ html: QM + " + " + b + " = " + p, speech: "Kaç artı " + b + ", " + p + " eder?", answer: a },
        [a + 10, a - 10, a + 1, a - 1, a + 2]);
    }
    /* percentages: %10, %25, %50 of a friendly number */
    pct = [10, 25, 50][rand(0, 2)];
    n = pct === 10 ? 10 * rand(2, 20) : pct === 25 ? 4 * rand(5, 30) : 2 * rand(6, 60);
    r = n * pct / 100;
    suf = pct === 10 ? "'u" : pct === 25 ? "'i" : "'si";
    return withOptions({
      html: "<small>" + n + " sayısının</small> %" + pct + suf + " = " + QM,
      speech: n + " sayısının yüzde " + pct + suf + " kaç?", answer: r, long: true
    }, [n / 2, n / 4, n / 10, r * 2, r / 2, r + 5, r - 5, r + 1]);
  }

  var LEVELS = {
    junior: { label: "Junior", desc: "Toplama ve çıkarma (0–20)", make: junior },
    pro: { label: "Pro", desc: "Çarpım tablosu, iki basamaklı toplama ve çıkarma", make: pro },
    allstar: { label: "All-Star", desc: "İşlem önceliği, eksik sayı, %10 · %25 · %50", make: allstar }
  };

  /* ---------- the board's front face (wood frame + navy panel with 42 holes) ---------- */
  function faceSVG(id) {
    var holes = "", shades = "", lips = "", grain = "", r, c, x, y, i;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        x = 70 + 100 * c; y = 72 + 100 * r;
        holes += "M" + (x - 39) + " " + y + "a39 39 0 1 0 78 0a39 39 0 1 0-78 0z";
        shades += '<circle cx="' + x + '" cy="' + y + '" r="39.5"/>';
        lips += '<circle cx="' + x + '" cy="' + y + '" r="41.5"/>';
      }
    }
    for (i = 0; i < 3; i++) {
      grain += '<path d="M8 ' + (5 + i * 5) + "C180 " + (3 + i * 6) + " 380 " + (9 + i * 3) + " 732 " + (6 + i * 5) + '"/>';
      grain += '<path d="M8 ' + (628 + i * 8) + "C200 " + (624 + i * 9) + " 520 " + (634 + i * 7) + " 732 " + (627 + i * 9) + '"/>';
      grain += '<path d="M' + (5 + i * 5) + " 24C" + (3 + i * 6) + " 200 " + (9 + i * 3) + " 420 " + (6 + i * 5) + ' 620"/>';
      grain += '<path d="M' + (725 + i * 5) + " 24C" + (728 + i * 4) + " 260 " + (722 + i * 6) + " 470 " + (726 + i * 5) + ' 620"/>';
    }
    var panel = "M20 22H720V622H20Z" + holes;
    return '<svg class="cg-face" viewBox="0 0 740 656" preserveAspectRatio="none" focusable="false" aria-hidden="true">' +
      "<defs>" +
        '<linearGradient id="' + id + '-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2ad6c"/><stop offset=".45" stop-color="#bd7a3f"/><stop offset="1" stop-color="#874a1e"/></linearGradient>' +
        '<linearGradient id="' + id + '-panel" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#22437f"/><stop offset=".55" stop-color="#142c5e"/><stop offset="1" stop-color="#0b1a3e"/></linearGradient>' +
        '<linearGradient id="' + id + '-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>' +
        '<radialGradient id="' + id + '-hole" cx=".5" cy=".5" r=".5" fx=".5" fy=".68"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".42"/><stop offset="1" stop-color="#000" stop-opacity=".82"/></radialGradient>' +
        '<radialGradient id="' + id + '-bolt" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff3d1"/><stop offset=".5" stop-color="#c9a15a"/><stop offset="1" stop-color="#5c3d12"/></radialGradient>' +
      "</defs>" +
      '<path fill="url(#' + id + '-wood)" fill-rule="evenodd" d="M14 0H726A14 14 0 0 1 740 14V642A14 14 0 0 1 726 656H14A14 14 0 0 1 0 642V14A14 14 0 0 1 14 0ZM20 22V622H720V22Z"/>' +
      '<g class="cg-grain" fill="none">' + grain + "</g>" +
      '<path d="M1.5 14A12.5 12.5 0 0 1 14 1.5H726A12.5 12.5 0 0 1 738.5 14" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>' +
      '<path fill="url(#' + id + '-panel)" fill-rule="evenodd" d="' + panel + '"/>' +
      '<path fill="url(#' + id + '-sheen)" fill-rule="evenodd" d="' + panel + '"/>' +
      '<g fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="3">' + lips + "</g>" +
      '<g fill="url(#' + id + '-hole)">' + shades + "</g>" +
      '<rect x="21.5" y="23.5" width="697" height="597" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3"/>' +
      '<g fill="url(#' + id + '-bolt)"><circle cx="10" cy="11" r="4.2"/><circle cx="730" cy="11" r="4.2"/><circle cx="14" cy="639" r="4.6"/><circle cx="726" cy="639" r="4.6"/></g>' +
      '<text class="cg-brand cg-brand--lit" x="370" y="647.5" text-anchor="middle">BASKETBOL CONNECT</text>' +
      '<text class="cg-brand" x="370" y="646" text-anchor="middle">BASKETBOL CONNECT</text>' +
      "</svg>";
  }

  var ICON_NEW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.35-5.66M20 4.5v5h-5"/></svg>';
  var ICON_HELP = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.2"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 4"/><path d="M12 17.6v.1"/></svg>';

  /* =====================================================================
     Game
     ===================================================================== */
  function Game(host) {
    this.host = host;
    this.id = "cg" + (++uid);
    this.level = "junior";
    this.wins = [0, 0, 0];
    this.streak = 0;
    this.best = loadBest();
    this.prevBest = this.best;
    this.cursor = 3;
    this.token = 0;
    this.timers = [];
    this.anims = [];
    this.raf = 0;
    this.phase = "pick";
    this.visible = true;
    this.build();
    this.bind();
    this.watch();
    this.setLevel("junior", true);
    this.newMatch(null);
    this.attract();
  }
  var G = Game.prototype;

  /* pause the idle loops (attract mode, bobbing ghost, spinning target) while the board is off screen */
  G.watch = function () {
    if (!("IntersectionObserver" in window)) return;
    var self = this;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        self.visible = e.isIntersecting;
        self.root.classList.toggle("is-off", !e.isIntersecting);
      });
    }).observe(this.root);
  };

  /* idle "attract mode": the ghost ball drifts over a few hoops until the first interaction */
  G.attract = function () {
    if (calm()) return;
    var self = this, seq = [3, 2, 4, 1, 5, 3, 4], i = 0;
    this.attracting = true;
    var step = function () {
      if (!self.attracting) return;
      if (self.phase === "pick" && self.visible) self.setPreview(seq[i++ % seq.length], YOU);
      self.attractT = setTimeout(step, 1150);
    };
    this.attractT = setTimeout(step, 600);
  };
  G.stopAttract = function () {
    if (!this.attracting) return;
    this.attracting = false;
    clearTimeout(this.attractT);
    if (this.phase === "pick") this.setPreview(this.colsEl.contains(document.activeElement) ? this.cursor : null, YOU);
  };

  G.build = function () {
    var id = this.id, c, hoops = "", cols = "", chips = "", answers = "";
    for (c = 0; c < COLS; c++) {
      hoops += '<div class="cg-hoop"><i class="cg-rimb"></i><i class="cg-net"></i><i class="cg-rimf"></i></div>';
      cols += '<button type="button" class="cg-col" data-col="' + c + '" tabindex="-1"></button>';
    }
    Object.keys(LEVELS).forEach(function (k) {
      chips += '<button type="button" class="cg-chip" data-level="' + k + '" aria-pressed="false"><span lang="en">' + LEVELS[k].label + "</span></button>";
    });
    for (c = 0; c < 3; c++) answers += '<button type="button" class="cg-a" data-i="' + c + '"><span class="cg-av"></span><kbd class="cg-key" aria-hidden="true">' + (c + 1) + "</kbd></button>";

    var html =
      '<div class="cg" role="region" aria-label="Basketbol Connect — Online Isınma Turu">' +
        '<div class="cg-stage" data-turn="you">' +
          '<div class="cg-play">' +
            '<div class="cg-bb" aria-hidden="true"></div>' +
            '<div class="cg-head">' +
              '<span class="cg-plate"><img src="' + IMG + 'logo-160.png" srcset="' + IMG + "logo-160.png 160w, " + IMG + 'logo-320.png 320w" sizes="80px" width="160" height="126" alt="" decoding="async"></span>' +
              '<div class="cg-led">' +
                '<p class="sr-only" data-sr-score></p>' +
                '<div class="cg-team cg-team--you" aria-hidden="true"><span class="cg-tname"><i class="cg-skin is-you"></i>Sen</span><span class="cg-dig"><b data-s1>0</b></span></div>' +
                '<div class="cg-mid" aria-hidden="true">' +
                  '<span class="cg-poss"><i></i><i></i></span>' +
                  '<span class="cg-mini">Seri <b data-streak>0</b></span>' +
                  '<span class="cg-mini">Rekor <b data-best>0</b></span>' +
                "</div>" +
                '<div class="cg-team cg-team--ai" aria-hidden="true"><span class="cg-dig"><b data-s2>0</b></span><span class="cg-tname">Arena<i class="cg-skin is-ai"></i></span></div>' +
              "</div>" +
            "</div>" +
            '<div class="cg-hz" aria-hidden="true">' +
              '<div class="cg-hoops">' + hoops + "</div>" +
              '<i class="cg-ghost"><i class="cg-skin is-you"></i></i>' +
            "</div>" +
            '<div class="cg-rack" aria-hidden="true">' +
              '<div class="cg-well"><i class="cg-glow"></i></div>' +
              '<div class="cg-balls"></div>' +
              faceSVG(id) +
              '<svg class="cg-marks" viewBox="0 0 700 600" focusable="false" aria-hidden="true"><circle class="cg-target" cx="350" cy="550" r="45"/><g class="cg-win"></g></svg>' +
            "</div>" +
            '<div class="cg-cols" role="toolbar" aria-label="Potalar: bir sütun seç">' + cols + "</div>" +
            '<div class="cg-fx" aria-hidden="true"><span class="cg-pop"></span></div>' +
          "</div>" +
          '<div class="cg-court"><p class="cg-status" role="status" aria-live="polite" aria-atomic="true"></p></div>' +
          '<div class="cg-flashes" aria-hidden="true"></div>' +
          '<div class="cg-q" hidden>' +
            '<div class="cg-card" role="dialog" aria-modal="false" aria-labelledby="' + id + '-qt" aria-describedby="' + id + '-qx">' +
              '<div class="cg-qtop">' +
                '<div class="cg-qhead"><p class="cg-qt" id="' + id + '-qt">Atış hakkı için çöz</p><span class="cg-qcol" data-qcol></span></div>' +
                '<span class="cg-clock" aria-hidden="true"><b data-clock>8</b></span>' +
              "</div>" +
              '<p class="cg-qx" id="' + id + '-qx"><span class="cg-qv" aria-hidden="true" data-qv></span><span class="sr-only" data-qs></span></p>' +
              '<div class="cg-ans" role="group" aria-label="Cevaplar">' + answers + "</div>" +
              '<div class="cg-qfoot"><button type="button" class="cg-cancel" data-cancel>Vazgeç <kbd lang="en">Esc</kbd></button></div>' +
              '<div class="cg-bar" aria-hidden="true"><i data-bar></i></div>' +
            "</div>" +
          "</div>" +
          '<div class="cg-banner" hidden>' +
            '<p class="cg-bt" data-bt></p>' +
            '<p class="cg-bs" data-bs></p>' +
            '<button type="button" class="cg-bbtn" data-again>' + ICON_NEW + "<span data-again-label>Yeni Maç</span></button>" +
          "</div>" +
        "</div>" +
        '<div class="cg-ctrl">' +
          '<div class="cg-lv"><span class="cg-lvlabel" id="' + id + '-lv">Seviye</span><div class="cg-levels" role="group" aria-labelledby="' + id + '-lv">' + chips + "</div></div>" +
          '<p class="cg-lvdesc" data-lvdesc></p>' +
          '<div class="cg-acts">' +
            '<button type="button" class="cg-btn" data-new>' + ICON_NEW + "<span>Yeni Maç</span></button>" +
            '<button type="button" class="cg-btn" data-help aria-expanded="false" aria-controls="' + id + '-help">' + ICON_HELP + "<span>Nasıl oynanır?</span></button>" +
          "</div>" +
        "</div>" +
        '<ol class="cg-help" id="' + id + '-help" hidden>' +
          "<li><b>Potanı seç.</b> Bir potaya dokun ya da tıkla; klavyede <kbd>←</kbd> <kbd>→</kbd> ile gez, <kbd lang=\"en\">Enter</kbd> ile seç.</li>" +
          "<li><b>Atış hakkı için çöz.</b> Soruyu 8 saniyede doğru cevapla: top potadan geçip o sütunda en alttaki boş deliğe düşer.</li>" +
          "<li><b>Dördü yan yana getir.</b> Yatay, dikey ya da çapraz dört top: <span lang=\"en\">CONNECT!</span> Arena da aynısını deniyor.</li>" +
        "</ol>" +
      "</div>";

    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var root = wrap.firstChild, q = function (s) { return root.querySelector(s); }, qa = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
    this.root = root;
    this.stage = q(".cg-stage");
    this.play = q(".cg-play");
    this.rack = q(".cg-rack");
    this.balls = q(".cg-balls");
    this.glow = q(".cg-glow");
    this.target = q(".cg-target");
    this.winG = q(".cg-win");
    this.ghost = q(".cg-ghost");
    this.ghostSkin = this.ghost.firstChild;
    this.hoopEls = qa(".cg-hoop");
    this.rimEls = qa(".cg-rimb");
    this.colsEl = q(".cg-cols");
    this.colEls = qa(".cg-col");
    this.pop = q(".cg-pop");
    this.flashes = q(".cg-flashes");
    this.status = q(".cg-status");
    this.qwrap = q(".cg-q");
    this.card = q(".cg-card");
    this.qv = q("[data-qv]");
    this.qs = q("[data-qs]");
    this.qx = q(".cg-qx");
    this.qcolEl = q("[data-qcol]");
    this.clockEl = q("[data-clock]");
    this.bar = q("[data-bar]");
    this.ansEls = qa(".cg-a");
    this.cancelEl = q("[data-cancel]");
    this.banner = q(".cg-banner");
    this.bt = q("[data-bt]");
    this.bs = q("[data-bs]");
    this.again = q("[data-again]");
    this.againLabel = q("[data-again-label]");
    this.s1 = q("[data-s1]");
    this.s2 = q("[data-s2]");
    this.streakEl = q("[data-streak]");
    this.bestEl = q("[data-best]");
    this.srScore = q("[data-sr-score]");
    this.chipEls = qa(".cg-chip");
    this.lvdesc = q("[data-lvdesc]");
    this.newBtn = q("[data-new]");
    this.helpBtn = q("[data-help]");
    this.help = q(".cg-help");

    this.host.textContent = "";
    this.host.appendChild(root);
    this.host.classList.add("cg-host");
  };

  G.bind = function () {
    var self = this;
    var colOf = function (e) { var b = e.target.closest ? e.target.closest(".cg-col") : null; return b ? +b.getAttribute("data-col") : -1; };

    ["pointerdown", "keydown", "focusin"].forEach(function (type) {
      self.root.addEventListener(type, function () { self.stopAttract(); }, true);
    });
    this.colsEl.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") self.stopAttract(); });
    this.colsEl.addEventListener("click", function (e) { var c = colOf(e); if (c >= 0) self.pick(c); });
    this.colsEl.addEventListener("keydown", function (e) { self.colKey(e); });
    this.colsEl.addEventListener("focusin", function (e) {
      var c = colOf(e); if (c < 0) return;
      self.cursor = c; self.syncCols();
      if (self.phase === "pick") self.setPreview(c, YOU);
    });
    this.colsEl.addEventListener("focusout", function (e) {
      if (self.phase === "pick" && !self.colsEl.contains(e.relatedTarget)) self.setPreview(null);
    });
    this.colsEl.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || self.phase !== "pick") return;
      var c = colOf(e); if (c >= 0 && c !== self.previewCol) self.setPreview(c, YOU);
    });
    this.colsEl.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse" || self.phase !== "pick") return;
      self.setPreview(self.colsEl.contains(document.activeElement) ? self.cursor : null, YOU);
    });

    this.ansEls.forEach(function (b) {
      b.addEventListener("click", function () { if (b.getAttribute("aria-disabled") !== "true") self.answer(+b.getAttribute("data-v")); });
    });
    this.card.addEventListener("keydown", function (e) { self.cardKey(e); });
    this.cancelEl.addEventListener("click", function () { self.cancel(); });
    this.root.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && self.phase === "question") { e.preventDefault(); self.cancel(); }
    });

    this.again.addEventListener("click", function () {
      self.newMatch(self.lastWinner === AI ? "Rövanş başladı — sıra sende!" : "Yeni maç — sıra sende!");
      self.focusCol();
    });
    this.newBtn.addEventListener("click", function () { self.newMatch("Yeni maç — sıra sende!"); });
    this.helpBtn.addEventListener("click", function () {
      var open = self.helpBtn.getAttribute("aria-expanded") !== "true";
      self.helpBtn.setAttribute("aria-expanded", String(open));
      self.help.hidden = !open;
    });
    this.chipEls.forEach(function (b) {
      b.addEventListener("click", function () { self.setLevel(b.getAttribute("data-level")); });
    });
    document.addEventListener("visibilitychange", function () {
      if (self.phase !== "question" || self.locked) return;
      if (document.hidden) self.pauseClock(); else if (self.paused) self.resumeClock();
    });
  };

  /* ---------- timers & animations that die with the match ---------- */
  G.later = function (ms, fn) {
    var self = this, t = this.token;
    this.timers.push(setTimeout(function () { if (t === self.token) fn(); }, ms));
  };
  G.track = function (anim) { this.anims.push(anim); return anim; };

  G.reset = function () {
    this.token++;
    this.timers.forEach(clearTimeout); this.timers = [];
    this.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* already gone */ } }); this.anims = [];
    this.stopClock();
    Array.prototype.forEach.call(this.play.querySelectorAll(".cg-fly"), function (f) { f.remove(); });
    this.flashes.textContent = "";
    this.stage.classList.remove("is-roar");
    this.rack.classList.remove("is-thud");
    this.pop.className = "cg-pop";
    this.hoopEls.forEach(function (h) { h.classList.remove("is-shake", "is-swish"); });
    var hadFocus = this.qwrap.contains(document.activeElement) || this.banner.contains(document.activeElement);
    this.qwrap.hidden = true;
    this.banner.hidden = true;
    this.play.inert = false; this.play.removeAttribute("aria-hidden");
    this.locked = false; this.q = null;
    if (hadFocus) this.focusCol();
  };

  G.newMatch = function (msg) {
    this.reset();
    this.board = [];
    for (var r = 0; r < ROWS; r++) this.board.push([0, 0, 0, 0, 0, 0, 0]);
    this.balls.textContent = "";
    this.winG.textContent = "";
    this.rack.classList.remove("is-over");
    this.phase = "pick";
    this.setTurn(YOU);
    this.setPreview(this.colsEl.contains(document.activeElement) ? this.cursor : null, YOU);
    this.syncCols();
    this.renderScore();
    this.say(msg || "Sıra sende — bir pota seç!");
  };

  G.setLevel = function (k, quiet) {
    if (!LEVELS[k]) return;
    var changed = k !== this.level;
    this.level = k;
    this.chipEls.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === k)); });
    this.lvdesc.textContent = LEVELS[k].desc;
    if (quiet || !changed) return;
    this.wins = [0, 0, 0];
    this.streak = 0;
    this.prevBest = this.best;
    this.newMatch("Seviye: " + LEVELS[k].label + ". Yeni maç — sıra sende!");
  };

  /* ---------- state helpers ---------- */
  G.dropRow = function (c) {
    for (var r = ROWS - 1; r >= 0; r--) if (!this.board[r][c]) return r;
    return -1;
  };
  G.isFull = function () { return this.board[0].every(function (v) { return v; }); };

  G.findWin = function (r, c, p) {
    var B = this.board, i, k, rr, cc;
    for (i = 0; i < 4; i++) {
      var dr = DIRS[i][0], dc = DIRS[i][1], cells = [[r, c]];
      for (k = 1; ; k++) {
        rr = r - dr * k; cc = c - dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || B[rr][cc] !== p) break;
        cells.unshift([rr, cc]);
      }
      for (k = 1; ; k++) {
        rr = r + dr * k; cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || B[rr][cc] !== p) break;
        cells.push([rr, cc]);
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  };

  G.wouldWin = function (c, p) {
    var r = this.dropRow(c);
    if (r < 0) return false;
    this.board[r][c] = p;
    var w = !!this.findWin(r, c, p);
    this.board[r][c] = 0;
    return w;
  };

  /* value of the four-cell windows through an empty (r, c) for ARENA: own chances + blocking SEN */
  G.windowScore = function (r, c) {
    var B = this.board, s = 0, i, k, j;
    for (i = 0; i < 4; i++) {
      var dr = DIRS[i][0], dc = DIRS[i][1];
      for (k = -3; k <= 0; k++) {
        var mine = 0, theirs = 0, ok = true;
        for (j = 0; j < 4; j++) {
          var rr = r + dr * (k + j), cc = c + dc * (k + j);
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) { ok = false; break; }
          if (B[rr][cc] === AI) mine++; else if (B[rr][cc] === YOU) theirs++;
        }
        if (!ok) continue;
        if (!theirs) s += [1, 2, 6, 50][mine];
        if (!mine) s += [0, 1, 4, 40][theirs] * 0.8;
      }
    }
    return s;
  };

  /* ARENA's heuristic: win if possible, block SEN's win, prefer the centre, never set up SEN's win */
  G.aiChoose = function () {
    var self = this, valid = [], c, best = -Infinity, choice = 3;
    for (c = 0; c < COLS; c++) if (this.dropRow(c) >= 0) valid.push(c);
    for (c = 0; c < valid.length; c++) if (this.wouldWin(valid[c], AI)) return valid[c];
    for (c = 0; c < valid.length; c++) if (this.wouldWin(valid[c], YOU)) return valid[c];
    valid.forEach(function (col) {
      var r = self.dropRow(col), s = CENTER[col] * 3 + Math.random() * 2.5 + self.windowScore(r, col);
      if (r > 0) {
        self.board[r][col] = AI;
        self.board[r - 1][col] = YOU;
        if (self.findWin(r - 1, col, YOU)) s -= 100;
        self.board[r - 1][col] = AI;
        if (self.findWin(r - 1, col, AI)) s -= 8;
        self.board[r - 1][col] = 0;
        self.board[r][col] = 0;
      }
      if (s > best) { best = s; choice = col; }
    });
    return choice;
  };

  /* ---------- view sync ---------- */
  G.say = function (msg) { this.status.textContent = msg; };

  G.setTurn = function (who) {
    this.turn = who;
    this.stage.setAttribute("data-turn", who === YOU ? "you" : who === AI ? "ai" : "over");
  };

  G.syncCols = function () {
    var active = this.phase === "pick", self = this;
    this.colEls.forEach(function (b, c) {
      var free = self.dropRow(c) + 1, stack = [], r;
      for (r = ROWS - 1; r >= 0; r--) if (self.board[r][c]) stack.push(self.board[r][c] === YOU ? "Sen" : "Arena");
      b.setAttribute("aria-label", (c + 1) + ". pota" + (free ? ", " + free + " boş delik" : ", dolu") + (stack.length ? "; alttan: " + stack.join(", ") : ""));
      b.setAttribute("aria-disabled", active && free ? "false" : "true");
      b.tabIndex = c === self.cursor ? 0 : -1;
    });
  };

  G.focusCol = function () { focusQuiet(this.colEls[this.cursor]); };

  G.renderScore = function () {
    this.s1.textContent = this.wins[YOU];
    this.s2.textContent = this.wins[AI];
    this.streakEl.textContent = this.streak;
    this.streakEl.parentNode.classList.toggle("is-hot", this.streak >= 3);
    this.bestEl.textContent = this.best;
    this.srScore.textContent = "Skor: Sen " + this.wins[YOU] + ", Arena " + this.wins[AI] + ". Doğru cevap serisi " + this.streak + ", rekor " + this.best + ".";
  };

  G.bump = function (el) { if (!calm()) restart(el, "is-bump"); };

  G.setPreview = function (c, who) {
    var on = c != null && c >= 0;
    this.previewCol = on ? c : null;
    this.ghost.classList.toggle("is-on", on);
    this.glow.classList.toggle("is-on", on);
    if (!on) { this.target.setAttribute("class", "cg-target"); return; }
    var skin = who === AI ? "is-ai" : "is-you", r = this.dropRow(c);
    this.ghost.style.setProperty("--c", c);
    this.glow.style.setProperty("--c", c);
    this.ghostSkin.className = "cg-skin " + skin;
    this.glow.setAttribute("data-p", skin);
    if (r >= 0) {
      this.target.setAttribute("cx", 50 + 100 * c);
      this.target.setAttribute("cy", 50 + 100 * r);
      this.target.setAttribute("class", "cg-target is-on " + skin);
    } else {
      this.target.setAttribute("class", "cg-target");
    }
  };

  /* ---------- keyboard ---------- */
  G.colKey = function (e) {
    var k = e.key, c = this.cursor;
    if (k === "ArrowLeft") c = (c + COLS - 1) % COLS;
    else if (k === "ArrowRight") c = (c + 1) % COLS;
    else if (k === "Home") c = 0;
    else if (k === "End") c = COLS - 1;
    else if (/^[1-7]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.cursor = +k - 1; this.syncCols(); this.focusCol();
      this.pick(this.cursor);
      return;
    } else return;
    e.preventDefault();
    this.cursor = c;
    this.syncCols();
    this.focusCol();
  };

  G.cardKey = function (e) {
    var list = this.ansEls.concat([this.cancelEl]), i = list.indexOf(document.activeElement), k = e.key;
    if (/^[1-3]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.ansEls[+k - 1].click();
    } else if ((k === "ArrowRight" || k === "ArrowLeft") && i >= 0 && i < 3) {
      e.preventDefault();
      focusQuiet(this.ansEls[(i + (k === "ArrowRight" ? 1 : 2)) % 3]);
    } else if (k === "Tab") {
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusQuiet(list[list.length - 1]); }
      else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); focusQuiet(list[0]); }
    }
  };

  /* ---------- your turn: pick → question → shot ---------- */
  G.pick = function (c) {
    if (this.phase !== "pick" || c < 0 || c >= COLS) return;
    this.cursor = c;
    this.syncCols();
    if (this.dropRow(c) < 0) {
      this.say((c + 1) + ". pota dolu — başka bir pota seç.");
      this.fx(c, "is-shake", 560);
      return;
    }
    this.openQuestion(c);
  };

  G.openQuestion = function (c) {
    var q = LEVELS[this.level].make();
    this.q = q;
    this.qcol = c;
    this.phase = "question";
    this.locked = false;
    this.setPreview(c, YOU);
    this.qv.innerHTML = q.html;
    this.qs.textContent = q.speech;
    this.qx.classList.toggle("is-long", !!q.long);
    this.qcolEl.textContent = (c + 1) + ". pota";
    this.ansEls.forEach(function (b, i) {
      b.firstChild.textContent = q.options[i];
      b.setAttribute("data-v", q.options[i]);
      b.className = "cg-a";
      b.removeAttribute("aria-disabled");
    });
    this.card.classList.remove("is-low");
    this.qwrap.hidden = false;
    this.syncCols();
    focusQuiet(this.ansEls[0]);
    this.play.inert = true;
    this.play.setAttribute("aria-hidden", "true");
    this.say((c + 1) + ". pota — atış hakkı için 8 saniyen var!");
    this.startClock();
  };

  G.startClock = function () { this.left = CLOCK_MS; this.lastS = -1; this.resumeClock(); };
  G.resumeClock = function () {
    var self = this;
    this.paused = false;
    this.from = performance.now();
    if (this.raf) cancelAnimationFrame(this.raf);
    var step = function (now) {
      var left = Math.max(0, self.left - (now - self.from));
      self.drawClock(left);
      if (left <= 0) { self.raf = 0; self.left = 0; self.answer(null); return; }
      self.raf = requestAnimationFrame(step);
    };
    this.drawClock(this.left);
    this.raf = requestAnimationFrame(step);
  };
  G.pauseClock = function () {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.left = Math.max(0, this.left - (performance.now() - this.from));
    this.paused = true;
  };
  G.stopClock = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.paused = false;
  };
  G.drawClock = function (left) {
    var s = Math.ceil(left / 1000);
    if (s !== this.lastS) { this.clockEl.textContent = s; this.lastS = s; }
    this.bar.style.transform = "scaleX(" + (left / CLOCK_MS).toFixed(4) + ")";
    this.card.classList.toggle("is-low", left <= 3000);
  };

  G.answer = function (v) {
    if (this.phase !== "question" || this.locked || !this.q) return;
    this.locked = true;
    this.stopClock();
    var self = this, q = this.q, c = this.qcol, ok = v === q.answer, msg;
    this.ansEls.forEach(function (b) {
      var bv = +b.getAttribute("data-v");
      b.setAttribute("aria-disabled", "true");
      b.classList.add(bv === q.answer ? "is-right" : bv === v ? "is-wrong" : "is-dim");
    });
    if (ok) {
      this.streak++;
      msg = "Doğru! Atış hakkı kazandın.";
      if (this.streak > this.best) {
        this.best = this.streak;
        saveBest(this.best);
        if (this.prevBest > 0 && this.streak === this.prevBest + 1) msg += " Yeni seri rekoru!";
        this.bump(this.bestEl);
      }
      if (this.streak === 3) msg += " Üst üste 3 doğru, seri alev aldı!";
      else if (this.streak > 3 && this.streak % 5 === 0) msg += " Üst üste " + this.streak + " doğru, durdurulamıyorsun!";
      this.bump(this.streakEl);
    } else {
      this.streak = 0;
      this.prevBest = this.best;
      msg = (v === null ? "Süre doldu! " : "Yanlış! ") + "Doğru cevap: " + q.answer + ".";
    }
    this.renderScore();
    this.say(msg);
    this.later(ok ? 480 : 1050, function () {
      self.closeQuestion();
      self.shoot(YOU, c, ok);
    });
  };

  G.closeQuestion = function () {
    var had = this.qwrap.contains(document.activeElement) || document.activeElement === document.body;
    this.qwrap.hidden = true;
    this.play.inert = false;
    this.play.removeAttribute("aria-hidden");
    this.locked = false;
    if (had) this.focusCol();
  };

  G.cancel = function () {
    if (this.phase !== "question" || this.locked) return;
    this.stopClock();
    this.phase = "pick";
    this.q = null;
    this.closeQuestion();
    this.syncCols();
    this.setPreview(this.cursor, YOU);
    this.say("Atış iptal — başka bir pota seçebilirsin.");
  };

  /* ---------- shooting ---------- */
  G.geo = function (c) {
    var P = this.play.getBoundingClientRect(), B = this.balls.getBoundingClientRect(),
        S = this.stage.getBoundingClientRect(), R = this.rimEls[c].getBoundingClientRect(), cell = B.width / COLS;
    return {
      w: P.width, cell: cell, d: cell * 0.74,
      rimX: R.left + R.width / 2 - P.left, rimY: R.top + R.height / 2 - P.top, rimW: R.width,
      gy: B.top - P.top, bottom: S.bottom - P.top
    };
  };

  /* projectile frames: x linear in time, y a parabola whose top is at `apex` */
  function arc(x0, y0, x1, y1, apex, d, o0, o1, s0, s1, r0, r1) {
    var D = y1 - y0, K = Math.max(y0 - apex, -D, 0), A = D + 2 * K + 2 * Math.sqrt(Math.max(0, K * (K + D))), B = D - A,
        out = [], n = 18, i, t, x, y;
    for (i = 0; i <= n; i++) {
      t = i / n; x = x0 + (x1 - x0) * t; y = y0 + B * t + A * t * t;
      out.push({
        transform: "translate(" + (x - d / 2).toFixed(1) + "px," + (y - d / 2).toFixed(1) + "px) rotate(" + (r0 + (r1 - r0) * t).toFixed(0) + "deg) scale(" + (s0 + (s1 - s0) * t).toFixed(3) + ")",
        opacity: 1, offset: o0 + (o1 - o0) * t
      });
    }
    return out;
  }

  function dropFrames(dy0, cell) {
    var out = [], n = 10, i, t;
    for (i = 0; i <= n; i++) {
      t = i / n;
      out.push({ transform: "translate3d(0," + (dy0 * (1 - t * t)).toFixed(1) + "px,0) scale(1,1)", offset: 0.72 * t });
    }
    out[n].transform = "translate3d(0,0,0) scale(1.08,.9)";
    out.push({ transform: "translate3d(0," + (-cell * 0.16).toFixed(1) + "px,0) scale(.97,1.04)", offset: 0.85 });
    out.push({ transform: "translate3d(0,0,0) scale(1.03,.96)", offset: 0.93 });
    out.push({ transform: "translate3d(0," + (-cell * 0.035).toFixed(1) + "px,0) scale(1,1)", offset: 0.965 });
    out.push({ transform: "translate3d(0,0,0) scale(1,1)", offset: 1 });
    return out;
  }

  G.shoot = function (who, c, make) {
    var self = this, t = this.token, row = make ? this.dropRow(c) : -1, skin = who === YOU ? "is-you" : "is-ai";
    this.phase = who === YOU ? "shoot" : "ai";
    this.syncCols();
    this.setPreview(null);
    var done = function () { if (t === self.token) self.afterShot(who, c, row); };

    if (calm()) {
      if (make) { this.placeBall(who, row, c); this.fxScore(c); } else this.fxMiss(c);
      this.later(make ? 420 : 560, done);
      return;
    }

    var g = this.geo(c), fly = document.createElement("i"), spin = who === YOU ? -1 : 1;
    fly.className = "cg-fly cg-skin " + skin;
    fly.style.width = fly.style.height = g.d.toFixed(1) + "px";
    this.play.appendChild(fly);
    var x0 = g.w * (who === YOU ? 0.3 : 0.7), y0 = g.bottom + g.d * 0.7, a;

    if (make) {
      var x1 = g.rimX, y1 = g.rimY - g.d * 0.62;
      a = this.track(fly.animate(arc(x0, y0, x1, y1, Math.max(g.d * 0.65, y1 - g.cell * 1.1), g.d, 0, 1, 1.38, 1, 0, spin * 420),
        { duration: 640, easing: "linear", fill: "forwards" }));
      a.onfinish = function () {
        if (t !== self.token) return;
        fly.remove();
        var ball = self.placeBall(who, row, c), dy0 = y1 - (g.gy + (row + 0.5) * g.cell);
        self.fxScore(c);
        var dur = (190 + Math.sqrt(Math.abs(dy0)) * 15) / 0.72,
            drop = self.track(ball.animate(dropFrames(dy0, g.cell), { duration: dur, easing: "linear" }));
        self.later(dur * 0.72, function () { restart(self.rack, "is-thud"); });
        drop.onfinish = done;
      };
    } else {
      var side = g.rimX < g.w / 2 ? 1 : -1,
          xc = g.rimX + side * g.rimW * 0.32, yc = g.rimY - g.d * 0.38,
          x2 = Math.min(g.w - g.d * 0.6, Math.max(g.d * 0.6, g.rimX + side * g.cell * 1.7)), y2 = g.bottom + g.d,
          p = 640 / 1480,
          frames = arc(x0, y0, xc, yc, Math.max(g.d * 0.65, yc - g.cell * 1.1), g.d, 0, p, 1.38, 1, 0, spin * 420)
            .concat(arc(xc, yc, x2, y2, yc - g.cell * 0.8, g.d, p, 1, 1, 1.5, spin * 420, -spin * 160).slice(1));
      frames.forEach(function (f) { if (f.offset > 0.86) f.opacity = Math.max(0, (1 - f.offset) / 0.14); });
      a = this.track(fly.animate(frames, { duration: 1480, easing: "linear", fill: "forwards" }));
      this.later(640, function () { self.fxMiss(c); });
      a.onfinish = function () { fly.remove(); done(); };
    }
  };

  G.placeBall = function (who, r, c) {
    this.board[r][c] = who;
    var b = document.createElement("i");
    b.className = "cg-ball cg-skin " + (who === YOU ? "is-you" : "is-ai");
    b.style.setProperty("--c", c);
    b.style.setProperty("--r", r);
    b.setAttribute("data-r", r);
    b.setAttribute("data-c", c);
    this.balls.appendChild(b);
    this.syncCols();
    return b;
  };

  G.fx = function (c, cls, ms) {
    if (calm()) return;
    var h = this.hoopEls[c];
    restart(h, cls);
    this.later(ms, function () { h.classList.remove(cls); });
  };

  G.popText = function (text, c, kind) {
    var p = this.pop;
    p.textContent = text;
    p.style.setProperty("--x", Math.min(78, Math.max(22, 2.7027 + (c + 0.5) * 13.5135)).toFixed(2) + "%");
    p.className = "cg-pop";
    void p.offsetWidth;
    p.className = "cg-pop " + kind + (calm() ? " is-static" : " is-show");
    this.later(950, function () { p.className = "cg-pop"; });
  };

  G.fxScore = function (c) {
    this.fx(c, "is-swish", 650);
    this.popText("Sayı!", c, "is-score");
    if (calm()) return;
    var box = this.flashes, i, f;
    box.textContent = "";
    for (i = 0; i < 9; i++) {
      f = document.createElement("i");
      f.style.left = rand(3, 97) + "%";
      f.style.top = (i % 3 === 0 ? rand(4, 30) : rand(58, 97)) + "%";
      f.style.animationDelay = rand(0, 420) + "ms";
      box.appendChild(f);
    }
    restart(this.stage, "is-roar");
    var stage = this.stage;
    this.later(1100, function () { box.textContent = ""; stage.classList.remove("is-roar"); });
  };

  G.fxMiss = function (c) {
    this.fx(c, "is-shake", 560);
    this.popText("Iska!", c, "is-miss");
  };

  /* ---------- after every shot: win / draw / next turn ---------- */
  G.afterShot = function (who, c, row) {
    var self = this, made = row >= 0;
    if (made) {
      var line = this.findWin(row, c, who);
      if (line) { this.finish(who, line); return; }
      if (this.isFull()) { this.finish(0, null); return; }
    }
    if (who === YOU) {
      this.phase = "ai";
      this.setTurn(AI);
      this.syncCols();
      this.say((made ? "Sayı! " + (c + 1) + ". potadan girdi." : "Iska! Top çemberden döndü.") + " Sıra Arena’da…");
      var aim = this.aiChoose(), make = Math.random() >= AI_MISS;
      this.setPreview(c, AI);
      this.later(Math.round(AI_DELAY * 0.45), function () { self.setPreview(aim, AI); });
      this.later(AI_DELAY, function () { self.shoot(AI, aim, make); });
    } else {
      this.phase = "pick";
      this.setTurn(YOU);
      this.syncCols();
      this.say(made ? "Arena " + (c + 1) + ". potaya attı: sayı! Sıra sende." : "Arena " + (c + 1) + ". potada ıska geçti! Sıra sende.");
      if (this.colsEl.contains(document.activeElement)) this.setPreview(this.cursor, YOU);
    }
  };

  G.drawWin = function (line) {
    var g = this.winG, self = this, a = line[0], b = line[line.length - 1];
    g.textContent = "";
    line.forEach(function (cell) {
      var ring = document.createElementNS(NS, "circle");
      ring.setAttribute("cx", 50 + 100 * cell[1]);
      ring.setAttribute("cy", 50 + 100 * cell[0]);
      ring.setAttribute("r", "45");
      ring.setAttribute("class", "cg-wring");
      g.appendChild(ring);
      var ball = self.balls.querySelector('[data-r="' + cell[0] + '"][data-c="' + cell[1] + '"]');
      if (ball) ball.classList.add("is-win");
    });
    var ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", 50 + 100 * a[1]); ln.setAttribute("y1", 50 + 100 * a[0]);
    ln.setAttribute("x2", 50 + 100 * b[1]); ln.setAttribute("y2", 50 + 100 * b[0]);
    ln.setAttribute("pathLength", "1");
    ln.setAttribute("class", "cg-wline");
    g.appendChild(ln);
    this.rack.classList.add("is-over");
  };

  G.finish = function (winner, line) {
    var self = this, score = "Sen " + this.wins[YOU] + " – " + this.wins[AI] + " Arena", title, sub, btn, cls, msg;
    this.phase = "over";
    this.lastWinner = winner;
    this.setTurn(0);
    this.syncCols();
    this.setPreview(null);
    if (winner) {
      this.wins[winner]++;
      score = "Sen " + this.wins[YOU] + " – " + this.wins[AI] + " Arena";
      this.renderScore();
      this.bump((winner === YOU ? this.s1 : this.s2).parentNode);
    }
    if (line) this.drawWin(line);
    if (winner === YOU) { title = "CONNECT!"; sub = "Kazandın"; btn = "Yeni Maç"; cls = "is-you"; msg = "CONNECT! Kazandın."; }
    else if (winner === AI) { title = "Arena kazandı"; sub = "Rövanş?"; btn = "Rövanş"; cls = "is-ai"; msg = "Arena kazandı — rövanş?"; }
    else { title = "Berabere!"; sub = "Tahta doldu"; btn = "Yeni Maç"; cls = "is-draw"; msg = "Berabere! Tahta doldu."; }
    this.say(msg + " Skor: Sen " + this.wins[YOU] + ", Arena " + this.wins[AI] + ".");
    if (winner === YOU && !calm()) {
      this.hoopEls.forEach(function (h, i) { self.later(140 + i * 70, function () { restart(h, "is-swish"); }); });
    }
    this.later(calm() ? 0 : 700, function () {
      self.bt.textContent = title;
      if (winner === YOU) self.bt.setAttribute("lang", "en"); else self.bt.removeAttribute("lang");
      self.bs.innerHTML = "";
      self.bs.appendChild(document.createTextNode(sub));
      var sc = document.createElement("span");
      sc.className = "cg-bscore";
      sc.textContent = score;
      self.bs.appendChild(sc);
      self.againLabel.textContent = btn;
      self.banner.className = "cg-banner " + cls;
      self.banner.hidden = false;
      if (self.root.contains(document.activeElement) || document.activeElement === document.body) focusQuiet(self.again);
      if (winner === YOU && window.MV && typeof window.MV.confetti === "function") {
        var r = self.bt.getBoundingClientRect();
        window.MV.confetti(r.left + r.width / 2, r.top + r.height / 2, 70);
      }
    });
  };

  Array.prototype.forEach.call(hosts, function (host) { new Game(host); });
})();
