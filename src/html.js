import { config } from "./config.js";
import { slotMeta, monthYear } from "./clock.js";
import { pageNonce } from "./security.js";
import { renderHomeBanner } from "./art.js";
import { TITLES } from "./titles.js";
import { SECTIONS, TOPIC_TAGS } from "./sections.js";

export { SECTIONS, TOPIC_TAGS };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function searchIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

const a11yBoot = `(function(){try{var s=JSON.parse(localStorage.getItem("spoonspring-a11y")||"null");if(!s)return;var root=document.documentElement;if(s.text&&s.text!=="100")root.dataset.a11yText=s.text;if(s.contrast&&s.contrast!=="default")root.dataset.a11yContrast=s.contrast;["links","highlight","spacing","font","guide","motion","focus","cursor","targets","gray"].forEach(function(key){if(s[key])root.dataset["a11y"+key.charAt(0).toUpperCase()+key.slice(1)]="1";});}catch(e){}})();`;

function a11yWidget() {
  return `<div id="a11y-guide" aria-hidden="true"></div>
  <div class="a11y-pop" id="a11y-pop" hidden>
    <div class="a11y-panel" role="dialog" aria-modal="true" aria-labelledby="a11y-title">
      <header class="a11y-head">
        <h2 id="a11y-title">Accessibility</h2>
        <button type="button" data-a11y-close aria-label="Close">×</button>
      </header>
      <p class="a11y-note">These settings stay in this browser.</p>
      <fieldset>
        <legend>Text size</legend>
        <div class="a11y-size">
          <button type="button" data-a11y-step="down" aria-label="Smaller text">A−</button>
          <span id="a11y-text-value" aria-live="polite">100%</span>
          <button type="button" data-a11y-step="up" aria-label="Larger text">A+</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Contrast</legend>
        <label><input type="radio" name="a11y-contrast" value="default"> Default</label>
        <label><input type="radio" name="a11y-contrast" value="high"> High contrast</label>
        <label><input type="radio" name="a11y-contrast" value="dark"> Dark</label>
        <label><input type="radio" name="a11y-contrast" value="invert"> Inverted</label>
      </fieldset>
      <fieldset>
        <legend>Links and color</legend>
        <label><input type="checkbox" data-a11y-toggle="links"> Underline links</label>
        <label><input type="checkbox" data-a11y-toggle="highlight"> Highlight links</label>
        <label><input type="checkbox" data-a11y-toggle="gray"> Grayscale</label>
      </fieldset>
      <fieldset>
        <legend>Reading</legend>
        <label><input type="checkbox" data-a11y-toggle="spacing"> Wider text spacing</label>
        <label><input type="checkbox" data-a11y-toggle="font"> Readable font</label>
        <label><input type="checkbox" data-a11y-toggle="guide"> Reading guide</label>
      </fieldset>
      <fieldset>
        <legend>Motion, focus, and controls</legend>
        <label><input type="checkbox" data-a11y-toggle="motion"> Pause animations</label>
        <label><input type="checkbox" data-a11y-toggle="focus"> Stronger focus</label>
        <label><input type="checkbox" data-a11y-toggle="cursor"> Larger pointer</label>
        <label><input type="checkbox" data-a11y-toggle="targets"> Larger controls</label>
      </fieldset>
      <button type="button" class="a11y-reset" data-a11y-reset>Reset</button>
    </div>
  </div>`;
}

function rssIcon() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="17.5" r="2.2" fill="currentColor"/><path d="M5 10a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 5a14 14 0 0 1 14 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

function icon(name, path) {
  return `<svg class="share-icon ${name}" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${path}</svg>`;
}

function coverHtml(article, decorative = false) {
  const alt = decorative ? "" : esc(article.title || "Story cover");
  if (article.image_path) {
    return `<div class="cover is-photo"><img src="${esc(article.image_path)}" alt="${alt}"></div>`;
  }
  const svg = String(article.art_svg || "").replace('role="img"', 'aria-hidden="true" focusable="false"');
  if (!svg.trim()) return `<div class="cover is-art"><img src="/cover/${esc(article.slug)}" alt="${alt}"></div>`;
  return `<div class="cover is-art">${svg}</div>`;
}

function storyDate(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function magDate(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d))).toUpperCase();
}

function sectionFor(article) {
  const tags = new Set((article.tags || []).map((tag) => String(tag).toLowerCase()));
  return SECTIONS.find((section) => TOPIC_TAGS[section.slug].some((tag) => tags.has(tag))) || null;
}

function catHtml(article) {
  const section = sectionFor(article);
  if (section) return `<a class="cat" href="/topic/${section.slug}">${esc(section.label)}</a>`;
  const label = String(article.kicker || "Story").replace(/[_-]+/g, " ");
  return `<span class="cat">${esc(label)}</span>`;
}

