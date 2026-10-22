# Mathvivor — design system ("ARENA")

Static site. `content/<slug>.html` holds ONLY the inner HTML of `<main>`; `templates/page.html` adds head,
header (logo + nav + burger), side dock (Takvim / Galeri / Sponsorluk / Ölçme), floating WhatsApp button,
footer and the SVG icon sprite. `python3 build.py --check` writes `docs/` and validates links, anchors,
icons, duplicate ids, one `<h1>` per page, `alt` on every `<img>`, no HTML comments shipped.
Page-specific CSS/JS are declared per page in `content/pages.json` (`css`, `js`) and loaded after the
global files (`fonts.css`, `site.css`, `config.js`, `main.js` — all `defer`, executed in order).

## Look
Dark sports arena: ink/navy base, logo red, gold, yellow call-to-action, chalk-white text, hand-written
chalk formulas, condensed italic display type like jersey lettering and scoreboards. Energetic, playful,
but clean — generous spacing, strong hierarchy, big type.

Tokens (`:root` in `site.css`): `--ink #070b16`, `--ink-2`, `--navy #0d1a36`, `--navy-2 #13254a`,
`--navy-3`, `--red #d6111c`, `--red-2`, `--gold #e0a93b`, `--gold-2 #f6cf6b`, `--yellow #ffcd1f`,
`--chalk #f4efe4`, `--chalk-dim`, `--chalk-faint`, `--grass`, `--sky`, `--line`;
fonts `--display` (Barlow Condensed 600/700/800 + 800 italic), `--body` (Manrope 400–800), `--hand`
(Caveat 500–700); `--r 18px`, `--r-sm`, `--ease`, `--spring`, `--shadow`, `--glow-gold`,
`--container 1240px`, `--gutter`, `--section-y`, `--header-h 76px`.
Headings are uppercase display type; h1/h2 italic. Body text is Manrope 17px.

## Components (site.css)
- Layout: `.container`, `.narrow`, `.section` (+ `--tight`, `--navy`, `--chalk` light paper section,
  `--red`), `.grid` + `.g-2/.g-3/.g-4`, `.split` (2 columns → 1 on ≤900px), `.center`, `.lead`.
- Section heading: `<span class="kicker" data-no="02">Eyebrow</span>` → red jersey-number badge + gold
  eyebrow. Omit `data-no` for a plain eyebrow. `.hand` = chalk handwriting accent, `.mark-yellow`, `.mark-red`.
- Inner page hero:
  ```html
  <section class="page-hero">
    <img src="assets/img/galeri/<slug>.webp" alt="" width="1600" height="900">  <!-- optional, dimmed -->
    <div class="chalk-bg"></div>
    <div class="container">
      <ol class="crumbs"><li><a href="index.html">Ana Sayfa</a></li><li aria-current="page">Sayfa</li></ol>
      <span class="kicker" data-no="01">Eyebrow</span>
      <h1>Başlık <span class="mark-yellow">vurgulu</span></h1>
      <p class="lead">…</p>
    </div>
  </section>
  ```
- `.chalk-bg` (empty div; main.js fills it with faint chalk formulas; optional `data-formulas="a|b|c"`,
  `data-count="9"`). Parent must be positioned (`.section`, `.page-hero` already are).
- Buttons: `.btn` (yellow), `.btn--red`, `.btn--ghost`, `.btn--wa` (WhatsApp green); `.btn-row` wrapper.
  Icon inside a button: `<svg aria-hidden="true"><use href="#i-arrow"/></svg>`.
- `.card` (+ `.icon` tile with an svg inside, h3, p), `.card--photo` (img + `.card-body`).
- `.shout` giant italic slogan (`<em>` turns yellow), `.quote` (red left rule), `.chips` (pill list),
  `.ticks` (red check list), `.prose` (long text).
- `.frame` (rounded media box), `.frame--tilt`, `.tape` (yellow tape strip on a photo).
- `.cta` red call-to-action band: `<div class="cta"><div><h2>…</h2><p>…</p></div><div class="btn-row">…</div></div>`.
- `.ticker > .ticker-track > span*` yellow slogan marquee (main.js duplicates the spans).
- Reveal on scroll: add `.reveal` to elements; put `.stagger` on the parent for cascading delays.
- Count-up: `<span data-count-to="17">17</span>`.

## Icons (sprite in the template — use `<svg aria-hidden="true"><use href="#i-NAME"/></svg>`)
calendar, gallery, trophy, gauge, whatsapp, phone, mail, download, arrow, play, close, chevron, check,
team, move, share, brain, compass, bolt, ball, star, target, clock, puzzle, shield, scale, cube, chat,
flag, heart, megaphone, book, hand. Size them with CSS (width/height); stroke uses currentColor.

## JS helpers (main.js, global `window.MV`)
- `MV.contact` → `{ phones: [...], whatsapp: "90…", email: "", formEndpoint: "" }` from `assets/js/config.js`.
- `MV.waLink(text)` → `https://wa.me/<num>?text=…` or `""` when no WhatsApp number.
- `MV.confetti(x, y, n)` — celebratory burst at viewport coordinates (no-op with reduced motion).
- Declarative contact hooks (filled by main.js): `[data-contact-phones]` (all phones as tel links),
  `<a data-phone="0"><span data-phone-text></span></a>`, `<a data-whatsapp="prefilled text" hidden>`
  (shown only when a number exists), `<a data-email>` + `[data-email-row]` (hidden while email is empty),
  `[data-contact-only]` / `[data-contact-empty]`.
- Page scripts are `defer` and run after main.js. Wrap in an IIFE, `"use strict"`, no globals except a
  documented one, no frameworks, no external requests, respect `prefers-reduced-motion`, keyboard and
  touch accessible, no console errors when the page's markup is absent.

## Images (client material — the only photos to use)
`docs/assets/img/galeri/<slug>.webp` (1600px), `<slug>-k.webp` (720px), `<slug>.jpg` (1600px). Use
`srcset="assets/img/galeri/<slug>-k.webp 720w, assets/img/galeri/<slug>.webp 1600w"` + `sizes`, `width`/
`height` attributes with the real aspect, `loading="lazy"` below the fold, `decoding="async"`.
Slugs, sizes (original aspect) and alt text are in `kaynak/galeri.json`. Posters (`afis-*`) are portrait
and contain their own text — show them whole (no cropping) and never as a background behind text.
Logo: `assets/img/marka/logo-160.png|logo-320.png|logo-640.png` (640×503). Logo PDF: `assets/mathvivor-logo.pdf`.

## Content rules
- Turkish copy (UI and content); code/comments in English. Use the client's brief wording
  (`kaynak/brief-connecting-people.txt`) — do not invent facts, numbers, clients, testimonials, prices,
  dates, awards, durations, capacities or participant counts. Fun microcopy and UI labels are fine.
- No street address anywhere. Contact only through the config hooks above.
- Words written in English inside Turkish text with uppercase styling need `lang="en"`
  (e.g. `<span lang="en">CONNECTING PEOPLE</span>`), otherwise "i" renders as "İ".
- Mobile first: works from 360px wide; the dock becomes a bottom bar ≤760px (body gets 70px bottom
  padding), the burger menu appears ≤1080px. No horizontal scroll.
