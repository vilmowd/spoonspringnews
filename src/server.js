import express from "express";
import path from "node:path";
import { config, tzLabel } from "./config.js";
import { initDb, shutdown } from "./db.js";
import * as store from "./store.js";
import { seed } from "./seed.js";
import { startScheduler, stopScheduler } from "./schedule.js";
import { publishEdition } from "./generate.js";
import { publishStory, updateStory, removeStories } from "./publish.js";
import { TITLES, titleBySlug } from "./titles.js";
import { zonedNow, slotMeta, SLOT_ORDER } from "./clock.js";
import { matchOffers, pickSponsor, money } from "./monetize.js";
import * as pages from "./html.js";
import {
  safeEqual,
  bindRequest,
  createSession,
  validSession,
  destroySession,
  deskCookie,
  clearDeskCookies,
  limitLogin,
  limitPublish,
  limitPublishGlobal,
  limitEvents,
  limitSearch,
  limitManage,
  limitManageGlobal,
  limitRead,
  clientIp,
  requestIsHttps,
} from "./security.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy ? 1 : false);
app.use(bindRequest);
app.use((req, res, next) => {
  const editing = req.method === "POST" && /^\/desk\/stories\/[^/]+$/.test(req.path);
  return express.urlencoded({ extended: false, limit: editing ? "1mb" : "32kb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === "/api/articles" || req.path.startsWith("/api/articles/")) return next();
  return express.json({ limit: "16kb" })(req, res, next);
});
app.use(express.text({ type: ["text/plain", "application/octet-stream"], limit: "16kb" }));
app.use(express.static(path.join(process.cwd(), "public"), {
  maxAge: "1h",
  index: false,
  dotfiles: "deny",
  redirect: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".svg")) {
      res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
  },
}));

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function authed(req) {
  const header = req.get("x-spoonspring-token") || req.get("x-folio-token") || "";
  if (header && safeEqual(header, config.deskToken)) return "token";
  const cookie = readCookie(req, "spoonspring_desk");
  if (cookie && validSession(cookie)) return "cookie";
  return "";
}

function sameOrigin(req) {
  const host = req.get("host");
  const origin = req.get("origin");
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  const referer = req.get("referer");
  if (!referer) return false;
  try { return new URL(referer).host === host; } catch { return false; }
}

function requireDesk(req, res, next) {
  const how = authed(req);
  if (!how) {
    if (req.method === "GET") return res.status(401).send(pages.loginPage({ error: "" }));
    return res.status(401).type("text").send("Sign in at the desk first.");
  }
  if (how === "cookie" && req.method !== "GET" && !sameOrigin(req)) {
    return res.status(403).type("text").send("Blocked a cross-site form.");
  }
  return next();
}

function originOf(req) {
  if (config.siteUrl) return config.siteUrl;
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
}

function httpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function noticeRedirect(res, message) {
  res.redirect(303, `/desk?notice=${encodeURIComponent(message)}`);
}

async function loadConnections() {
  const saved = await store.getSettings();
  const val = (key, fallback) => {
    const fromDb = saved[key];
    if (fromDb != null && String(fromDb).trim() !== "") return String(fromDb).trim();
    return fallback || "";
  };
  return {
    amazonTag: val("amazon_tag", config.amazonTag),
    adsenseClient: val("adsense_client", config.adsenseClient),
    adsenseSlot: val("adsense_slot", config.adsenseSlot),
    adsenseCpmCents: Math.max(0, Number(val("adsense_cpm_cents", String(config.adsenseCpmCents))) || 0),
    tipUrl: val("tip_url", config.tipUrl),
    tipLabel: val("tip_label", config.tipLabel) || "Support this desk",
  };
}