function shell({ title, socialTitle, description, canonical, robots, image, imageAlt, imageWidth, imageHeight, ogType = "website", extraHead = "", active, trend, main }) {
  const topLink = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const sections = SECTIONS.map((section) => topLink(`/topic/${section.slug}`, section.label, section.slug)).join("");
  const shareTitle = socialTitle || title;
  const indexable = !robots;
  const robotsContent = robots || "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const social = [
    `<meta property="og:site_name" content="Spoonspring">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:type" content="${esc(ogType)}">`,
    `<meta property="og:title" content="${esc(shareTitle)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : "",
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    image && imageWidth ? `<meta property="og:image:width" content="${esc(imageWidth)}">` : "",
    image && imageHeight ? `<meta property="og:image:height" content="${esc(imageHeight)}">` : "",
    image ? `<meta property="og:image:alt" content="${esc(imageAlt || shareTitle)}">` : "",
    image ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${esc(shareTitle)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    image ? `<meta name="twitter:image:alt" content="${esc(imageAlt || title)}">` : "",
    config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">` : "",
    canonical ? `<link rel="alternate" hreflang="en" href="${esc(canonical)}">` : "",
    canonical ? `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">` : "",
  ].filter(Boolean).join("\n  ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script nonce="${esc(pageNonce())}">${a11yBoot}</script>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${esc(robotsContent)}">
  ${indexable ? `<meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">` : ""}
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
  ${social}
  <meta name="theme-color" content="#1c1c1c">
  <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/favicon.svg?v=3">
  <link rel="alternate" type="application/rss+xml" title="Spoonspring" href="/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Roboto:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=18">
  ${extraHead}
</head>
<body>
  <div class="loadbar" id="loadbar" hidden></div>
  <a class="skip" href="#content">Skip to content</a>
  <div class="mast">
    <div class="trendbar">
      <div class="wrap trend-row">
        <p class="trend"><span>Trending</span><span class="trend-scroll">${trend ? `<a href="/article/${esc(trend.slug)}">${esc(trend.title)}</a>` : `<a href="/archive">Latest stories</a>`}</span></p>
        <div class="trend-tools">
          <a class="rss-link" href="/feed" aria-label="Latest stories">${rssIcon()}</a>
          <form class="trend-search" action="/search" method="get" role="search">
            <label class="sr" for="nav-q">Search stories</label>
            <input id="nav-q" type="search" name="q" placeholder="Search..." maxlength="80">
            <button type="submit" aria-label="Search">${searchIcon()}</button>
          </form>
        </div>
      </div>
    </div>
    <header class="brandbar">
      <div class="wrap brand-row">
        <a class="logo" href="/" aria-label="Spoonspring">Spoon<span>spring</span></a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu">
          <span class="sr">Menu</span>
          <span class="burger" aria-hidden="true"></span>
        </button>
      </div>
    </header>
  </div>
  <div class="site-menu" id="site-menu">
    <nav class="mainnav" aria-label="Sections">
      <div class="wrap mainnav-row">
        ${topLink("/", "Home", "home")}
        ${sections}
        ${topLink("/archive", "Archive", "archive")}
      </div>
    </nav>
  </div>
  <main id="content" class="wrap">
    ${main}
  </main>
  <footer class="site-footer">
    <div class="wrap footer-row">
      <a class="logo logo-small" href="/" aria-label="Spoonspring">Spoon<span>spring</span></a>
      <nav aria-label="About the magazine">
        <a href="/about">About</a>
        <a href="/archive">Archive</a>
        <a href="/privacy">Privacy</a>
        <a href="/cookies">Cookies</a>
        <a href="/terms">Terms</a>
        <button class="a11y-footer" type="button" data-a11y-open aria-haspopup="dialog" aria-controls="a11y-pop">Accessibility</button>
        <a href="/feed">Feed</a>
      </nav>
    </div>
  </footer>
  ${a11yWidget()}
  <script src="/client.js?v=10" defer nonce="${esc(pageNonce())}"></script>
</body>
</html>`;
}

function badge(article) {
  const section = sectionFor(article);
  const label = section ? section.label : String(article.kicker || "Story").replace(/[_-]+/g, " ");
  if (section) return `<a class="badge" href="/topic/${section.slug}">${esc(label)}</a>`;
  return `<span class="badge">${esc(label)}</span>`;
}

function miniItem(article) {
  return `<li>
    <a class="thumb" href="/article/${esc(article.slug)}" aria-label="${esc(article.title)}">${coverHtml(article, true)}</a>
    <div>
      <a href="/article/${esc(article.slug)}">${esc(article.title)}</a>
      <time datetime="${esc(article.edition_date)}">${esc(magDate(article.edition_date))}</time>
    </div>
  </li>`;
}

function recentWidget(posts) {
  const items = posts.slice(0, 5).map(miniItem).join("");
  if (!items) return "";
  return `<aside class="sm-rail">
    <div class="sm-tabbar"><span class="is-on">Recent</span></div>
    <ul class="sm-mini">${items}</ul>
  </aside>`;
}

function columnBlock(articles) {
  if (!articles.length) return "";
  const [first, ...more] = articles;
  const section = sectionFor(first);
  const cat = section
    ? `<a class="sm-cat" href="/topic/${section.slug}">${esc(section.label)}</a>`
    : `<span class="sm-cat">${esc(first.kicker || "Latest")}</span>`;
  const minis = more.map(miniItem).join("");
  return `<section class="sm-col">
    <h2 class="sm-catline">${cat}</h2>
    <article class="sm-feature">
      <a class="sm-feature-art" href="/article/${esc(first.slug)}">${coverHtml(first, true)}</a>
      <time datetime="${esc(first.edition_date)}">${esc(magDate(first.edition_date))}</time>
      <h3><a href="/article/${esc(first.slug)}">${esc(first.title)}</a></h3>
      <p>${esc(first.dek)}</p>
    </article>
    ${minis ? `<ul class="sm-mini">${minis}</ul>` : ""}
  </section>`;
}

function hero(posts) {
  const [main, ...rest] = posts;
  const side = rest.slice(0, 2);
  const sideHtml = side.map((article) => `<article class="sm-sidecard">
      <a class="sm-sidecard-art" href="/article/${esc(article.slug)}">${coverHtml(article, true)}</a>
      ${badge(article)}
      <h3><a href="/article/${esc(article.slug)}">${esc(article.title)}</a></h3>
    </article>`).join("");
  return `<section class="sm-hero${side.length === 0 ? " is-single" : ""}${side.length === 1 ? " is-duo" : ""}">
    <article class="sm-lead">
      <a href="/article/${esc(main.slug)}">
        ${coverHtml(main)}
        <span class="sm-lead-caption">
          <time datetime="${esc(main.edition_date)}">${esc(magDate(main.edition_date))}</time>
          <h2>${esc(main.title)}</h2>
        </span>
      </a>
      ${badge(main)}
    </article>
    ${side.length ? `<div class="sm-hero-side">${sideHtml}</div>` : ""}
  </section>`;
}

export function homePage({ posts, origin }) {
  const lead = posts[0];
  const sideCount = Math.min(2, Math.max(0, posts.length - 1));
  const rest = posts.slice(1 + sideCount);
  const left = rest.filter((_, index) => index % 2 === 0);
  const right = rest.filter((_, index) => index % 2 === 1);
  let lower = "";
  if (lead && !rest.length) {
    lower = `<section class="sm-lower is-solo">
      <section class="sm-col">
        <h2 class="sm-catline"><span class="sm-cat">The magazine</span></h2>
        <p class="sm-blurb">${esc(lead.dek)}</p>
        <p><a class="sm-more" href="/article/${esc(lead.slug)}">Read the story</a></p>
      </section>
      ${recentWidget(posts)}
    </section>`;
  } else if (rest.length) {
    lower = `<section class="sm-lower${right.length ? "" : " is-one"}">
      ${columnBlock(left)}
      ${right.length ? columnBlock(right) : ""}
      ${recentWidget(posts)}
    </section>`;
  }
  const main = lead
    ? `${hero(posts)}${lower}`
    : `<section class="sm-hero is-single" aria-label="Spoonspring"><div class="sm-lead is-plate"><div class="cover is-art">${renderHomeBanner()}</div></div></section>`;
  const description = "Spoonspring is a magazine.";
  const leadImage = lead ? (lead.image_path ? `${origin}${lead.image_path}` : `${origin}/cover/${lead.slug}`) : "";
  return shell({
    title: "Spoonspring",
    description,
    canonical: `${origin}/`,
    image: leadImage,
    imageAlt: lead?.title || "Spoonspring",
    imageWidth: lead && !lead.image_path ? "1200" : "",
    imageHeight: lead && !lead.image_path ? "675" : "",
    active: "home",
    trend: lead,
    extraHead: jsonScript({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          name: "Spoonspring",
          url: `${origin}/`,
          description,
          potentialAction: {
            "@type": "SearchAction",
            target: `${origin}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@type": "Organization",
          name: "Spoonspring",
          url: `${origin}/`,
          logo: `${origin}/favicon.svg`,
        },
      ],
    }),
    main,
  });
}

