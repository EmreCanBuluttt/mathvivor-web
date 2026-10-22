/* Mathvivor — Ölçme ve Değerlendirme page:
   1) five-symbol compass (tabs that swing the needle), 2) "Takımda hangi rol sensin?" warm-up quiz.
   The quiz is for fun only; nothing is stored or sent anywhere. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MV = window.MV || {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var icon = function (name) { return '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>'; };

  /* =================== 1) compass tabs =================== */
  (function compass() {
    var root = document.querySelector("[data-ol-compass]");
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    if (!tabs.length || panels.some(function (p) { return !p; })) return;
    var dial = root.querySelector(".ol-compass");
    var pointer = root.querySelector(".ol-pointer");
    var pager = root.querySelector(".ol-pager");
    var pagerTxt = root.querySelector(".ol-pager-txt");
    var n = tabs.length, cur = 0, angle = 0;

    function select(i, focusTab) {
      i = (i % n + n) % n;
      var changed = i !== cur;
      var target = i * (360 / n);
      var now = ((angle % 360) + 360) % 360;
      var diff = target - now;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      angle += diff;
      if (pointer) pointer.style.setProperty("--a", angle + "deg");
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
        panels[k].classList.toggle("is-active", on);
      });
      if (changed && !reduce) {
        panels[i].classList.remove("is-enter"); void panels[i].offsetWidth; panels[i].classList.add("is-enter");
        if (dial) { dial.classList.remove("is-ping"); void dial.offsetWidth; dial.classList.add("is-ping"); }
      }
      if (pagerTxt) pagerTxt.textContent = (i + 1) + " / " + n;
      cur = i;
      if (focusTab) tabs[i].focus();
    }

    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { select(k, false); });
      t.addEventListener("keydown", function (e) {
        var to = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") to = cur + 1;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = cur - 1;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = n - 1;
        if (to === null) return;
        e.preventDefault();
        select(to, true);
      });
    });
    if (pager) {
      pager.hidden = false;
      var prev = pager.querySelector(".ol-prev"), next = pager.querySelector(".ol-next");
      if (prev) prev.addEventListener("click", function () { select(cur - 1, false); });
      if (next) next.addEventListener("click", function () { select(cur + 1, false); });
    }
    select(0, false);
  })();

  /* =================== 2) role quiz =================== */
  var host = document.querySelector("[data-rt]");
  if (!host) return;

  var ROLES = {
    lider: { name: "Lider", icon: "flag", desc: "Takım bir yöne bakacaksa, o yönü çoğu zaman sen gösterirsin. Sorumluluk almaktan çekinmez, herkesi aynı hedefe kilitlersin." },
    analist: { name: "Analist", icon: "brain", desc: "Atıştan önce tahtayı, hamleden önce rakibi okursun. Sayılar ve olasılıklar senin için oyunun gizli haritasıdır." },
    hizli: { name: "Hızlı Karar Verici", icon: "bolt", desc: "Süre daraldıkça hızlanan oyunculardansın. Takımı ileri taşıyan ilk hamle çoğu zaman senden gelir." },
    sakin: { name: "Takımın Sakinleştiricisi", icon: "heart", desc: "Skor ne olursa olsun takımın nefesi sensin. Gerginlik yükseldiğinde ortamı yumuşatır, herkesin oyuna dönmesini sağlarsın." },
    iletisim: { name: "İletişimci", icon: "chat", desc: "Bilgi sende durmaz, takımın her köşesine ulaşır. Herkesin aynı resmi görmesini sağlar, ortak dili sen kurarsın." },
    cozum: { name: "Çözüm Üretici", icon: "puzzle", desc: "Herkes duvara dayandığında sen kapıyı ararsın. Alışılmadık yolları denemekten çekinmez, problemi oyuna çevirirsin." }
  };
  var ORDER = ["lider", "analist", "hizli", "sakin", "iletisim", "cozum"];

  var QUESTIONS = [
    { scene: "Basketbol Connect · Son saniyeler", icon: "clock",
      q: "Süre bitmek üzere ve takım hâlâ hangi sütuna atış yapacağına karar veremedi. Sen ne yaparsın?",
      a: [["lider", "Topu alırım: “Ortadaki sütun, hadi!” der ve takımı peşimden sürüklerim."],
          ["analist", "Tahtaya bakar, rakibin dörtlüyü hangi sütunda tamamlamak üzere olduğunu hesaplarım."],
          ["hizli", "Hiç beklemem; boşa geçen her saniye kaybettirir, atışı yaparım."],
          ["sakin", "“Sakin, vaktimiz var” der, herkesin bir nefes almasını sağlarım."]] },
    { scene: "Atış sırası · Seri kaçtı", icon: "ball",
      q: "Takım arkadaşın üst üste üç atışı kaçırdı ve morali bozuldu. İlk tepkin ne olur?",
      a: [["sakin", "Omzuna dokunur, “Bir sonraki kesin girecek” derim."],
          ["iletisim", "Gördüğümü hemen söylerim: “Biraz daha yüksekten at, potaya çok yakınsın.”"],
          ["cozum", "Görevleri değiştirmeyi öneririm: o tahtayı izlesin, atışları ben üstleneyim."],
          ["analist", "Kaçan atışlara bakar, sorunun açıda mı güçte mi olduğunu çözerim."]] },
    { scene: "Matematik etabı · Zor soru", icon: "puzzle",
      q: "Parkurun matematik etabında herkesin takıldığı zor bir soru çıktı. Sen ne yaparsın?",
      a: [["cozum", "Bambaşka bir yol denerim: şekil çizer, tahmin eder, sonucu geriye doğru kontrol ederim."],
          ["analist", "Soruyu parçalarına ayırır, verilenleri tek tek yazarım."],
          ["lider", "Sorumluluğu alırım: “Bu soru bende, siz parkura devam edin.”"],
          ["iletisim", "Herkesin aklındakini yüksek sesle söylemesini isterim; çözüm ortada bir yerde."]] },
    { scene: "Golf Connect · Kritik vuruş", icon: "flag",
      q: "Topu hedefe ulaştırmak için iki yol var: riskli ama kısa yol ya da güvenli ama uzun yol. Seçimin?",
      a: [["hizli", "Kısa yol! Cesaret eden kazanır."],
          ["analist", "Mesafeyi ve açıyı hesaplar, şansı yüksek olanı seçerim."],
          ["sakin", "Takımın gerginliğine bakarım; şu an güvenli yol herkesi rahatlatır."],
          ["cozum", "İkisine de takılmam, üçüncü bir yol ararım: kenardan sektirsek?"]] },
    { scene: "Futbol Connect · Rakip öne geçti", icon: "shield",
      q: "Rakip takım hızla öne geçti ve takımda moraller düştü. Sen ne yaparsın?",
      a: [["lider", "Herkesi toplar, yeni planı açıklarım: “Şimdi böyle oynuyoruz.”"],
          ["sakin", "Gülümser, “Oyun daha bitmedi” der, ortamı yumuşatırım."],
          ["iletisim", "Rakibin ne yaptığını takıma anlatır, herkesin aynı resmi görmesini sağlarım."],
          ["hizli", "Hemen bir hamle yaparım; beklemek moralin en büyük düşmanı."]] },
    { scene: "Yeni oyun · İlk düdük", icon: "book",
      q: "Takım ilk kez oynayacağı bir oyuna başlıyor ve kurallar biraz karışık. İlk ne yaparsın?",
      a: [["iletisim", "Kuralları herkese kısaca ben anlatır, gelen soruları yanıtlarım."],
          ["cozum", "Kuralların içindeki kısa yolu ararım: “Şunu yaparsak kazanırız!”"],
          ["lider", "Görevleri dağıtırım: sen skoru tut, sen atış yap, sen süreyi izle."],
          ["hizli", "Önce oynarım; kuralları en iyi ilk turda öğreniriz."]] }
  ];
  var KEYS = ["A", "B", "C", "D"];
  var TOTAL = QUESTIONS.length;

  var state = { i: 0, picks: [], order: [] };
  var busy = false;

  host.innerHTML =
    '<div class="rt-card">' +
      '<div class="rt-top"><p class="rt-step" data-rt-step></p><ol class="rt-dots" aria-hidden="true">' + QUESTIONS.map(function () { return "<li></li>"; }).join("") + "</ol></div>" +
      '<div class="rt-stage" data-rt-stage></div>' +
    "</div>" +
    '<p class="sr-only" aria-live="polite" data-rt-live></p>';
  var card = host.querySelector(".rt-card");
  var top = host.querySelector(".rt-top");
  var stepEl = host.querySelector("[data-rt-step]");
  var dots = Array.prototype.slice.call(host.querySelectorAll(".rt-dots li"));
  var stage = host.querySelector("[data-rt-stage]");
  var live = host.querySelector("[data-rt-live]");

  function say(msg) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 60); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var t = a[k]; a[k] = a[j]; a[j] = t; }
    return a;
  }

  function start() {
    state = { i: 0, picks: [], order: QUESTIONS.map(function (q) { return shuffle([0, 1, 2, 3]); }) };
    top.hidden = false;
    renderQuestion(false);
  }

  function renderQuestion(focus) {
    var q = QUESTIONS[state.i];
    stepEl.innerHTML = "Soru <b>" + (state.i + 1) + "</b> / " + TOTAL;
    dots.forEach(function (d, k) {
      d.classList.toggle("is-done", k < state.i);
      d.classList.toggle("is-current", k === state.i);
    });
    var prevPick = state.picks[state.i];
    stage.innerHTML =
      '<p class="rt-scene">' + icon(q.icon) + '<span>' + esc(q.scene).replace(/Connect/g, '<span lang="en">Connect</span>') + "</span></p>" +
      '<h3 class="rt-question" tabindex="-1">' + esc(q.q) + "</h3>" +
      '<div class="rt-answers" role="group" aria-label="Cevaplar">' +
        state.order[state.i].map(function (ai, pos) {
          var a = q.a[ai];
          return '<button class="rt-ans' + (prevPick === ai ? " was-picked" : "") + '" type="button" data-a="' + ai + '" aria-keyshortcuts="' + KEYS[pos] + '"' + (prevPick === ai ? ' aria-describedby="rt-prev-note"' : "") + '>' +
            '<span class="rt-key" aria-hidden="true">' + KEYS[pos] + '</span><span class="rt-txt">' + esc(a[1]) + "</span></button>";
        }).join("") +
      "</div>" +
      '<div class="rt-foot">' +
        '<button class="rt-back" type="button"' + (state.i === 0 ? " hidden" : "") + ">" + icon("arrow") + "Önceki soru</button>" +
        '<span class="rt-hint" aria-hidden="true">' + (prevPick != null ? "önceki seçimin işaretli" : (state.i === TOTAL - 1 ? "son soru!" : "içinden geleni seç")) + "</span>" +
        (prevPick != null ? '<span class="sr-only" id="rt-prev-note">Önceki seçimin</span>' : "") +
      "</div>";
    Array.prototype.forEach.call(stage.querySelectorAll(".rt-ans"), function (b) {
      b.addEventListener("click", function () { pick(+b.getAttribute("data-a"), b); });
    });
    var back = stage.querySelector(".rt-back");
    if (back) back.addEventListener("click", function () { go(state.i - 1); });
    if (focus) {
      var h = stage.querySelector(".rt-question");
      if (h) h.focus({ preventScroll: true });
      say("Soru " + (state.i + 1) + " / " + TOTAL);
      keepInView(h);
    }
  }

  /* on small screens the next question can start above the fold: bring the card back under the header */
  function keepInView(el) {
    if (!el) return;
    var header = document.querySelector(".site-header");
    var limit = (header ? header.getBoundingClientRect().bottom : 0) + 8;
    var r = el.getBoundingClientRect();
    if (r.top < limit || r.top > window.innerHeight - 120) card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function transition(render) {
    if (reduce) { render(); return; }
    busy = true;
    stage.classList.remove("is-in");
    stage.classList.add("is-out");
    setTimeout(function () {
      render();
      stage.classList.remove("is-out");
      void stage.offsetWidth;
      stage.classList.add("is-in");
      busy = false;
    }, 200);
  }

  function go(i) {
    if (busy || i < 0) return;
    state.i = i;
    transition(function () { renderQuestion(true); });
  }

  function pick(ai, btn) {
    if (busy) return;
    busy = true;
    state.picks[state.i] = ai;
    btn.classList.add("is-picked");
    var group = stage.querySelector(".rt-answers");
    if (group) group.classList.add("is-locked");
    setTimeout(function () {
      busy = false;
      if (state.i < TOTAL - 1) go(state.i + 1);
      else transition(showResult);
    }, reduce ? 150 : 420);
  }

  function score() {
    var s = {}, last = {};
    ORDER.forEach(function (r) { s[r] = 0; last[r] = -1; });
    state.picks.forEach(function (ai, qi) { var r = QUESTIONS[qi].a[ai][0]; s[r]++; last[r] = qi; });
    var ranked = ORDER.slice().sort(function (a, b) { return (s[b] - s[a]) || (last[b] - last[a]); });
    return { s: s, ranked: ranked };
  }

  function showResult() {
    var res = score();
    var key = res.ranked[0], second = res.ranked[1];
    var role = ROLES[key];
    dots.forEach(function (d) { d.classList.add("is-done"); d.classList.remove("is-current"); });
    stepEl.innerHTML = "<b>Maç sonu</b>";
    stage.innerHTML =
      '<div class="rt-result">' +
        '<div class="rt-medal" aria-hidden="true">' + icon(role.icon) + "</div>" +
        '<p class="rt-kick">Senin rolün</p>' +
        '<h3 class="rt-role" tabindex="-1">' + esc(role.name) + "</h3>" +
        '<p class="rt-desc">' + esc(role.desc) + "</p>" +
        (res.s[second] > 0 ? '<p class="rt-second">Yedek gücün: <b>' + esc(ROLES[second].name) + "</b></p>" : "") +
        '<ul class="rt-dist" aria-label="Cevaplarının rollere dağılımı">' +
          '<li class="rt-dist-title" aria-hidden="true">cevaplarının dağılımı</li>' +
          res.ranked.map(function (r) {
            var v = res.s[r];
            return '<li' + (r === key ? ' class="is-top"' : "") + '><span>' + esc(ROLES[r].name) + '</span><span class="rt-pips" role="img" aria-label="' + v + ' cevap">' +
              [0, 1, 2, 3].map(function (k) { return '<i class="' + (k < v ? "on" : "") + '"></i>'; }).join("") + "</span></li>";
          }).join("") +
        "</ul>" +
        '<div class="btn-row">' +
          '<button class="btn rt-share" type="button">' + icon("share") + "Sonucu paylaş</button>" +
          '<button class="btn btn--ghost rt-again" type="button">Tekrar çöz</button>' +
        "</div>" +
        '<p class="rt-copied" aria-live="polite"></p>' +
        '<p class="rt-small">Eğlence amaçlı bir ısınma testidir; bilimsel bir ölçme aracı değildir.</p>' +
      "</div>";
    var h = stage.querySelector(".rt-role");
    if (h) h.focus({ preventScroll: true });
    keepInView(stage.querySelector(".rt-medal"));
    say("Sonuç: " + role.name + ". " + role.desc);
    var medal = stage.querySelector(".rt-medal");
    if (medal && typeof MV.confetti === "function") {
      setTimeout(function () { var r = medal.getBoundingClientRect(); MV.confetti(r.left + r.width / 2, r.top + r.height / 2, 60); }, reduce ? 0 : 250);
    }
    stage.querySelector(".rt-again").addEventListener("click", function () {
      transition(function () { start(); var q = stage.querySelector(".rt-question"); if (q) q.focus({ preventScroll: true }); say("Test yeniden başladı. Soru 1 / " + TOTAL); });
      var rect = card.getBoundingClientRect();
      if (rect.top < 0) card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    stage.querySelector(".rt-share").addEventListener("click", function () { share(role.name); });
  }

  function share(roleName) {
    var out = stage.querySelector(".rt-copied");
    var url = location.href.split("#")[0] + "#rol-testi";
    var text = "Mathvivor ısınma testinde takımdaki rolüm: " + roleName + "! Sen hangi rolsün?";
    var full = text + " " + url;
    var note = function (msg) { if (out) out.textContent = msg; };
    var showFallback = function () {
      note("Kopyalanamadı; aşağıdaki metni seçip kopyalayabilirsin.");
      if (!out || stage.querySelector(".rt-copy-fallback")) return;
      var input = document.createElement("input");
      input.className = "rt-copy-fallback";
      input.type = "text";
      input.readOnly = true;
      input.value = full;
      input.setAttribute("aria-label", "Paylaşım metni");
      out.insertAdjacentElement("afterend", input);
      input.focus(); input.select();
    };
    var legacyCopy = function () {
      try {
        var ta = document.createElement("textarea");
        ta.value = full;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        if (ok) note("Sonuç panoya kopyalandı!"); else showFallback();
      } catch (e) { showFallback(); }
    };
    var copy = function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(full).then(function () { note("Sonuç panoya kopyalandı!"); }, legacyCopy);
      } else legacyCopy();
    };
    if (navigator.share) {
      navigator.share({ title: "Takımda hangi rol sensin? | Mathvivor", text: text, url: url })
        .then(function () { note("Paylaşıldı, sahada görüşürüz!"); })
        .catch(function (err) { if (err && err.name === "AbortError") return; copy(); });
    } else copy();
  }

  /* A–D (or 1–4) pick an answer while focus is inside the quiz */
  host.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !e.key) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    var k = e.key.length === 1 ? e.key.toUpperCase() : "";
    var idx = KEYS.indexOf(k);
    if (idx < 0) idx = ["1", "2", "3", "4"].indexOf(k);
    if (idx < 0) return;
    var btn = stage.querySelectorAll(".rt-ans")[idx];
    if (!btn || busy) return;
    e.preventDefault();
    btn.click();
  });

  start();
})();