app.get("/health", async (_req, res, next) => {
  try {
    await store.listRuns(1);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/", async (req, res, next) => {
  try {
    const posts = await store.listHome(12);
    res.set("Cache-Control", "no-cache");
    res.type("html").send(pages.homePage({ posts, origin: originOf(req) }));
  } catch (error) {
    next(error);
  }
});

app.get("/article/:slug", async (req, res, next) => {
  try {
    const article = await store.getBySlug(req.params.slug);
    if (!article) return res.status(404).type("html").send(pages.notFoundPage());
    const [relatedRaw, offers, sponsors, connections, latest] = await Promise.all([
      article.kind === "guide" ? Promise.resolve([]) : store.relatedBriefings(article),
      store.listOffers(),
      store.listSponsors(),
      loadConnections(),
      store.listPublished(6),
    ]);
    const related = relatedRaw.length
      ? relatedRaw
      : latest.filter((item) => item.id !== article.id).slice(0, 3);
    res.set("Cache-Control", "no-cache");
    res.type("html").send(pages.articlePage({
      article,
      related,
      offers: matchOffers(offers, article, connections.amazonTag),
      sponsor: pickSponsor(sponsors, article.id),
      connections,
      origin: originOf(req),
    }));
  } catch (error) {
    next(error);
  }
});

app.get("/cover/:slug", async (req, res, next) => {
  try {
    const article = await store.getBySlug(req.params.slug);
    if (!article?.art_svg) return res.status(404).end();
    res.set("Cache-Control", "public, max-age=86400");
    res.type("image/svg+xml").send(article.art_svg);
  } catch (error) {
    next(error);
  }
});

app.get("/title/:slug", (_req, res) => {
  res.redirect(302, "/");
});

app.get("/archive", async (req, res, next) => {
  try {
    const articles = await store.listPublished(120);
    const groups = [];
    for (const article of articles) {
      const month = String(article.edition_date).slice(0, 7);
      const last = groups[groups.length - 1];
      if (!last || last.month !== month) groups.push({ month, articles: [article] });
      else last.articles.push(article);
    }
    res.type("html").send(pages.archivePage({ groups, origin: originOf(req) }));
  } catch (error) {
    next(error);
  }
});

app.get("/about", (req, res) => {
  res.type("html").send(pages.aboutPage({ origin: originOf(req) }));
});

app.get("/cookies", (req, res) => {
  res.type("html").send(pages.cookiesPage({ origin: originOf(req), contact: config.contactEmail }));
});

app.get("/privacy", (req, res) => {
  res.type("html").send(pages.privacyPage({ origin: originOf(req), contact: config.contactEmail }));
});

app.get("/terms", (req, res) => {
  res.type("html").send(pages.termsPage({ origin: originOf(req), contact: config.contactEmail }));
});

app.get("/accessibility", (_req, res) => {
  res.redirect(302, "/?a11y=1");
});

app.get("/topic/:slug", async (req, res, next) => {
  try {
    const section = pages.SECTIONS.find((item) => item.slug === req.params.slug);
    if (!section) return res.status(404).type("html").send(pages.notFoundPage());
    const articles = await store.listByTopic(pages.TOPIC_TAGS[section.slug]);
    res.type("html").send(pages.topicPage({ section, articles, origin: originOf(req) }));
  } catch (error) {
    next(error);
  }
});

app.get("/search", limitSearch, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    const articles = q ? await store.searchArticles(q) : [];
    res.type("html").send(pages.searchPage({ q, articles, origin: originOf(req) }));
  } catch (error) {
    next(error);
  }
});

app.get("/feed", async (req, res, next) => {
  try {
    const articles = (await store.listPublished(30)).filter((article) => article.kind !== "guide");
    res.set("Cache-Control", "no-cache");
    res.type("html").send(pages.feedPage({ articles, origin: originOf(req) }));
  } catch (error) {
    next(error);
  }
});

app.get("/feed.xml", async (req, res, next) => {
  try {
    const articles = (await store.listFeed(30)).filter((article) => article.kind !== "guide");
    res.type("application/rss+xml").send(pages.rss(articles, originOf(req)));
  } catch (error) {
    next(error);
  }
});

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const articles = await store.listPublished(200);
    res.type("application/xml").send(pages.sitemap(articles, originOf(req)));
  } catch (error) {
    next(error);
  }
});