function cardGrid(articles) {
  if (!articles.length) return `<p class="empty-note">No stories in this section yet.</p>`;
  return `<div class="card-grid">${articles.map((article) => `<article class="card">
      <a class="card-art" href="/article/${esc(article.slug)}">${coverHtml(article)}</a>
      ${catHtml(article)}
      <h2><a href="/article/${esc(article.slug)}">${esc(article.title)}</a></h2>
      <time datetime="${esc(article.edition_date)}">${esc(magDate(article.edition_date))}</time>
    </article>`).join("")}</div>`;
}

export function titlePage({ title, articles, origin }) {
  return shell({
    title: `${title.name} — Spoonspring`,
    description: title.line,
    canonical: `${origin}${title.path}`,
    active: title.slug,
    main: `<header class="page-head"><p class="cat">A Spoonspring title</p><h1>${esc(title.name)}</h1><p class="dek">${esc(title.line)}</p></header>${cardGrid(articles)}`,
  });
}

export function topicPage({ section, articles, origin }) {
  return shell({
    title: `${section.label} — Spoonspring`,
    description: `${section.label} stories from Spoonspring.`,
    canonical: `${origin}/topic/${section.slug}`,
    active: section.slug,
    main: `<header class="page-head"><p class="cat">Section</p><h1>${esc(section.label)}</h1></header>${cardGrid(articles)}`,
  });
}

export function searchPage({ q, articles, origin }) {
  const query = String(q || "");
  const results = query
    ? (articles.length ? cardGrid(articles) : `<p class="empty-note">No stories matched “${esc(query)}”.</p>`)
    : `<p class="empty-note">Search titles and decks.</p>`;
  return shell({
    title: query ? `${query} — Search — Spoonspring` : "Search — Spoonspring",
    description: "Search Spoonspring stories.",
    canonical: query ? "" : `${origin}/search`,
    robots: "noindex",
    main: `<header class="page-head"><p class="cat">Search</p><h1>${query ? esc(query) : "Find a story"}</h1></header>
      <form class="search-form" action="/search" method="get" role="search">
        <label class="sr" for="search-q">Search stories</label>
        <input id="search-q" type="search" name="q" value="${esc(query)}" maxlength="80" placeholder="Search stories">
        <button type="submit">Search</button>
      </form>
      ${results}`,
  });
}

