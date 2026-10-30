#!/usr/bin/env node
// Bouwt de statische pagina's (index.html, en/index.html, sitemap.xml) uit content/*.json.
// Geen afhankelijkheden: alleen Node. Gebruik: node build.mjs
//
// Een taal toevoegen:
//   1. voeg een regel toe aan content/languages.json
//   2. voeg een blok toe in content/ui.json en content/home.json
//   3. voeg per gebeurtenis in content/timeline.json een blok met de taalcode toe
// Daarna opnieuw bouwen. Er hoeft niets in de templates te veranderen.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const cfg = read("content/languages.json");
const ui = read("content/ui.json");
const home = read("content/home.json");
const events = read("content/timeline.json");

const EMAIL = "mail@martinvankaam.nl";
const LINKEDIN = "https://www.linkedin.com/in/martinvankaam";
const INSTAGRAM = "https://www.instagram.com/martinvankaam";
const MARBAS = "https://www.marbas.nl";

// Volgorde en kleur van de categorieen staan in site.css (--cat-<naam>).
const CATEGORY_ORDER = ["career", "education", "travel", "sport", "motors", "life"];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fileHash = (rel) => createHash("md5").update(readFileSync(join(root, rel))).digest("hex").slice(0, 8);
const CSS_V = fileHash("assets/site.css");
const JS_V = fileHash("assets/site.js");

// Afmetingen van een JPEG lezen zodat width/height op de img staan (geen layoutsprong).
function jpegSize(rel) {
  const buf = readFileSync(join(root, rel));
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("Geen JPEG-afmetingen in " + rel);
}

function img(name, alt, { sizes, eager = false, cls = "" } = {}) {
  const full = `assets/${name}.jpg`;
  const small = `assets/${name}-sm.jpg`;
  const { w, h } = jpegSize(full);
  const srcset = existsSync(join(root, small)) ? ` srcset="/${small} 800w, /${full} ${w}w"` : "";
  const sz = srcset ? ` sizes="${sizes || "100vw"}"` : "";
  const load = eager ? ` fetchpriority="high"` : ` loading="lazy" decoding="async"`;
  const c = cls ? ` class="${cls}"` : "";
  return `<img${c} src="/${full}"${srcset}${sz} width="${w}" height="${h}" alt="${esc(alt)}"${load}>`;
}

function formatDate(ev, lang, locale) {
  const tz = { timeZone: "UTC" };
  const [y, m, d] = ev.date.split("-");
  if (ev.precision === "range") return { label: `${y}–${ev.dateEnd}`, iso: y };
  if (ev.precision === "year") return { label: y, iso: y };
  const dt = new Date(Date.UTC(+y, +(m || 1) - 1, +(d || 1)));
  if (ev.precision === "month") {
    return { label: new Intl.DateTimeFormat(locale, { ...tz, month: "long", year: "numeric" }).format(dt), iso: `${y}-${m}` };
  }
  return { label: new Intl.DateTimeFormat(locale, { ...tz, day: "numeric", month: "long", year: "numeric" }).format(dt), iso: ev.date };
}

const sortKey = (ev) => {
  const [y, m = "00", d = "00"] = ev.date.split("-");
  return `${y}-${m}-${d}`;
};