app.get("/robots.txt", (req, res) => {
  const origin = originOf(req);
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /desk\nDisallow: /api/\nDisallow: /search\nSitemap: ${origin}/sitemap.xml\n`);
});

function requirePublish(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : String(req.get("x-spoonspring-key") || req.get("x-folio-key") || "");
  if (!config.publishKey || !token || !safeEqual(token, config.publishKey)) {
    return res.status(401).json({ ok: false, message: "Send the publish key as Authorization: Bearer <key>." });
  }
  return next();
}

function requireJson(req, res, next) {
  const type = String(req.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    return res.status(415).json({ ok: false, message: "Send Content-Type: application/json." });
  }
  return next();
}

app.get("/api/titles", limitPublishGlobal, limitPublish, requirePublish, async (req, res, next) => {
  try {
    const counts = await store.countByPublication();
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      titles: TITLES.map((title) => ({
        slug: title.slug,
        name: title.name,
        line: title.line,
        path: title.path,
        stories: counts[title.slug] || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/editions", limitPublishGlobal, limitPublish, requirePublish, async (req, res, next) => {
  try {
    const clock = zonedNow();
    const slots = [];
    for (const name of SLOT_ORDER) {
      const meta = slotMeta(name);
      const article = await store.findEdition(clock.date, name);
      slots.push({
        slot: name,
        time: meta.time,
        open: !article,
        slug: article?.slug || null,
        title: article?.title || null,
      });
    }
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, date: clock.date, timezone: config.tz, slots });
  } catch (error) {
    next(error);
  }
});

function articleJson(article, origin, full = false) {
  const record = {
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    kicker: article.kicker,
    tags: article.tags || [],
    slot: article.slot,
    publication: article.publication || "magazine",
    date: article.edition_date,
    minutes: article.minutes,
    image: article.image_path ? `${origin}${article.image_path}` : null,
    url: `${origin}/article/${article.slug}`,
    updated_at: article.updated_at,
  };
  if (!full) return record;
  return { ...record, body: article.body_md || "", queries: article.queries || [], sources: article.sources || [] };
}

function apiError(res, error) {
  const status = error.status || (error.code === "23505" ? 409 : 500);
  if (status === 500) console.error(error);
  res.status(status).json({ ok: false, message: status === 500 ? "The story could not be changed." : error.message });
}

const articleJsonParser = express.json({ limit: "8mb" });

app.get("/api/articles", limitRead, requirePublish, async (req, res) => {
  try {
    const publication = String(req.query.publication || "").trim().toLowerCase();
    if (publication && !titleBySlug(publication)) {
      return res.status(400).json({ ok: false, message: "Unknown publication." });
    }
    const page = await store.pageArticles({
      page: req.query.page,
      limit: req.query.limit,
      publication,
      query: req.query.q,
    });
    const origin = originOf(req);
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      page: page.page,
      limit: page.limit,
      total: page.total,
      pages: Math.max(1, Math.ceil(page.total / page.limit)),
      articles: page.articles.map((article) => articleJson(article, origin)),
    });
  } catch (error) {
    apiError(res, error);
  }
});

app.post("/api/articles/bulk-delete", limitManageGlobal, limitManage, requirePublish, requireJson, articleJsonParser, async (req, res) => {
  try {
    const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs : [];
    const result = await removeStories(slugs);
    console.log(`[spoonspring] deleted ${result.deleted.length} stories from ${clientIp(req)}`);
    res.json({ ok: true, ...result });
  } catch (error) {
    apiError(res, error);
  }
});

app.get("/api/articles/:slug", limitRead, requirePublish, async (req, res) => {
  try {
    const article = await store.getBySlug(req.params.slug);
    if (!article || !["briefing", "story"].includes(article.kind)) {
      return res.status(404).json({ ok: false, message: "No story with that slug." });
    }
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, article: articleJson(article, originOf(req), true) });
  } catch (error) {
    apiError(res, error);
  }
});

async function changeArticle(req, res) {
  try {
    const story = await updateStory(req.params.slug, req.body || {});
    const origin = originOf(req);
    console.log(`[spoonspring] updated ${story.slug} from ${clientIp(req)}`);
    res.json({
      ok: true,
      slug: story.slug,
      url: `${origin}/article/${story.slug}`,
      slot: story.slot,
      date: story.date,
      publication: story.publication,
    });
  } catch (error) {
    apiError(res, error);
  }
}

app.patch("/api/articles/:slug", limitManageGlobal, limitManage, requirePublish, requireJson, articleJsonParser, changeArticle);
app.put("/api/articles/:slug", limitManageGlobal, limitManage, requirePublish, requireJson, articleJsonParser, changeArticle);

app.delete("/api/articles/:slug", limitManageGlobal, limitManage, requirePublish, async (req, res) => {
  try {
    const result = await removeStories([req.params.slug]);
    if (!result.deleted.length) return res.status(404).json({ ok: false, message: "No story with that slug." });
    console.log(`[spoonspring] deleted ${result.deleted[0]} from ${clientIp(req)}`);
    res.json({ ok: true, deleted: result.deleted });
  } catch (error) {
    apiError(res, error);
  }
});

app.post("/api/articles", limitPublishGlobal, limitPublish, requirePublish, requireJson, express.json({ limit: "8mb" }), async (req, res) => {
  try {
    const story = await publishStory(req.body || {});
    const origin = originOf(req);
    console.log(`[spoonspring] published ${story.slug} (${story.slot}) from ${clientIp(req)}`);
    res.status(201).json({
      ok: true,
      slug: story.slug,
      url: `${origin}/article/${story.slug}`,
      slot: story.slot,
      date: story.date,
      publication: story.publication,
    });
  } catch (error) {
    const status = error.status || (error.code === "23505" ? 409 : 500);
    if (status === 500) console.error(error);
    res.status(status).json({ ok: false, message: status === 500 ? "The story could not be published." : error.message });
  }
});

app.post("/api/event", limitEvents, async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ ok: false });
  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  const kind = String(payload?.kind || "");
  const allowed = new Set(["view", "offer_click", "sponsor_view", "sponsor_click", "ad_view"]);
  const articleId = Number(payload?.articleId);
  if (!allowed.has(kind) || !Number.isInteger(articleId) || articleId < 1) return res.status(400).json({ ok: false });
  if (!(await store.hasArticle(articleId))) return res.status(404).json({ ok: false });
  const ref = payload?.refId == null || payload.refId === "" ? null : Number(payload.refId);
  await store.insertEvent(articleId, kind, Number.isInteger(ref) && ref > 0 ? ref : null);
  res.json({ ok: true });
});

app.post("/desk/generate", requireDesk, async (req, res, next) => {
  try {
    const slot = String(req.body.slot || "");
    const result = await publishEdition(slot, zonedNow().date);
    if (req.get("x-spoonspring-token") || req.get("x-folio-token")) return res.status(result.ok ? 200 : 422).json(result);
    return noticeRedirect(res, result.message);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ ok: false });
  res.status(404).type("html").send(pages.notFoundPage());
});

app.use((error, req, res, _next) => {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  if (req.path.startsWith("/api/")) {
    const message = status === 413
      ? "The upload is too large."
      : status === 400
        ? "The request body could not be read."
        : "The story could not be published.";
    return res.status(status === 500 ? 500 : status).json({ ok: false, message });
  }
  res.status(status === 500 ? 500 : status).type("text").send(status === 500
    ? "The site hit an error. The server log has the detail."
    : "The request could not be completed.");
});

let httpServer;

async function boot() {
  const db = await initDb();
  await seed();
  httpServer = app.listen(config.port, () => {
    startScheduler();
    console.log(`Spoonspring is on http://localhost:${config.port}`);
    const hour = String(config.hours.morning).padStart(2, "0");
    console.log(`Once a day, after ${hour}:00 ${tzLabel()}, one story is filed in each section: ${pages.SECTIONS.map((section) => section.label).join(", ")}`);
    console.log(config.text.key ? "Automatic publishing is on" : "Automatic publishing is off — add TEXT_API_KEY to .env");
    console.log("Publish API: GET /api/titles, GET /api/editions, and POST /api/articles with Authorization: Bearer <PUBLISH_KEY>");
    console.log(`Postgres ${db.connectionString}`);
    if (config.deskToken === "folio-desk" || config.deskToken.length < 16) {
      console.log("Desk token is still short or the starter value. Change DESK_TOKEN before this site is public.");
    }
    if (config.publishKey.length < 32) console.log("PUBLISH_KEY is shorter than 32 characters. Use a long random key before this site is public.");
    if (!config.siteUrl) console.log("SITE_URL is empty, so canonical links follow the request host. Set it to https://your-domain before the site is public.");
  });
  return httpServer;
}

async function close() {
  stopScheduler();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await shutdown();
}

try {
  await boot();
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}

process.on("SIGINT", () => { close().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { close().finally(() => process.exit(0)); });