function jsonScript(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function publishedIso(article) {
  const date = new Date(article.created_at);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return `${article.edition_date}T00:00:00.000Z`;
}

function shareBlock(article, url) {
  const text = encodeURIComponent(article.title);
  const link = encodeURIComponent(url);
  const message = encodeURIComponent(`${article.title} ${url}`);
  return `<section class="share" aria-labelledby="share-heading">
    <h2 id="share-heading">Share</h2>
    <label class="sr" for="share-url">Story link</label>
    <input id="share-url" class="share-url" type="url" readonly value="${esc(url)}">
    <button type="button" data-copy-link aria-label="Copy link">${icon("icon-copy", `<rect x="9" y="9" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`)}${icon("icon-done", `<path d="M5 12.5 9.2 17 19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)}</button>
    <a href="https://twitter.com/intent/tweet?url=${link}&text=${text}" rel="noopener noreferrer" target="_blank" aria-label="X">${icon("", `<path fill="currentColor" d="M17.7 3h2.5l-5.5 6.3L21.6 21h-5.1l-4-5.2L8 21H5.4l5.9-6.7L2.8 3h5.2l3.6 4.8L17.7 3Zm-.9 16.2h1.4L7.3 4.7H5.8l11 14.5Z"/>`)}</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${link}" rel="noopener noreferrer" target="_blank" aria-label="Facebook">${icon("", `<path fill="currentColor" d="M14.2 21v-7.1h2.4l.4-2.8h-2.8V9.3c0-.8.2-1.4 1.4-1.4H17V5.3c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.3H8.8v2.8h2.6V21h2.8Z"/>`)}</a>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${link}" rel="noopener noreferrer" target="_blank" aria-label="LinkedIn">${icon("", `<path fill="currentColor" d="M6.2 9.1H3.4V21h2.8V9.1ZM4.8 3.4A1.6 1.6 0 1 0 4.8 6.6 1.6 1.6 0 0 0 4.8 3.4ZM20.6 21h-2.8v-5.8c0-1.4 0-3.2-1.9-3.2s-2.2 1.5-2.2 3.1V21H11V9.1h2.7v1.6h.1c.4-.7 1.3-1.5 2.7-1.5 2.9 0 3.4 1.9 3.4 4.4V21Z"/>`)}</a>
    <a href="https://wa.me/?text=${message}" rel="noopener noreferrer" target="_blank" aria-label="WhatsApp">${icon("", `<path fill="currentColor" d="M12 3.2a8.6 8.6 0 0 0-7.4 12.9L3.4 20.7l4.7-1.2A8.6 8.6 0 1 0 12 3.2Zm4.9 12.1c-.2.6-1.2 1.1-1.6 1.1-.4.1-.9.1-1.5-.1-.4-.1-.8-.2-1.4-.5-2.3-1-3.8-3.3-3.9-3.5-.1-.2-1-1.3-1-2.4s.6-1.7.8-1.9c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.8.7 1.9.1.2.1.3 0 .5l-.4.5c-.1.2-.2.3-.1.5.1.3.7 1.1 1.5 1.8 1 .8 1.8 1.1 2.1 1.2.3.1.4.1.6-.1.2-.2.7-.8.9-1 .2-.3.3-.2.6-.1.2.1 1.5.7 1.8.8.2.1.4.2.5.3.1.3 0 .8-.2 1.3Z"/>`)}</a>
    <a href="mailto:?subject=${text}&body=${message}" aria-label="Email">${icon("", `<rect x="3" y="5" width="18" height="14" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7.2 12 13l8-5.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`)}</a>
  </section>`;
}

export function articlePage({ article, related, offers, sponsor, connections, origin }) {
  const url = `${origin}/article/${article.slug}`;
  const image = article.image_path ? `${origin}${article.image_path}` : `${origin}/cover/${article.slug}`;
  const section = sectionFor(article);
  const published = publishedIso(article);
  const nonce = pageNonce();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: article.title,
        description: article.dek,
        datePublished: published,
        dateModified: published,
        author: { "@type": "Organization", name: "Spoonspring", url: `${origin}/` },
        publisher: {
          "@type": "Organization",
          name: "Spoonspring",
          url: `${origin}/`,
          logo: { "@type": "ImageObject", url: `${origin}/favicon.svg` },
        },
        image: [image],
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        articleSection: section ? section.label : (article.kicker || "Story"),
        keywords: (article.tags || []).join(", "),
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
          ...(section ? [{ "@type": "ListItem", position: 2, name: section.label, item: `${origin}/topic/${section.slug}` }] : []),
          { "@type": "ListItem", position: section ? 3 : 2, name: article.title, item: url },
        ],
      },
    ],
  };
  const adsenseHead = connections.adsenseClient
    ? `<script async nonce="${esc(nonce)}" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(connections.adsenseClient)}" crossorigin="anonymous"></script>`
    : "";
  const articleMeta = [
    `<meta property="article:published_time" content="${esc(published)}">`,
    `<meta property="article:modified_time" content="${esc(published)}">`,
    section ? `<meta property="article:section" content="${esc(section.label)}">` : "",
    ...(article.tags || []).slice(0, 8).map((tag) => `<meta property="article:tag" content="${esc(tag)}">`),
  ].filter(Boolean).join("");
  const partners = offers.length ? `<aside class="partners">
      <p class="section-label">Partner links</p>
      <ul>${offers.map((offer) => `<li><a href="${esc(offer.url)}" data-track="offer_click" data-ref="${offer.id}" rel="sponsored noopener noreferrer" target="_blank">${esc(offer.title)}</a><span>${esc(offer.blurb)}</span></li>`).join("")}</ul>
      <p class="fine">Spoonspring may earn a commission if you use these. They are matched to the topic on their own.</p>
    </aside>` : "";
  const sponsorHtml = sponsor ? `<aside class="sponsor">
      <p class="section-label">Sponsor</p>
      <a href="${esc(sponsor.href)}" data-track="sponsor_click" data-ref="${sponsor.id}" rel="sponsored noopener noreferrer" target="_blank"><strong>${esc(sponsor.name)}</strong><span>${esc(sponsor.line)}</span></a>
    </aside>` : "";
  const adHtml = connections.adsenseClient && connections.adsenseSlot ? `<aside class="ad-slot">
      <p class="section-label">Advertisement</p>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(connections.adsenseClient)}" data-ad-slot="${esc(connections.adsenseSlot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script nonce="${esc(nonce)}">(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </aside>` : "";
  const tip = connections.tipUrl ? `<p class="tip"><a href="${esc(connections.tipUrl)}" rel="noopener noreferrer" target="_blank">${esc(connections.tipLabel)}</a></p>` : "";
  const seeds = article.sources?.length ? `<section class="seeds"><h2>Sources</h2><ul>${article.sources.map((source) =>
    `<li><a href="${esc(source.url)}" rel="noopener noreferrer" target="_blank">${esc(source.title)}</a><span>${esc(source.source)}</span></li>`,
  ).join("")}</ul></section>` : "";
  const rail = recentWidget(related);
  const crumbSection = section ? `<a href="/topic/${section.slug}">${esc(section.label)}</a>` : "";
  return shell({
    title: `${article.title} — Spoonspring`,
    socialTitle: article.title,
    description: article.dek,
    canonical: url,
    image,
    imageAlt: article.title,
    imageWidth: article.image_path ? "" : "1200",
    imageHeight: article.image_path ? "" : "675",
    ogType: "article",
    extraHead: `${adsenseHead}${articleMeta}${jsonScript(jsonLd)}`,
    main: `<div class="sm-article${rail ? "" : " is-solo"}">
    <article class="story" data-article-id="${article.id}" data-share-title="${esc(article.title)}" data-sponsor-id="${sponsor ? sponsor.id : ""}" data-ad="${adHtml ? "1" : "0"}">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${crumbSection}<span aria-current="page">${esc(article.title)}</span></nav>
      <header class="story-head">
        ${catHtml(article)}
        <h1>${esc(article.title)}</h1>
        <p class="dek">${esc(article.dek)}</p>
        <p class="byline">by Spoonspring · <time datetime="${esc(published)}">${esc(magDate(article.edition_date))}</time> · ${article.minutes} min read</p>
      </header>
      <div class="story-cover">${coverHtml(article)}<div class="story-badge">${badge(article)}</div></div>
      ${shareBlock(article, url)}
      <div class="prose">${article.body_html}</div>
      ${tip}
      ${partners}
      ${sponsorHtml}
      ${adHtml}
      ${seeds}
    </article>
    ${rail}
    </div>`,
  });
}

