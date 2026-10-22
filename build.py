#!/usr/bin/env python3
"""
Mathvivor — static site builder.

  python3 build.py            # content/*.html + templates/page.html -> docs/*.html (+ sitemap, robots)
  python3 build.py --check    # build, then validate links/images/anchors (exit 1 on problems)

Pages, navigation, dock buttons and site metadata live in content/pages.json.
Each content/<slug>.html holds ONLY the inner HTML of <main>.
A page may list extra stylesheets/scripts in pages.json ("css": [...], "js": [...]).
"""
import json, re, sys, pathlib, html, datetime

ROOT = pathlib.Path(__file__).resolve().parent
CONTENT = ROOT / "content"
SITE = ROOT / "docs"
TEMPLATE = (ROOT / "templates" / "page.html").read_text(encoding="utf-8")
CFG = json.loads((CONTENT / "pages.json").read_text(encoding="utf-8"))
S = CFG["site"]
BUILD = datetime.datetime.now().strftime("%Y%m%d%H%M")
HIDDEN = {f"{p['slug']}.html" for p in CFG["pages"] if p.get("hidden")}


def base(href):
    return href.split("#")[0]


def visible(href):
    return base(href) not in HIDDEN


def label(text):
    # brand name is English: keep uppercase styling from turning its "i" into a Turkish dotted "İ"
    # wrapped in one span so flex containers (nav links) keep the space between the words
    t = html.escape(text)
    return f'<span>{t.replace("Mathvivor", "<span lang=\"en\">Mathvivor</span>")}</span>' if "Mathvivor" in t else t


def current(href, slug):
    return ' aria-current="page"' if base(href) == f"{slug}.html" else ""


def render_nav(slug):
    out = ['<nav class="nav" id="site-nav" aria-label="Ana menü">', "  <ul>"]
    for item in CFG["nav"]:
        if not visible(item["href"]):
            continue
        cls = ' class="nav-cta"' if item.get("cta") else ""
        out.append(f'    <li><a{cls} href="{item["href"]}"{current(item["href"], slug)}>{label(item["label"])}</a></li>')
    out += ["  </ul>", "</nav>"]
    return "\n".join(out)


def render_dock(slug):
    out = ['<nav class="dock" aria-label="Hızlı erişim">']
    for item in CFG["dock"]:
        if not visible(item["href"]):
            continue
        short = item.get("short", item["label"])
        label = (f'<span class="dock-label"><span class="dock-long">{html.escape(item["label"])}</span>'
                 f'<span class="dock-short">{html.escape(short)}</span></span>')
        out.append(f'  <a href="{item["href"]}"{current(item["href"], slug)} aria-label="{html.escape(item["label"])}">'
                   f'<svg aria-hidden="true"><use href="#i-{item["icon"]}"/></svg>{label}</a>')
    out.append("</nav>")
    return "\n".join(out)


def render_footer_nav():
    out = []
    for title, items in CFG["footer_nav"].items():
        out.append(f"      <div>\n        <h4>{html.escape(title)}</h4>\n        <ul>")
        for i in [i for i in items if visible(i["href"])]:
            out.append(f'          <li><a href="{i["href"]}">{label(i["label"])}</a></li>')
        out.append("        </ul>\n      </div>")
    return "\n".join(out)


def jsonld():
    home = next(p for p in CFG["pages"] if p["slug"] == "index")
    return json.dumps({
        "@context": "https://schema.org", "@type": "Organization",
        "name": S["name"], "slogan": S["tagline"], "url": S["url"],
        "logo": S["url"].rstrip("/") + "/assets/img/marka/logo-640.png",
        "image": S["url"].rstrip("/") + "/" + S["og_image"],
        "description": home["description"], "areaServed": "TR",
        "parentOrganization": {"@type": "Organization", "name": S["partner_name"], "url": S["partner_url"]},
    }, ensure_ascii=False)