function page(lang) {
  const L = cfg.languages.find((l) => l.code === lang);
  const U = ui[lang];
  const H = home[lang];
  const url = cfg.site + L.path;
  const other = cfg.languages.filter((l) => l.code !== lang);

  const sorted = [...events].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const present = CATEGORY_ORDER.filter((c) => events.some((e) => e.categories.includes(c)));
  const countBy = (c) => events.filter((e) => e.categories.includes(c)).length;

  const alternates = cfg.languages
    .map((l) => `<link rel="alternate" hreflang="${l.code}" href="${cfg.site}${l.path}">`)
    .join("\n")
    + `\n<link rel="alternate" hreflang="x-default" href="${cfg.site}${cfg.languages.find((l) => l.code === cfg.default).path}">`;

  const ogAlt = other.map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`).join("\n");

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: H.hero.name,
    url,
    image: `${cfg.site}/assets/og.jpg`,
    jobTitle: U.meta.jobTitle,
    description: U.meta.description,
    inLanguage: lang,
    worksFor: { "@type": "Organization", name: "Marbas", url: MARBAS },
    email: `mailto:${EMAIL}`,
    sameAs: [LINKEDIN, INSTAGRAM],
  };

  const langSwitch = other
    .map((l) => `<a class="lang" href="${l.path}" hreflang="${l.code}" lang="${l.code}" title="${esc(U.language.switchTo)}" aria-label="${esc(U.language.switchTo)}">${l.short}</a>`)
    .join("");

  const buildings = H.buildings.items
    .map(
      (b) => `
        <li class="building">
          <div class="b-media">${img(b.image, b.imageAlt, { sizes: "(min-width: 900px) 360px, 100vw" })}</div>
          <h4>${esc(b.name)}</h4>
          <p class="b-place">${esc(b.place)}</p>
          <p>${esc(b.text)}</p>
        </li>`
    )
    .join("");

  const filters = `
      <div class="filters" id="filters" hidden data-count="${esc(U.timeline.count)}">
        <div class="chips" role="group" aria-label="${esc(U.timeline.filterLabel)}">
          <button type="button" class="chip" data-cat="all" aria-pressed="true">${esc(U.timeline.all)}</button>
          ${present
            .map(
              (c) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="false"><span class="dot cat-${c}" aria-hidden="true"></span>${esc(U.categories[c])}<span class="n"> (${countBy(c)})</span></button>`
            )
            .join("\n          ")}
        </div>
        <p class="count" id="tl-count" role="status" aria-live="polite"></p>
      </div>`;

  const cards = sorted
    .map((ev) => {
      const t = ev[lang];
      const d = formatDate(ev, lang, L.locale.replace("_", "-"));
      const media = ev.image
        ? `<div class="card-media">${img(ev.image, t.imageAlt || t.title, { sizes: "(min-width: 900px) 700px, 100vw" })}</div>`
        : "";
      const tags = ev.categories
        .map((c) => `<li><span class="dot cat-${c}" aria-hidden="true"></span>${esc(U.categories[c])}</li>`)
        .join("");
      const planned = ev.status === "planned" ? `<span class="planned">${esc(U.timeline.planned)}</span>` : "";
      let more = "";
      if (t.more || ev.gallery) {
        const gallery = ev.gallery
          ? `<ul class="gallery">${ev.gallery
              .map((g, i) => `<li>${img(g, (t.gallery && t.gallery[i]) || t.title, { sizes: "(min-width: 900px) 220px, 50vw" })}</li>`)
              .join("")}</ul>`
          : "";
        more = `
          <details>
            <summary>${esc(U.timeline.more)}</summary>
            ${t.more ? `<p>${esc(t.more)}</p>` : ""}
            ${gallery}
          </details>`;
      }
      return `
        <li class="tl-item cat-${ev.categories[0]}" id="${ev.id}" data-categories="${ev.categories.join(" ")}">
          <article class="card${ev.image ? " has-media" : ""}">
            ${media}
            <div class="card-body">
              <div class="meta">
                <time datetime="${d.iso}">${esc(d.label)}</time>
                <ul class="tags">${tags}</ul>
                ${planned}
              </div>
              <h3>${esc(t.title)}</h3>
              <p>${esc(t.summary)}</p>${more}
            </div>
          </article>
        </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(U.meta.title)}</title>
<meta name="description" content="${esc(U.meta.description)}">
<link rel="canonical" href="${url}">
${alternates}
<link rel="icon" href="/assets/mb.svg" type="image/svg+xml">
<meta name="theme-color" content="#f5f2ec">
<meta property="og:title" content="${esc(U.meta.ogTitle)}">
<meta property="og:description" content="${esc(U.meta.ogDescription)}">
<meta property="og:type" content="profile">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${L.locale}">
${ogAlt}
<meta property="og:image" content="${cfg.site}/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(U.meta.ogImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(U.meta.ogTitle)}">
<meta name="twitter:description" content="${esc(U.meta.ogDescription)}">
<meta name="twitter:image" content="${cfg.site}/assets/og.jpg">
<link rel="preload" href="/assets/fonts/dmsans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=${CSS_V}">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body>
<a class="skip" href="#main">${esc(U.skip)}</a>

<header class="top">
  <div class="wrap bar">
    <a class="brand" href="${L.path}">${esc(H.hero.name)}</a>
    <nav aria-label="${esc(U.nav.label)}">
      <ul>
        <li><a href="#work">${esc(U.nav.work)}</a></li>
        <li><a href="#timeline">${esc(U.nav.timeline)}</a></li>
        <li class="hide-sm"><a href="#acquisition">${esc(U.nav.acquisition)}</a></li>
        <li><a href="#contact">${esc(U.nav.contact)}</a></li>
      </ul>
    </nav>
    <div class="langs" aria-label="${esc(U.language.label)}">${langSwitch}</div>
  </div>
</header>

<main id="main">

  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-text">
        <p class="kicker">${esc(H.hero.kicker)}</p>
        <h1>${esc(H.hero.name).replace(" van ", " van\u00a0")}</h1>
        <p class="lead">${esc(H.hero.lead)}</p>
        <p class="sub">${esc(H.hero.sub)}</p>
        <p class="cta">
          <a class="btn primary" href="#contact">${esc(H.hero.ctaContact)}</a>
          <a class="btn" href="#timeline">${esc(H.hero.ctaTimeline)}</a>
        </p>
      </div>
      <div class="hero-photo">
        ${img("hero", H.hero.imageAlt, { sizes: "(min-width: 900px) 480px, 100vw", eager: true })}
      </div>
    </div>
  </section>

  <section id="work" class="block">
    <div class="wrap two">
      <div>
        <h2>${esc(H.work.title)}</h2>
      </div>
      <div class="prose">
        ${H.work.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n        ")}
        <dl class="facts">
          ${H.work.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("\n          ")}
        </dl>
      </div>
    </div>
    <div class="wrap">
      <h3 class="sub-h">${esc(H.buildings.title)}</h3>
      <p class="muted">${esc(H.buildings.intro)}</p>
      <ul class="buildings">${buildings}
      </ul>
      <p class="muted">${esc(H.buildings.link)} <a href="${MARBAS}" rel="noopener">${esc(H.buildings.linkText)}</a>.</p>
    </div>
  </section>

  <section id="timeline" class="block alt">
    <div class="wrap">
      <h2>${esc(H.timeline.title)}</h2>
      <p class="lead-sm">${esc(H.timeline.lead)}</p>
${filters}
      <ol class="timeline" id="timeline-list">${cards}
      </ol>
      <p class="muted">${esc(H.timeline.note)}</p>
    </div>
  </section>

  <section id="acquisition" class="block">
    <div class="wrap two">
      <div>
        <h2>${esc(H.acquisition.title)}</h2>
        <p class="lead-sm">${esc(H.acquisition.lead)}</p>
      </div>
      <div>
        <dl class="criteria">
          <div><dt>${esc(H.acquisition.entryLabel)}</dt><dd>${esc(H.acquisition.entryValue)}</dd></div>
          <div><dt>${esc(H.acquisition.focusLabel)}</dt><dd>${esc(H.acquisition.focusValue)}</dd></div>
        </dl>
        <h3 class="sub-h">${esc(H.acquisition.listTitle)}</h3>
        <ul class="plain">
          ${H.acquisition.list.map((i) => `<li>${esc(i)}</li>`).join("\n          ")}
        </ul>
        <p>${esc(H.acquisition.closing)}</p>
      </div>
    </div>
  </section>

  <section id="contact" class="block dark">
    <div class="wrap">
      <h2>${esc(H.contact.title)}</h2>
      <p class="lead-sm">${esc(H.contact.lead)}</p>
      <p><a class="mail" href="mailto:${EMAIL}">${EMAIL}</a></p>
      <p class="actions" data-mail="${EMAIL}" data-copied="${esc(U.mail.copied)}" data-copy-label="${esc(U.mail.copy)}" data-copy-prompt="${esc(U.mail.copyPrompt)}">
        <a class="btn light" href="mailto:${EMAIL}">${esc(U.mail.openMail)}</a>
        <a class="btn ghost" data-app="gmail" href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=${EMAIL}" target="_blank" rel="noopener">${esc(U.mail.openGmail)}</a>
        <a class="btn ghost" data-app="outlook" href="https://outlook.office.com/mail/deeplink/compose?to=${EMAIL}" target="_blank" rel="noopener">${esc(U.mail.openOutlook)}</a>
        <button class="btn ghost" type="button" id="copy">${esc(U.mail.copy)}</button>
      </p>
      <p class="actions">
        <a class="btn ghost" href="${LINKEDIN}" rel="me noopener">${esc(H.contact.linkedin)}</a>
        <a class="btn ghost" href="${INSTAGRAM}" rel="me noopener">${esc(H.contact.instagram)}</a>
      </p>
    </div>
  </section>

</main>

<footer>
  <div class="wrap foot">
    <span>${esc(U.footer.rights)}</span>
    <span>${esc(U.footer.role)} <a href="${MARBAS}" rel="noopener">Marbas</a></span>
  </div>
</footer>

<script src="/assets/site.js?v=${JS_V}" defer></script>
</body>
</html>
`;
}

// Pagina's schrijven
for (const l of cfg.languages) {
  const rel = l.path === "/" ? "index.html" : join(l.path.replace(/^\/|\/$/g, ""), "index.html");
  const out = join(root, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page(l.code));
  console.log("geschreven:", rel);
}

// Sitemap met taalalternatieven
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${cfg.languages
  .map(
    (l) => `  <url>
    <loc>${cfg.site}${l.path}</loc>
    <lastmod>${today}</lastmod>
${cfg.languages.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${cfg.site}${a.path}"/>`).join("\n")}
  </url>`
  )
  .join("\n")}
</urlset>
`;
writeFileSync(join(root, "sitemap.xml"), sitemap);
console.log("geschreven: sitemap.xml");