export function feedPage({ articles, origin }) {
  return shell({
    title: "Feed — Spoonspring",
    description: "The latest Spoonspring stories.",
    canonical: `${origin}/feed`,
    active: "feed",
    main: `<header class="page-head"><p class="cat">Feed</p><h1>Latest stories</h1>
      <p class="dek">The newest pieces on the magazine, newest first.</p></header>
      ${cardGrid(articles)}`,
  });
}

export function archivePage({ groups, origin }) {
  const body = groups.length ? groups.map((group) => `<section class="archive-group">
      <h2 class="block-title"><span>${esc(monthYear(group.articles[0].edition_date))}</span></h2>
      ${cardGrid(group.articles)}
    </section>`).join("") : `<p class="empty-note">No stories yet.</p>`;
  return shell({
    title: "Archive — Spoonspring",
    description: "Every Spoonspring story.",
    canonical: `${origin}/archive`,
    active: "archive",
    main: `<header class="page-head"><p class="cat">Archive</p><h1>All stories</h1></header>${body}`,
  });
}

export function aboutPage({ origin }) {
  return shell({
    title: "About — Spoonspring",
    description: "Spoonspring is a magazine of short explainers.",
    canonical: `${origin}/about`,
    active: "about",
    main: `<header class="page-head"><p class="cat">About</p><h1>Spoonspring</h1></header>
      <div class="prose about">
        <p>Spoonspring is a magazine. The stories are the site.</p>
        <h2>The business</h2>
        <p>A few things can earn, and each one turns on when it is connected:</p>
        <ul>
          <li>Partner links, matched to the story's topics.</li>
          <li>A sponsor line, chosen from the sponsors on file.</li>
          <li>A display ad, once an ad client and slot are connected.</li>
        </ul>
        <p>There is also a tip link if one is set. The tally of views and clicks is an estimate from the amounts entered for those programs. The network, the affiliate program, and the sponsor pay the real balance.</p>
      </div>`,
  });
}

function contactBlock(contact) {
  if (!contact) return `<p>A contact address will appear here once the publisher adds one.</p>`;
  return `<p>Write to <a href="mailto:${esc(contact)}">${esc(contact)}</a>.</p>`;
}

export function cookiesPage({ origin, contact }) {
  return shell({
    title: "Cookies — Spoonspring",
    description: "What Spoonspring stores in the browser, and how to clear it.",
    canonical: `${origin}/cookies`,
    active: "cookies",
    main: `<header class="page-head"><p class="cat">Cookies</p><h1>Cookie policy</h1><p class="dek">Effective 4 October 2026.</p></header>
      <div class="prose legal">
        <p>This policy explains the small pieces of information this site can store on your device. It sits beside the <a href="/privacy">privacy policy</a> and the <a href="/terms">terms</a>.</p>
        <h2>What a cookie is</h2>
        <p>A cookie is a short text file a site asks the browser to keep and send back later. Local storage and session storage are similar stores that stay in the browser and are not automatically sent with every request. This page covers all three, because readers usually mean any of them when they ask about cookies.</p>
        <h2>Reading the magazine</h2>
        <p>Opening Spoonspring, reading a story, and using search do not require a cookie. The site does not set a tracking cookie to follow you from page to page, and it does not ask you to sign in.</p>
        <h2>Stored on this device</h2>
        <ul>
          <li><strong>Accessibility.</strong> If you change text size, contrast, link underlines, or the other reading settings, the browser saves them in local storage as spoonspring-a11y. The point is that the next page looks the way you left it. Spoonspring does not receive that record as an account. Reset in the accessibility panel, or clear site data in the browser, to remove it.</li>
          <li><strong>Story views.</strong> The first time a tab opens a story, the page can leave a marker in session storage so a refresh is not counted as a second view. The marker names that story. It is cleared when the browsing session ends.</li>
        </ul>
        <h2>Advertising and partners</h2>
        <p>A display ad appears only after the publisher connects an ad client and an ad slot. When that happens, the advertising company, such as Google AdSense, may set and read its own cookies to measure and choose ads. Those cookies can remember that an ad was shown, or that you visited this page, according to that company's policy. Google describes its own cookies at <a href="https://policies.google.com/technologies/cookies">policies.google.com/technologies/cookies</a>.</p>
        <p>A labeled partner link or sponsor link leaves this site. The merchant or sponsor can then set cookies under their own policy. Spoonspring does not control those cookies. A commission, if one is earned, is described in the terms.</p>
        <h2>Essential or optional</h2>
        <p>The accessibility store and the view marker are there so the page you asked for behaves correctly. They are not used to build an advertising profile. Advertising cookies, if an ad program is connected, are optional in the sense that they come from that program and not from reading the text. Where the law requires a choice before those cookies, they should not be set until that choice is available.</p>
        <h2>How to refuse or delete them</h2>
        <p>Browser settings can block cookies, block third-party cookies, or delete stored site data. Blocking local storage will also forget the accessibility choices. Private browsing usually drops session storage when the window closes. Nothing in this policy asks you to accept a cookie banner for ordinary reading, because ordinary reading does not set a tracking cookie.</p>
        <h2>Changes</h2>
        <p>If the site starts storing something new, this page and its date change with it.</p>
        <h2>Contact</h2>
        ${contactBlock(contact)}
      </div>`,
  });
}