def build():
    SITE.mkdir(exist_ok=True)
    footer_nav = render_footer_nav()
    built, problems = [], []
    for page in CFG["pages"]:
        slug = page["slug"]
        if page.get("hidden"):
            continue
        src = CONTENT / f"{slug}.html"
        if not src.exists():
            problems.append(f"missing content: content/{slug}.html"); continue
        content = src.read_text(encoding="utf-8")
        content = re.sub(r"[ \t]*<!--.*?-->[ \t]*\n?", "", content, flags=re.S).rstrip() + "\n"  # maintainer notes stay in content/
        canonical = S["url"].rstrip("/") + ("/" if slug == "index" else f"/{slug}.html")
        full_title = f'{S["name"]} — {page["title"]}' if slug == "index" else f'{page["title"]} | {S["name"]}'
        page_css = "\n".join(f'<link rel="stylesheet" href="{c}?v={BUILD}">' for c in page.get("css", []))
        page_js = "\n".join(f'<script src="{j}?v={BUILD}" defer></script>' for j in page.get("js", []))
        repl = {
            "{{FULL_TITLE}}": html.escape(full_title), "{{OG_TITLE}}": html.escape(full_title),
            "{{DESCRIPTION}}": html.escape(page["description"]), "{{CANONICAL}}": canonical,
            "{{ROBOTS}}": "noindex, follow" if page.get("noindex") else "index, follow",
            "{{OG_IMAGE}}": S["url"].rstrip("/") + "/" + page.get("og_image", S["og_image"]),
            "{{SITE_NAME}}": html.escape(S["name"]), "{{PARTNER_URL}}": S["partner_url"],
            "{{BODY_CLASS}}": page.get("body_class", f"page-{slug}"),
            "{{NAV}}": render_nav(slug), "{{DOCK}}": render_dock(slug), "{{FOOTER_NAV}}": footer_nav,
            "{{PAGE_CSS}}": page_css, "{{PAGE_JS}}": page_js,
            "{{YEAR}}": str(datetime.date.today().year), "{{BUILD}}": BUILD, "{{JSONLD}}": jsonld(),
            "{{CONTENT}}": content,
        }
        out = TEMPLATE
        for k, v in repl.items():
            out = out.replace(k, v)
        out = re.sub(r"\n{3,}", "\n\n", out)
        if slug != "index":
            out = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", out, flags=re.S)
        if slug == "404":
            out = re.sub(r'\s*<link rel="canonical"[^>]*>', "", out)
            out = re.sub(r'\s*<meta property="og:url"[^>]*>', "", out)
            # GitHub Pages serves 404.html at any depth: make asset and page links root-absolute
            out = re.sub(r'(href|src|srcset)="(?!https?:|mailto:|tel:|#|/|data:)([^"]+)"', r'\1="/\2"', out)
            out = re.sub(r'(srcset="[^"]*?,\s*)(?!/)(assets/)', r'\1/\2', out)
        (SITE / f"{slug}.html").write_text(out, encoding="utf-8")
        built.append(slug)
    for old in SITE.glob("*.html"):
        if old.stem not in built:
            old.unlink()
    urls = [S["url"].rstrip("/") + ("/" if p["slug"] == "index" else f"/{p['slug']}.html")
            for p in CFG["pages"] if not p.get("noindex") and not p.get("hidden") and p["slug"] in built]
    today = datetime.date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>" for u in urls]
    sm.append("</urlset>")
    (SITE / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    (SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {S['url'].rstrip('/')}/sitemap.xml\n", encoding="utf-8")
    return built, problems


def check(built):
    problems = []
    pages = {f"{s}.html" for s in built}
    for slug in built:
        txt = (SITE / f"{slug}.html").read_text(encoding="utf-8")
        if "{{" in txt:
            problems.append(f"{slug}.html: unreplaced placeholder {{{{…}}}}")
        refs = re.findall(r'(?:href|src)="([^"]+)"', txt)
        for srcset in re.findall(r'srcset="([^"]+)"', txt):
            refs += [s.strip().split(" ")[0] for s in srcset.split(",")]
        for href in refs:
            if href.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:", "javascript:")):
                continue
            target = href.split("#")[0].split("?")[0].lstrip("/")
            if not target:
                continue
            if target.endswith(".html"):
                if target not in pages:
                    problems.append(f"{slug}.html: broken link -> {href}")
            elif not (SITE / target).exists():
                problems.append(f"{slug}.html: missing file -> {href}")
        ids = set(re.findall(r'\sid="([^"]+)"', txt))
        for anc in re.findall(r'href="#([^"]+)"', txt):
            if anc not in ids and anc != "main":
                problems.append(f"{slug}.html: missing anchor #{anc}")
        for use in re.findall(r'<use href="#([^"]+)"', txt):
            if use not in ids:
                problems.append(f"{slug}.html: missing icon #{use}")
        for tgt, anc in re.findall(r'href="([a-z0-9-]+\.html)#([^"]+)"', txt):
            if tgt in pages:
                tids = set(re.findall(r'\sid="([^"]+)"', (SITE / tgt).read_text(encoding="utf-8")))
                if anc not in tids:
                    problems.append(f"{slug}.html: missing anchor {tgt}#{anc}")
        dup = {i for i in re.findall(r'\sid="([^"]+)"', txt) if re.findall(rf'\sid="{re.escape(i)}"', txt).__len__() > 1}
        for i in sorted(dup):
            problems.append(f"{slug}.html: duplicate id #{i}")
        if "<!--" in txt:
            problems.append(f"{slug}.html: HTML comment shipped to the public page")
        h1 = len(re.findall(r"<h1[\s>]", txt))
        if h1 != 1:
            problems.append(f"{slug}.html: expected exactly one <h1>, found {h1}")
        for m in re.finditer(r"<img\b(?![^>]*\balt=)[^>]*>", txt):
            problems.append(f"{slug}.html: <img> without alt: {m.group(0)[:80]}")
    return problems


if __name__ == "__main__":
    built, problems = build()
    print(f"built {len(built)} pages -> docs/")
    if "--check" in sys.argv:
        problems += check(built)
    for p in problems:
        print("  !", p)
    sys.exit(1 if problems and "--check" in sys.argv else 0)
