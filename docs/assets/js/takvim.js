/* Mathvivor — event calendar page.
   Reads window.MATHVIVOR_EVENTS (assets/data/etkinlikler.js). Empty list -> "yakında" scoreboard.
   Otherwise: upcoming fixtures with date tiles, type filter chips, collapsed past events and a
   client-side .ics ("Takvime ekle") per event. Safe to run twice: it rebuilds its own output. */
(function () {
  "use strict";
  var root = document.querySelector("[data-takvim]");
  if (!root) return;
  var q = function (s) { return root.querySelector(s); };
  var empty = q("[data-tk-empty]"), listWrap = q("[data-tk-list]"), upEl = q("[data-tk-upcoming]");
  var filtersEl = q("[data-tk-filters]"), countEl = q("[data-tk-count]");
  var pastEl = q("[data-tk-past]"), pastList = q("[data-tk-past-list]"), pastN = q("[data-tk-past-n]");
  var statusEl = q("[data-tk-status]"), clock = q("[data-tk-clock]");
  if (!empty || !listWrap || !upEl) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  var TYPE_ORDER = ["Festival", "Okul", "AVM", "Kurumsal", "Kamp"];
  var DAY = 86400000;

  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var str = function (v) { return v == null ? "" : String(v).trim(); };
  var h = function (tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };
  var icon = function (name) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#i-" + name);
    svg.appendChild(use);
    return svg;
  };

  /* ---------- scoreboard clock (empty state) ---------- */
  if (clock) {
    if (clock.__arTimer) clearInterval(clock.__arTimer);
    var tick = function () {
      var d = new Date();
      clock.textContent = "";
      clock.appendChild(document.createTextNode(pad(d.getHours())));
      clock.appendChild(h("i", { text: ":" }));
      clock.appendChild(document.createTextNode(pad(d.getMinutes())));
    };
    tick();
    clock.__arTimer = setInterval(tick, 15000);
  }

  /* ---------- data ---------- */
  var parse = function (s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str(s));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) || d.getMonth() !== +m[2] - 1 ? null : d;
  };
  var safeLink = function (v) {
    v = str(v);
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-z0-9-]+\.html(#[\w-]+)?$/i.test(v)) return v;
    return "";
  };
  var raw = Array.isArray(window.MATHVIVOR_EVENTS) ? window.MATHVIVOR_EVENTS : [];
  var events = raw.map(function (e, i) {
    if (!e || typeof e !== "object") return null;
    var start = parse(e.tarih), title = str(e.baslik);
    if (!start || !title) return null;
    var end = parse(e.bitis);
    if (!end || end < start) end = start;
    return { i: i, start: start, end: end, title: title, place: str(e.yer), type: str(e.tur), desc: str(e.aciklama), link: safeLink(e.link) };
  }).filter(Boolean);

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var upcoming = events.filter(function (e) { return e.end >= today; }).sort(function (a, b) { return a.start - b.start || a.i - b.i; });
  var past = events.filter(function (e) { return e.end < today; }).sort(function (a, b) { return b.start - a.start; });

  /* ---------- formatting ---------- */
  var sameDay = function (a, b) { return a.getTime() === b.getTime(); };
  var longDate = function (e) {
    var s = e.start, en = e.end;
    if (sameDay(s, en)) return s.getDate() + " " + AY[s.getMonth()] + " " + s.getFullYear() + ", " + GUN[s.getDay()];
    if (s.getFullYear() === en.getFullYear() && s.getMonth() === en.getMonth())
      return s.getDate() + "–" + en.getDate() + " " + AY[s.getMonth()] + " " + s.getFullYear();
    if (s.getFullYear() === en.getFullYear())
      return s.getDate() + " " + AY[s.getMonth()] + " – " + en.getDate() + " " + AY[en.getMonth()] + " " + s.getFullYear();
    return s.getDate() + " " + AY[s.getMonth()] + " " + s.getFullYear() + " – " + en.getDate() + " " + AY[en.getMonth()] + " " + en.getFullYear();
  };
  var whenLabel = function (e) {
    if (e.start <= today && e.end >= today) return { text: sameDay(e.start, e.end) ? "Bugün" : "Devam ediyor", live: true };
    var days = Math.round((e.start - today) / DAY);
    if (days === 1) return { text: "Yarın", live: false };
    return { text: days + " gün kaldı", live: false };
  };

  /* ---------- .ics (client-side, all-day events) ---------- */
  var ymd = function (d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };
  var slug = function (s) {
    var map = { "ç": "c", "ğ": "g", "ı": "i", "i̇": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
    return s.toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, function (c) { return map[c] || c; })
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "etkinlik";
  };
  var esc = function (s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); };
  var fold = function (line) {
    var enc = window.TextEncoder ? new TextEncoder() : null;
    var size = function (c) { return enc ? enc.encode(c).length : (c.charCodeAt(0) > 127 ? 3 : 1); };
    var out = [], cur = "", bytes = 0, limit = 75;
    Array.from(line).forEach(function (c) {
      var b = size(c);
      if (bytes + b > limit) { out.push(cur); cur = " "; bytes = 1; limit = 75; }
      cur += c; bytes += b;
    });
    out.push(cur);
    return out.join("\r\n");
  };
  var buildIcs = function (e) {
    var d = new Date();
    var stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
    var endEx = new Date(e.end.getFullYear(), e.end.getMonth(), e.end.getDate() + 1);
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mathvivor//Etkinlik Takvimi//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + ymd(e.start) + "-" + slug(e.title) + "@mathvivor.com",
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + ymd(e.start),
      "DTEND;VALUE=DATE:" + ymd(endEx),
      "SUMMARY:" + esc(e.title)
    ];
    if (e.place) lines.push("LOCATION:" + esc(e.place));
    var desc = [e.desc, e.type ? "Tür: " + e.type : ""].filter(Boolean).join("\n");
    if (desc) lines.push("DESCRIPTION:" + esc(desc));
    if (e.link) { try { lines.push("URL:" + new URL(e.link, location.href).href); } catch (err) {} }
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  };
  var download = function (e, btn) {
    var file = "mathvivor-" + slug(e.title) + "-" + ymd(e.start) + ".ics";
    var blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: file, hidden: true });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
    if (statusEl) statusEl.textContent = "“" + e.title + "” için takvim dosyası indirildi.";
    if (btn) {
      var label = btn.querySelector("[data-label]");
      btn.classList.add("is-done");
      if (label) label.textContent = "İndirildi";
      clearTimeout(btn.__arT);
      btn.__arT = setTimeout(function () { btn.classList.remove("is-done"); if (label) label.textContent = "Takvime ekle"; }, 2600);
      if (window.MV && MV.confetti && !reduce) {
        var r = btn.getBoundingClientRect();
        MV.confetti(r.left + r.width / 2, r.top + r.height / 2, 18);
      }
    }
  };

  /* ---------- render ---------- */
  var card = function (e, isNext) {
    var s = e.start, en = e.end, multi = !sameDay(s, en), sameMonth = multi && s.getMonth() === en.getMonth() && s.getFullYear() === en.getFullYear();
    var monthText = AY[s.getMonth()] + (s.getFullYear() !== now.getFullYear() ? " " + s.getFullYear() : "");
    var dayEl = h("span", { class: "ar-date-d" }, [String(s.getDate())]);
    if (sameMonth) dayEl.appendChild(h("small", { text: "–" + en.getDate() }));
    var tile = h("div", { class: "ar-date", "aria-hidden": "true" }, [
      h("span", { class: "ar-date-m", text: monthText }),
      dayEl,
      multi && !sameMonth ? h("span", { class: "ar-date-range", text: "→ " + en.getDate() + " " + AY[en.getMonth()] }) : null,
      h("span", { class: "ar-date-w", text: GUN[s.getDay()] })
    ]);
    var when = whenLabel(e);
    var meta = h("div", { class: "ar-ev-meta" }, [
      e.type ? h("span", { class: "ar-badge", text: e.type }) : null,
      h("span", { class: "ar-badge ar-badge--when" + (when.live ? " ar-badge--live" : ""), text: when.text })
    ]);
    var body = h("div", { class: "ar-ev-body" }, [
      meta,
      h("h3", { text: e.title }),
      h("p", { class: "sr-only" }, [h("time", { datetime: ymd(s).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), text: longDate(e) })]),
      e.place ? h("p", { class: "ar-ev-place" }, [icon("compass"), h("span", { text: e.place })]) : null,
      e.desc ? h("p", { class: "ar-ev-desc", text: e.desc }) : null
    ]);
    var add = h("button", { type: "button", class: "ar-btn-sm", "aria-label": "Takvime ekle: " + e.title }, [icon("calendar"), h("span", { "data-label": true, text: "Takvime ekle" })]);
    add.addEventListener("click", function () { download(e, add); });
    var actions = h("div", { class: "ar-ev-actions" }, [add]);
    if (e.link) {
      var ext = /^https?:/i.test(e.link);
      actions.appendChild(h("a", { class: "ar-btn-sm ar-btn-sm--ghost", href: e.link, target: ext ? "_blank" : null, rel: ext ? "noopener" : null, "aria-label": "Ayrıntılar: " + e.title }, ["Ayrıntılar", icon("arrow")]));
    }
    var wa = window.MV && MV.waLink ? MV.waLink("Merhaba, “" + e.title + "” (" + longDate(e) + ") etkinliği hakkında bilgi almak istiyorum.") : "";
    if (wa) actions.appendChild(h("a", { class: "ar-btn-sm ar-btn-sm--wa", href: wa, target: "_blank", rel: "noopener", "aria-label": "WhatsApp ile sor: " + e.title }, [icon("whatsapp"), "Sor"]));
    var li = h("li", { class: "ar-ev" + (isNext ? " is-next" : ""), "data-tur": e.type }, [tile, body, actions]);
    return li;
  };

  upEl.textContent = "";
  if (filtersEl) filtersEl.textContent = "";
  if (pastList) pastList.textContent = "";

  var hasUpcoming = upcoming.length > 0;
  empty.hidden = hasUpcoming;
  listWrap.hidden = !hasUpcoming;
  root.setAttribute("aria-labelledby", hasUpcoming ? "etkinlikler-liste-baslik" : "etkinlikler-baslik");

  if (hasUpcoming) {
    var items = upcoming.map(function (e, i) { return card(e, i === 0); });
    items.forEach(function (li) { upEl.appendChild(li); });

    var setCount = function (n) { if (countEl) countEl.textContent = n + " etkinlik"; };
    setCount(items.length);

    var types = [];
    upcoming.forEach(function (e) { if (e.type && types.indexOf(e.type) < 0) types.push(e.type); });
    types.sort(function (a, b) {
      var ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "tr");
    });
    if (filtersEl) {
      filtersEl.hidden = types.length < 2;
      if (types.length >= 2) {
        var chips = [];
        var apply = function (type) {
          var shown = 0;
          items.forEach(function (li, i) {
            var match = !type || upcoming[i].type === type;
            li.hidden = !match;
            li.classList.remove("is-pop");
            if (match) {
              if (!reduce) { li.style.setProperty("--d", Math.min(shown * 60, 300) + "ms"); void li.offsetWidth; li.classList.add("is-pop"); }
              shown++;
            }
          });
          chips.forEach(function (c) { c.setAttribute("aria-pressed", String((c.getAttribute("data-type") || "") === (type || ""))); });
          setCount(shown);
        };
        var mk = function (label, type, n) {
          var b = h("button", { type: "button", class: "ar-chip", "aria-pressed": type ? "false" : "true", "data-type": type || "" }, [label + " ", h("span", { class: "ar-chip-n", text: String(n) })]);
          b.addEventListener("click", function () { if (b.getAttribute("aria-pressed") !== "true") apply(type); });
          chips.push(b);
          filtersEl.appendChild(b);
        };
        mk("Tümü", "", upcoming.length);
        types.forEach(function (t) { mk(t, t, upcoming.filter(function (e) { return e.type === t; }).length); });
        items.forEach(function (li) { li.addEventListener("animationend", function () { li.classList.remove("is-pop"); }); });
      }
    }
  }

  if (pastEl && pastList) {
    pastEl.hidden = !past.length;
    if (pastN) pastN.textContent = past.length ? "(" + past.length + ")" : "";
    past.forEach(function (e) {
      pastList.appendChild(h("li", null, [
        h("span", { class: "ar-past-date" }, [h("time", { datetime: ymd(e.start).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), text: longDate(e).replace(/, \S+$/, "") })]),
        h("span", { class: "ar-past-title" }, [e.title, e.place ? h("small", { text: e.place }) : null]),
        e.type ? h("span", { class: "ar-badge", text: e.type }) : h("span")
      ]));
    });
  }
})();