export function privacyPage({ origin, contact }) {
  return shell({
    title: "Privacy — Spoonspring",
    description: "How Spoonspring handles information from readers.",
    canonical: `${origin}/privacy`,
    active: "privacy",
    main: `<header class="page-head"><p class="cat">Privacy</p><h1>Privacy policy</h1><p class="dek">Effective 4 October 2026.</p></header>
      <div class="prose legal">
        <p>Spoonspring is a magazine. This page explains what the site records when you read it.</p>
        <h2>What the site records</h2>
        <p>Opening a story can add one view to that story's count. The browser keeps a marker in session storage so a refresh in the same tab does not count again. That marker stays on your device and is cleared when the tab session ends. Spoonspring does not ask readers to create an account, and it does not build a profile of who you are.</p>
        <p>Search uses the words you type to find stories. Those words are part of the page address. Spoonspring does not keep a search history.</p>
        <p>The machine that hosts the site may keep ordinary connection logs, such as the time, the address, and the page requested. Those logs are for operating and protecting the site.</p>
        <h2>Cookies and storage on your device</h2>
        <p>Reading Spoonspring does not require an account, and the magazine does not set a cookie merely because you opened a page. The <a href="/cookies">cookie policy</a> lists what can be stored, why, and how to clear it. In short:</p>
        <ul>
          <li>Accessibility choices, such as text size and contrast, are saved in this browser's local storage under the name spoonspring-a11y. They stay on the device. They are not sent to Spoonspring as an account record.</li>
          <li>A view of a story can leave a short marker in session storage so refreshing the same tab does not count as another view. That marker ends when the tab session ends.</li>
          <li>If the publisher connects a display ad, the advertising company may set its own cookies when the ad loads. Partner sites can do the same after you follow a labeled partner link. Those cookies are covered by that company's policy, and they are described in the cookie policy.</li>
        </ul>
        <h2>Partners and ads</h2>
        <p>Some stories include partner links, a sponsor, or a display ad. Those are labeled. If a partner program is connected, that company may set its own cookies when you follow a link or when an ad loads. Their policy covers that activity. Amazon Associates, a sponsor's site, and Google AdSense are examples of programs the publisher can connect.</p>
        <h2>Selling information</h2>
        <p>Spoonspring does not sell personal information.</p>
        <h2>Children</h2>
        <p>The magazine is written for a general audience. It is not directed at children under 13, and it does not knowingly collect personal information from them.</p>
        <h2>Changes</h2>
        <p>When this policy changes, the date at the top of the page changes with it.</p>
        <h2>Contact</h2>
        ${contactBlock(contact)}
      </div>`,
  });
}

export function termsPage({ origin, contact }) {
  return shell({
    title: "Terms — Spoonspring",
    description: "The terms for reading and sharing Spoonspring.",
    canonical: `${origin}/terms`,
    active: "terms",
    main: `<header class="page-head"><p class="cat">Terms</p><h1>Terms and conditions</h1><p class="dek">Effective 4 October 2026.</p></header>
      <div class="prose legal">
        <p>These terms cover use of the Spoonspring website. Reading the magazine means you accept them.</p>
        <h2>The stories</h2>
        <p>Stories are general information. They are not medical, legal, financial, or other professional advice, and they are not a promise that every detail is complete. Check the sources listed under a story, and check a qualified person, before you rely on it.</p>
        <h2>Sharing</h2>
        <p>You may share links to Spoonspring stories, forward them, and quote a short passage with credit and a link to the story. Republishing a whole story, or copying the site, needs permission from the publisher.</p>
        <h2>How you may use the site</h2>
        <p>You may read the magazine, search it, and use the share links. You may not break the site, probe it for a way in, overload it with automated requests, copy it into another product, or pretend a story is yours. The publishing tools are not part of this public site.</p>
        <h2>Cookies</h2>
        <p>Use of the site is also covered by the <a href="/privacy">privacy policy</a> and the <a href="/cookies">cookie policy</a>. If you continue to read after those pages are published, you accept the ordinary storage they describe. Where the law requires a choice before a non-essential cookie, an advertising cookie is not set until that program is connected and the choice the law requires has been given.</p>
        <h2>Partner links</h2>
        <p>Some links are commercial. Spoonspring may earn a commission if you use a labeled partner link. That does not change the price you pay the merchant. Sponsor lines and advertisements are labeled as well.</p>
        <h2>The site can change</h2>
        <p>Stories can be added, edited, or removed. The site can be unavailable while it is being updated. These terms can change; the date above is the date of the current version.</p>
        <h2>Responsibility</h2>
        <p>The magazine is provided as it is published. To the extent the law allows, the publisher is not liable for loss that comes from using the site or from a story being incomplete. Some places do not allow that limit, and in those places it applies only as far as the law allows.</p>
        <h2>Law</h2>
        <p>These terms follow the law that applies where the publisher operates the site.</p>
        <h2>Contact</h2>
        ${contactBlock(contact)}
      </div>`,
  });
}

function when(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: config.tz,
  }).format(date);
}

