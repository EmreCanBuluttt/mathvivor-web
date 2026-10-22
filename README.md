# mathvivor.com

Static website for **Mathvivor — Connecting People**. No framework, no build dependencies beyond Python 3.

```
content/<slug>.html    page bodies (inner HTML of <main>)
content/pages.json     pages, menu, side dock, footer links, per-page CSS/JS
templates/page.html    shared layout (head, header, dock, footer, icon sprite)
build.py               content + template -> docs/ (sitemap, robots, checks)
docs/                  published site (GitHub Pages, custom domain www.mathvivor.com)
tools/smoke.mjs        headless Chrome smoke test + screenshots for the local preview
```

```bash
python3 build.py --check
```

## Editing without a build

- Contact details: `docs/assets/js/config.js` (phones, WhatsApp number, e-mail, optional form endpoint).
  Empty values hide the matching buttons and rows automatically.
- Events: `docs/assets/data/etkinlikler.js` (the calendar page shows a "coming soon" state while it is empty).

Design system and component guide: `DESIGN.md`.
