/* Mathvivor — contact page (message form + basketball submit) and legal-page table of contents.
   Runs after main.js (needs window.MV.contact / MV.waLink). Every part bails out quietly when its markup is absent. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var MV = window.MV || {};
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var TOPICS = {
    etkinlik: "Etkinlik planlama",
    okul: "Okul etkinliği",
    kurumsal: "Kurumsal / takım etkinliği",
    sponsorluk: "Sponsorluk",
    diger: "Diğer"
  };

  /* "Kurumsal-Takım" / "SPONSORLUK" / "diğer" -> canonical topic key */
  function topicKey(raw) {
    var s = String(raw || "").toLocaleLowerCase("tr")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z]/g, "");
    if (!s) return "";
    if (s.indexOf("sponsor") === 0) return "sponsorluk";
    if (s.indexOf("okul") === 0 || s.indexOf("egitim") === 0 || s.indexOf("ogrenci") === 0) return "okul";
    if (s.indexOf("kurum") === 0 || s.indexOf("takim") === 0 || s.indexOf("sirket") === 0 || s.indexOf("team") === 0) return "kurumsal";
    if (s.indexOf("etkinlik") === 0 || s.indexOf("plan") === 0 || s.indexOf("festival") === 0) return "etkinlik";
    if (s.indexOf("diger") === 0) return "diger";
    return "";
  }

  initForm();
  initToc();

  /* =====================================================================
     Contact form
     ===================================================================== */
  function initForm() {
    var form = $("[data-ct-form]");
    var wrap = $("[data-ct-formwrap]");
    if (!form || !wrap) return;

    var contact = MV.contact || {};
    var endpoint = String(contact.formEndpoint || "").trim();
    var hasWa = !!(contact.whatsapp && typeof MV.waLink === "function" && MV.waLink(""));
    var email = String(contact.email || "").trim();
    var mode = endpoint ? "endpoint" : hasWa ? "wa" : email ? "mail" : "";

    var live = $("[data-ct-live]");
    var say = function (msg) { if (!live) return; live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 60); };

    /* no way to deliver a message: hide the form, show the phone numbers instead */
    if (!mode) {
      wrap.hidden = true;
      var off = $("[data-ct-off]");
      if (off) off.hidden = false;
      $$("[data-ct-needs-form]").forEach(function (el) { el.hidden = true; });
      $$("[data-ct-cta]").forEach(function (el) { el.textContent = "Bize ulaşın"; });
      return;
    }

    /* browsers without overflow: clip: never let focus()/scrollIntoView() scroll the card's own content */
    wrap.addEventListener("scroll", function () { if (wrap.scrollTop || wrap.scrollLeft) { wrap.scrollTop = 0; wrap.scrollLeft = 0; } });

    var f = form.elements;
    var submitBtn = $("[data-ct-submit]", form);
    var label = $("[data-ct-label]", form);
    var ball = $("[data-ct-ball]", form);
    var hoop = $("[data-ct-hoop]", form);
    var channel = $("[data-ct-channel]", form);
    var errorBox = $("[data-ct-error]", form);
    var done = $("[data-ct-done]", wrap);
    var doneTitle = $("[data-ct-done-title]", wrap);
    var doneText = $("[data-ct-done-text]", wrap);
    var doneWa = $("[data-ct-done-wa]", wrap);
    var again = $("[data-ct-again]", wrap);
    var count = $("[data-ct-count]", form);
    var select = f.konu;
    var hintBox = $("[data-ct-hint-box]", form);
    var busy = false;
    var attempted = false;

    var NOTES = {
      endpoint: "Mesajınız doğrudan bize iletilir.",
      wa: "Gönderdiğinizde mesajınız WhatsApp’ta hazır metin olarak açılır; göndermek için WhatsApp’ta onaylamanız yeterli.",
      mail: "Gönderdiğinizde e-posta uygulamanızda hazır bir taslak açılır."
    };
    if (channel) channel.textContent = NOTES[mode];

    /* ---------- validation ---------- */
    var RULES = {
      ad: function (el) {
        var v = el.value.trim();
        if (!v) return "Lütfen adınızı ve soyadınızı yazın.";
        if (v.length < 2) return "Ad soyad en az 2 karakter olmalı.";
        return "";
      },
      telefon: function (el) {
        var v = el.value.trim();
        if (!v) return "";
        var digits = v.replace(/\D/g, "");
        if (!/^[+\d\s().\/-]+$/.test(v) || digits.length < 10 || digits.length > 15) return "Telefon numarası eksik ya da hatalı görünüyor; alan koduyla birlikte yazın.";
        return "";
      },
      mesaj: function (el) {
        var v = el.value.trim();
        if (!v) return "Lütfen mesajınızı yazın.";
        if (v.length < 10) return "Biraz daha ayrıntı yazar mısınız? (en az 10 karakter)";
        return "";
      },
      kvkk: function (el) { return el.checked ? "" : "Devam etmek için KVKK Aydınlatma Metni’ni okuduğunuzu onaylayın."; }
    };

    function setError(name, msg) {
      var el = f[name], err = document.getElementById("ct-" + name + "-err");
      if (!el || !err) return;
      var ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (x) { return x && x !== err.id; });
      if (msg) {
        err.textContent = msg; err.hidden = false;
        el.setAttribute("aria-invalid", "true");
        ids.push(err.id);
      } else {
        err.textContent = ""; err.hidden = true;
        el.removeAttribute("aria-invalid");
      }
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" ")); else el.removeAttribute("aria-describedby");
    }

    function check(name) { var msg = RULES[name](f[name]); setError(name, msg); return !msg; }

    function checkAll() {
      return Object.keys(RULES).filter(function (n) { return !check(n); }).map(function (n) { return f[n]; });
    }

    Object.keys(RULES).forEach(function (name) {
      var el = f[name];
      if (!el) return;
      el.addEventListener("blur", function () { if (attempted || (el.type !== "checkbox" && el.value.trim())) check(name); });
      el.addEventListener(el.type === "checkbox" ? "change" : "input", function () {
        if (attempted || el.getAttribute("aria-invalid") === "true") check(name);
      });
    });

    /* ---------- message counter (shot clock) ---------- */
    function updateCount() {
      if (!count) return;
      var max = +f.mesaj.getAttribute("maxlength") || 1500, n = f.mesaj.value.length;
      count.textContent = n + " / " + max;
      count.classList.toggle("is-hot", n > max * 0.9);
    }
    f.mesaj.addEventListener("input", updateCount);
    updateCount();

    /* ---------- topic: hint + ?konu= preselect + hero shortcuts ---------- */
    function showHint() {
      if (!hintBox) return;
      var any = false;
      $$("[data-ct-hint]", hintBox).forEach(function (s) {
        var on = s.getAttribute("data-ct-hint") === select.value;
        s.hidden = !on; any = any || on;
      });
      hintBox.hidden = !any;
    }
    function setTopic(key, flash) {
      if (!key || !TOPICS[key]) return;
      select.value = key;
      showHint();
      if (flash && !reduce) {
        select.classList.remove("ct-flash"); void select.offsetWidth; select.classList.add("ct-flash");
      }
    }
    select.addEventListener("change", showHint);
    select.addEventListener("animationend", function () { select.classList.remove("ct-flash"); });

    var param = "";
    try { param = new URLSearchParams(window.location.search).get("konu") || ""; } catch (e) { param = ""; }
    setTopic(topicKey(param), false);
    showHint();

    /* scroll the card into view and put the caret in the first field */
    function goToForm() {
      wrap.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (form.hidden) return;
      setTimeout(function () { try { f.ad.focus({ preventScroll: true }); } catch (err) { f.ad.focus(); } }, reduce ? 0 : 450);
    }

    $$("[data-ct-topic]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var key = topicKey(a.getAttribute("data-ct-topic"));
        if (!key || wrap.hidden) return;
        e.preventDefault();
        if (!form.hidden) setTopic(key, true);
        try { history.replaceState(null, "", "?konu=" + key + "#mesaj"); } catch (err) { /* file:// or sandboxed */ }
        goToForm();
        say(TOPICS[key] + " konusu seçildi.");
      });
    });

    $$('a[href="#mesaj"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (wrap.hidden || form.hidden) return;
        e.preventDefault();
        try { history.replaceState(null, "", window.location.search + "#mesaj"); } catch (err) { /* file:// or sandboxed */ }
        goToForm();
      });
    });

    /* ---------- compose ---------- */
    function collect() {
      return {
        ad: f.ad.value.trim(),
        kurum: f.kurum.value.trim(),
        telefon: f.telefon.value.trim(),
        konu: TOPICS[select.value] || "",
        mesaj: f.mesaj.value.trim()
      };
    }
    function compose(d, bold) {
      var b = function (s) { return bold ? "*" + s + "*" : s; };
      var lines = ["Merhaba Mathvivor,", ""];
      lines.push(b("Ad Soyad:") + " " + d.ad);
      if (d.kurum) lines.push(b("Kurum:") + " " + d.kurum);
      if (d.telefon) lines.push(b("Telefon:") + " " + d.telefon);
      if (d.konu) lines.push(b("Konu:") + " " + d.konu);
      lines.push("", b("Mesaj:"), d.mesaj, "", "(mathvivor.com iletişim formundan)");
      return lines.join("\n");
    }

    /* ---------- states ---------- */
    function setBusy(on) {
      busy = on;
      submitBtn.classList.toggle("is-busy", on);
      submitBtn.setAttribute("aria-disabled", on ? "true" : "false");
      form.setAttribute("aria-busy", on ? "true" : "false");
      label.textContent = on ? "Gönderiliyor…" : "Mesajı at";
    }

    function miss() {
      if (reduce) return;
      submitBtn.classList.remove("is-miss"); void submitBtn.offsetWidth; submitBtn.classList.add("is-miss");
    }
    submitBtn.addEventListener("animationend", function (e) { if (e.target === submitBtn) submitBtn.classList.remove("is-miss"); });

    function showError() {
      var phones = (contact.phones || []).map(function (p) {
        return '<a href="tel:' + p.replace(/[^\d+]/g, "") + '">' + esc(p) + "</a>";
      }).join(" · ");
      var wa = hasWa ? ' · <a href="' + esc(MV.waLink(compose(collect(), true))) + '" target="_blank" rel="noopener">WhatsApp</a>' : "";
      errorBox.innerHTML = "<strong>Top potadan döndü.</strong> Mesaj gönderilemedi; bağlantınızı kontrol edip yeniden deneyin" +
        (phones || wa ? " ya da bize doğrudan ulaşın: " + phones + wa : ".");
    }

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
    }

    /* the ball leaves the button and drops through the hoop */
    function shoot(cb) {
      if (reduce || !ball || !hoop || typeof ball.animate !== "function") { cb(); return; }
      var b = ball.getBoundingClientRect();
      var svg = hoop.querySelector("svg");
      var h = (svg || hoop).getBoundingClientRect();
      if (!b.width || !h.width) { cb(); return; }
      var sx = h.width / 96, sy = h.height / 104;
      var size = Math.max(26, Math.min(b.width, 54 * sx));
      var x0 = b.left + b.width / 2, y0 = b.top + b.height / 2;
      var x1 = h.left + 47 * sx, y1 = h.top + 52 * sy - size * 0.55;
      var y2 = h.top + 96 * sy;
      var arc = Math.max(110, Math.abs(x1 - x0) * 0.55 + Math.max(0, y0 - y1) * 0.4);
      var fly = ball.cloneNode(true);
      fly.className = "ct-flyball";
      fly.removeAttribute("data-ct-ball");
      fly.style.width = fly.style.height = b.width + "px";
      fly.style.left = (x0 - b.width / 2) + "px";
      fly.style.top = (y0 - b.height / 2) + "px";
      document.body.appendChild(fly);
      submitBtn.classList.add("is-shot");
      var frames = [], N = 18, scaleEnd = size / b.width;
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var x = (x1 - x0) * t, y = (y1 - y0) * t - arc * 4 * t * (1 - t);
        var s = 1 + (scaleEnd - 1) * t;
        frames.push({ transform: "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + Math.round(t * 540) + "deg) scale(" + s.toFixed(3) + ")", offset: t * 0.78 });
      }
      frames.push({ transform: "translate(" + (x1 - x0).toFixed(1) + "px," + (y2 - y0).toFixed(1) + "px) rotate(600deg) scale(" + (scaleEnd * 0.86).toFixed(3) + ")", opacity: 0.9, offset: 0.96 });
      frames.push({ transform: "translate(" + (x1 - x0).toFixed(1) + "px," + (y2 - y0 + 10).toFixed(1) + "px) rotate(610deg) scale(" + (scaleEnd * 0.8).toFixed(3) + ")", opacity: 0, offset: 1 });
      var anim = fly.animate(frames, { duration: 1050, easing: "linear", fill: "forwards" });
      var swished = false;
      setTimeout(function () {
        swished = true;
        hoop.classList.remove("is-swish"); void hoop.offsetWidth; hoop.classList.add("is-swish");
        if (typeof MV.confetti === "function") MV.confetti(x1, y1 + size * 0.5, 34);
      }, 820);
      var finish = function () { if (fly.parentNode) fly.parentNode.removeChild(fly); if (!swished) hoop.classList.add("is-swish"); setTimeout(cb, 380); };
      anim.onfinish = finish;
      anim.oncancel = finish;
    }

    function success(kind, waUrl) {
      var COPY = {
        endpoint: ["Sayı!", "Mesajınız bize ulaştı. Teşekkürler; oyun planını birlikte çizmek için size dönüş yapacağız."],
        wa: ["Sayı! Mesajınız hazır.", "WhatsApp yeni bir pencerede açıldı; mesajınızı orada göndermeniz yeterli. Pencere açılmadıysa aşağıdaki düğmeyi kullanın."],
        waBlocked: ["Sayı! Mesajınız hazır.", "Tarayıcınız yeni pencereyi açmadı. Hazırladığımız mesajı göndermek için aşağıdaki WhatsApp düğmesine dokunun."],
        mail: ["Sayı! Taslağınız hazır.", "E-posta uygulamanızda açılan taslağı göndermeniz yeterli." + (email ? " Açılmadıysa " + email + " adresine yazabilirsiniz." : "")]
      }[kind];
      shoot(function () {
        form.hidden = true;
        var head = $(".ct-formcard-head", wrap);
        if (head) head.hidden = true;
        doneTitle.textContent = COPY[0];
        doneText.textContent = COPY[1];
        if (doneWa) { doneWa.hidden = !waUrl; if (waUrl) doneWa.href = waUrl; }
        done.hidden = false;
        done.classList.remove("is-in"); void done.offsetWidth; done.classList.add("is-in");
        try { doneTitle.focus({ preventScroll: true }); } catch (e) { doneTitle.focus(); }
        var r = done.getBoundingClientRect();
        if (r.top < 70 || r.top > window.innerHeight - 120) wrap.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        say(COPY[0] + " " + COPY[1]);
      });
    }

    /* ---------- submit ---------- */
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      attempted = true;
      errorBox.innerHTML = "";
      var bad = checkAll();
      if (bad.length) {
        miss();
        say(bad.length === 1 ? "Bir alan kontrol edilmeli: " + document.getElementById("ct-" + bad[0].name + "-err").textContent
          : bad.length + " alan kontrol edilmeli. İlk alana yönlendirildiniz.");
        bad[0].focus();
        return;
      }
      if (f._gotcha && f._gotcha.value) { success(mode === "wa" ? "endpoint" : mode, ""); return; }
      var d = collect();

      if (mode === "wa") {
        var url = MV.waLink(compose(d, true));
        /* no "noopener" feature here: it would make window.open() return null and hide a blocked popup */
        var win = null;
        try { win = window.open(url, "_blank"); } catch (err) { win = null; }
        if (win) { try { win.opener = null; } catch (err) { /* cross-origin already */ } }
        success(win ? "wa" : "waBlocked", url);
        return;
      }

      if (mode === "mail") {
        var subject = "Mathvivor iletişim formu" + (d.konu ? " — " + d.konu : "");
        window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(compose(d, false).replace(/\n/g, "\r\n"));
        success("mail", "");
        return;
      }

      /* endpoint (Formspree-style JSON) */
      setBusy(true);
      say("Mesajınız gönderiliyor.");
      var ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          "Ad Soyad": d.ad, "Kurum": d.kurum, "Telefon": d.telefon, "Konu": d.konu || "Belirtilmedi",
          "Mesaj": d.mesaj, "KVKK onayı": "Evet", "Sayfa": window.location.href.split("#")[0],
          _subject: "Mathvivor iletişim formu" + (d.konu ? " — " + d.konu : "")
        }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        clearTimeout(timer);
        setBusy(false);
        success("endpoint", "");
      }).catch(function () {
        clearTimeout(timer);
        setBusy(false);
        miss();
        showError();
      });
    });

    if (again) again.addEventListener("click", function () {
      form.reset();
      attempted = false;
      Object.keys(RULES).forEach(function (n) { setError(n, ""); });
      setTopic(topicKey(param), false); showHint(); updateCount();
      submitBtn.classList.remove("is-shot");
      if (hoop) hoop.classList.remove("is-swish");
      done.hidden = true;
      form.hidden = false;
      var head = $(".ct-formcard-head", wrap);
      if (head) head.hidden = false;
      f.ad.focus();
    });
  }

  /* =====================================================================
     Legal pages: highlight the current section in the table of contents
     ===================================================================== */
  function initToc() {
    var tocs = $$("[data-lg-toc]");
    if (!tocs.length) return;
    $$("details[data-lg-toc]").forEach(function (d) {
      $$("a[href^='#']", d).forEach(function (a) { a.addEventListener("click", function () { d.open = false; }); });
    });
    if (!("IntersectionObserver" in window)) return;
    var links = [];
    tocs.forEach(function (t) { links = links.concat($$("a[href^='#']", t)); });
    var ids = [];
    links.forEach(function (a) { var id = a.getAttribute("href").slice(1); if (ids.indexOf(id) < 0) ids.push(id); });
    var secs = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!secs.length) return;
    var current = "";
    var desk = $(".lg-toc-desk");
    /* Fallback for very short screens: keep the active entry inside the scrollable desktop TOC (never scrolls the page) */
    var keepVisible = function (a) {
      if (!desk || !desk.contains(a) || desk.scrollHeight <= desk.clientHeight + 1) return;
      var tr = desk.getBoundingClientRect(), ar = a.getBoundingClientRect(), pad = 14;
      if (ar.top < tr.top + pad) desk.scrollTop -= tr.top + pad - ar.top;
      else if (ar.bottom > tr.bottom - pad) desk.scrollTop += ar.bottom - (tr.bottom - pad);
    };
    var mark = function (id) {
      if (id === current) return;
      current = id;
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        a.classList.toggle("is-active", on);
        if (on) { a.setAttribute("aria-current", "location"); keepVisible(a); } else a.removeAttribute("aria-current");
      });
    };
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      for (var i = 0; i < secs.length; i++) { if (visible[secs[i].id]) { mark(secs[i].id); return; } }
    }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });
    secs.forEach(function (s) { io.observe(s); });

    var bar = $("[data-lg-progress]");
    var body = $(".lg-body");
    if (bar && body) {
      bar.hidden = false;
      var fill = bar.firstElementChild;
      var tick = false;
      var upd = function () {
        tick = false;
        var r = body.getBoundingClientRect();
        var total = r.height - window.innerHeight * 0.5;
        var k = total > 0 ? Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.25) / total)) : 1;
        if (fill) fill.style.transform = "scaleX(" + k.toFixed(3) + ")";
      };
      window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
      upd();
    }
  }
})();