export function deskPage(model) {
  const notice = model.notice ? `<p class="notice">${esc(model.notice)}</p>` : "";
  const slots = model.hours.map((slot) => slot.article
    ? `<p class="filed"><a href="/article/${esc(slot.article.slug)}">${esc(slot.label)} is filed</a><span>${esc(slot.article.title)}</span></p>`
    : `<form method="post" action="/desk/generate"><input type="hidden" name="slot" value="${slot.name}"><button type="submit">File ${esc(slot.label.toLowerCase())}</button><span>open at ${esc(slot.time)}</span></form>`).join("");
  const runs = model.runs.length ? `<table class="ledger"><thead><tr><th>When</th><th>Slot</th><th>Status</th><th>Detail</th></tr></thead><tbody>${model.runs.map((run) =>
    `<tr><td>${esc(when(run.created_at))}</td><td>${esc(run.slot || "")}</td><td>${esc(run.status)}</td><td>${esc(run.detail || "")}</td></tr>`,
  ).join("")}</tbody></table>` : `<p class="empty-note">No runs yet.</p>`;
  const offers = model.offers.map((offer) => `<li><div><strong>${esc(offer.title)}</strong><span>${esc(offer.blurb)}</span><span class="fine">${esc(offer.keywords.join(", "))} · ${offer.epc_cents}¢ per click</span></div>
    <form method="post" action="/desk/offers/delete"><input type="hidden" name="id" value="${offer.id}"><button class="ghost" type="submit">Remove</button></form></li>`).join("");
  const sponsors = model.sponsors.map((sponsor) => `<li><div><strong>${esc(sponsor.name)}</strong><span>${esc(sponsor.line)}</span><span class="fine">${sponsor.cpm_cents}¢ per thousand views</span></div>
    <form method="post" action="/desk/sponsors/delete"><input type="hidden" name="id" value="${sponsor.id}"><button class="ghost" type="submit">Remove</button></form></li>`).join("");
  const c = model.connections;
  return shell({
    title: "Desk — Spoonspring",
    description: "Publishing desk for Spoonspring.",
    robots: "noindex",
    active: "desk",
    main: `${notice}
      <header class="page-head"><p class="cat">Desk</p><h1>Publishing desk</h1>
        <p class="dek">${esc(model.clock.pretty)} · ${esc(model.tz)}. Once a day, one story in each section. An agent can still fill a slot through the publish API. ${model.textOn ? "The clock files any section that is still empty after the morning hour." : "The clock stays quiet until TEXT_API_KEY is set."}</p>
      </header>
      <section class="desk-block">
        <h2>Stories</h2>
        <p class="fine">${model.storyTotal} published. Edit or delete them here. The same actions are on the publish API for a dashboard on another machine.</p>
        ${storyAdmin(model)}
      </section>
      <section class="desk-block">
        <h2>Schedule</h2>
        <p class="fine">This clock stays in the desk. The public site just shows stories. These three slots are the magazine. Wire, Ledger, Laboratory, Signal, and Stage are filed through the publish API, and they do not take a slot.</p>
        <div class="file-row">${slots}</div>
      </section>
      <section class="desk-block">
        <h2>Last 30 days</h2>
        <div class="stats">
          <p><strong>${model.stats.views}</strong><span>views</span></p>
          <p><strong>${model.stats.offerClicks}</strong><span>partner clicks</span></p>
          <p><strong>${model.stats.sponsorViews}</strong><span>sponsor views</span></p>
          <p><strong>${model.stats.adViews}</strong><span>ad views</span></p>
          <p><strong>${esc(model.stats.estimate)}</strong><span>estimated</span></p>
        </div>
        <p class="fine">The estimate uses ${model.stats.offerCents}¢ from partner clicks, ${model.stats.sponsorCents}¢ from sponsors, and ${model.stats.adCents}¢ from the ad CPM you set. It is not a payout.</p>
      </section>
      <section class="desk-block">
        <h2>Recent runs</h2>
        ${runs}
      </section>
      <section class="desk-block">
        <h2>Connections</h2>
        <form class="form-grid" method="post" action="/desk/settings">
          <label>Amazon Associates tag <input name="amazon_tag" value="${esc(c.amazonTag)}" maxlength="64" autocomplete="off"></label>
          <label>AdSense client <input name="adsense_client" value="${esc(c.adsenseClient)}" placeholder="ca-pub-…" maxlength="40"></label>
          <label>AdSense slot <input name="adsense_slot" value="${esc(c.adsenseSlot)}" maxlength="20"></label>
          <label>Ad CPM in cents <input name="adsense_cpm_cents" type="number" min="0" step="1" value="${Number(c.adsenseCpmCents) || 0}"></label>
          <label>Tip link <input name="tip_url" value="${esc(c.tipUrl)}" placeholder="https://"></label>
          <label>Tip label <input name="tip_label" value="${esc(c.tipLabel)}" maxlength="60"></label>
          <button type="submit">Save connections</button>
        </form>
      </section>
      <section class="desk-block">
        <h2>Partner offers</h2>
        <ul class="manage">${offers}</ul>
        <form class="form-grid" method="post" action="/desk/offers">
          <label>Title <input name="title" required maxlength="80"></label>
          <label>Line <input name="blurb" required maxlength="200"></label>
          <label>Keywords, comma separated <input name="keywords" required maxlength="200" placeholder="climate, energy"></label>
          <label>Search phrase, used when there is an Amazon tag and no direct link <input name="query" maxlength="80"></label>
          <label>Direct link <input name="href" placeholder="https://"></label>
          <label>Estimated cents per click <input name="epc_cents" type="number" min="0" step="1" value="0"></label>
          <button type="submit">Add offer</button>
        </form>
      </section>
      <section class="desk-block">
        <h2>Sponsors</h2>
        <ul class="manage">${sponsors || ""}</ul>
        <form class="form-grid" method="post" action="/desk/sponsors">
          <label>Name <input name="name" required maxlength="80"></label>
          <label>Line <input name="line" required maxlength="160"></label>
          <label>Link <input name="href" required placeholder="https://"></label>
          <label>Estimated cents per thousand views <input name="cpm_cents" type="number" min="0" step="1" value="0"></label>
          <button type="submit">Add sponsor</button>
        </form>
      </section>
      <form method="post" action="/desk/logout"><button class="ghost" type="submit">Sign out</button></form>`,
  });
}

function storyAdmin(model) {
  const rows = (model.stories || []).map((article) => `<li>
      <label><input form="story-bulk" type="checkbox" name="slugs" value="${esc(article.slug)}"><span><strong>${esc(article.title)}</strong><span class="fine">${esc(article.publication || "magazine")} · ${esc(article.edition_date)} · ${esc(article.slug)}</span></span></label>
      <span class="story-tools"><a href="/desk/stories/${esc(article.slug)}">Edit</a></span>
      <form method="post" action="/desk/stories/delete"><input type="hidden" name="slugs" value="${esc(article.slug)}"><button class="ghost" type="submit">Delete</button></form>
    </li>`).join("");
  const pages = model.storyPages > 1
    ? `<p class="fine">${model.storyPage > 1 ? `<a href="/desk?page=${model.storyPage - 1}">Previous</a>` : ""} ${model.storyPage < model.storyPages ? `<a href="/desk?page=${model.storyPage + 1}">Next</a>` : ""}</p>`
    : "";
  return `<form id="story-bulk" method="post" action="/desk/stories/delete"><button type="submit">Delete selected</button></form>
    ${rows ? `<ul class="story-admin">${rows}</ul>` : `<p class="empty-note">No stories yet.</p>`}
    ${pages}`;
}

export function storyForm({ article, error = "" }) {
  const options = TITLES.map((title) => `<option value="${esc(title.slug)}"${article.publication === title.slug ? " selected" : ""}>${esc(title.name)}</option>`).join("");
  const slots = ["morning", "midday", "evening", "extra"].map((slot) => `<option value="${slot}"${article.slot === slot ? " selected" : ""}>${slot}</option>`).join("");
  return shell({
    title: `Edit — ${article.title}`,
    description: "Edit a Spoonspring story.",
    robots: "noindex",
    active: "desk",
    main: `<header class="page-head"><p class="cat">Desk</p><h1>Edit story</h1></header>
      ${error ? `<p class="notice">${esc(error)}</p>` : ""}
      <form class="form-grid" method="post" action="/desk/stories/${esc(article.slug)}">
        <label>Title <input name="title" required maxlength="140" value="${esc(article.title)}"></label>
        <label>Deck <input name="dek" maxlength="240" value="${esc(article.dek || "")}"></label>
        <label>Kicker <input name="kicker" maxlength="24" value="${esc(article.kicker || "")}"></label>
        <label>Tags, comma separated <input name="tags" maxlength="200" value="${esc((article.tags || []).join(", "))}"></label>
        <label>Which title <select name="publication">${options}</select></label>
        <label>Slot <select name="slot">${slots}</select></label>
        <label>Date <input name="date" type="date" required value="${esc(article.edition_date || "")}"></label>
        <label>New cover link <input name="image_url" placeholder="https://" maxlength="500"></label>
        <label class="span-2">Article <textarea class="editor" name="body" required maxlength="100000">${esc(article.body_md || "")}</textarea></label>
        <button type="submit">Save story</button>
        <a href="/desk">Back to the desk</a>
      </form>
      <p class="fine"><a href="/article/${esc(article.slug)}">View the live story</a></p>`,
  });
}

export function loginPage({ error }) {
  return shell({
    title: "Desk — Spoonspring",
    description: "Sign in to the Spoonspring desk.",
    robots: "noindex",
    active: "desk",
    main: `<header class="page-head"><p class="cat">Desk</p><h1>Sign in.</h1></header>
      ${error ? `<p class="notice">${esc(error)}</p>` : ""}
      <form class="form-grid narrow" method="post" action="/desk/login">
        <label>Desk token <input type="password" name="token" autocomplete="current-password" required></label>
        <button type="submit">Enter</button>
      </form>
      <p class="fine">The token is DESK_TOKEN in the environment file.</p>`,
  });
}

export function notFoundPage() {
  return shell({
    title: "Not found — Spoonspring",
    description: "That page is not on Spoonspring.",
    robots: "noindex",
    main: `<header class="page-head"><p class="cat">404</p><h1>No story under that name.</h1></header><p><a href="/">Back to the magazine</a></p>`,
  });
}

function cdata(value) {
  return `<![CDATA[${String(value ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export function rss(articles, origin) {
  const items = articles.slice(0, 30).map((article) => {
    const url = `${origin}/article/${article.slug}`;
    const image = article.image_path ? `${origin}${article.image_path}` : `${origin}/cover/${article.slug}`;
    const published = new Date(article.created_at);
    return `<item>
    <title>${esc(article.title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    <pubDate>${Number.isNaN(published.getTime()) ? "" : published.toUTCString()}</pubDate>
    <description>${esc(article.dek)}</description>
    <content:encoded>${cdata(article.body_html || article.dek)}</content:encoded>
    <category>${esc(article.kicker || "Story")}</category>
    <media:content url="${esc(image)}" medium="image"/>
  </item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Spoonspring</title>
  <link>${esc(origin)}/</link>
  <atom:link href="${esc(origin)}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>A magazine of short explainers.</description>
  <language>en</language>
  ${items}
</channel></rss>`;
}

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function sitemap(articles, origin) {
  const today = new Date().toISOString().slice(0, 10);
  const pages = ["/", "/feed", "/archive", "/about", "/privacy", "/cookies", "/terms", ...SECTIONS.map((section) => `/topic/${section.slug}`)];
  const staticUrls = pages.map((path) => `  <url><loc>${esc(origin + path)}</loc><lastmod>${today}</lastmod></url>`);
  const storyUrls = articles.map((article) => {
    const image = article.image_path ? `${origin}${article.image_path}` : `${origin}/cover/${article.slug}`;
    const modified = stamp(article.updated_at || article.created_at) || article.edition_date;
    return `  <url><loc>${esc(`${origin}/article/${article.slug}`)}</loc><lastmod>${esc(modified)}</lastmod><image:image><image:loc>${esc(image)}</image:loc><image:title>${esc(article.title)}</image:title></image:image></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...staticUrls, ...storyUrls].join("\n")}
</urlset>`;
}
