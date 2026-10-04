import express from "express";
import { config } from "../src/config.js";
import { fileStory, engineHint, engineReady } from "../src/engine.js";
import { listPage, editPage, downPage } from "./page.js";

const port = Number(process.env.DASHBOARD_PORT || 4000);
const magazine = (process.env.MAGAZINE_URL || `http://127.0.0.1:${config.port}`).replace(/\/$/, "");
const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

function sameHost(req) {
  const origin = req.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === req.get("host"); } catch { return false; }
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${magazine}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.publishKey}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    const error = new Error("The magazine is not running.");
    error.code = "DOWN";
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `The magazine returned ${res.status}.`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function sendError(res, error) {
  if (error.code === "DOWN") return res.status(503).type("html").send(downPage(error.message));
  return res.status(error.status || 500).type("html").send(downPage(error.message));
}

app.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const q = String(req.query.q || "");
    const data = await api(`/api/articles?page=${page}&limit=20&q=${encodeURIComponent(q)}`);
    res.type("html").send(listPage({
      articles: data.articles || [],
      page: data.page,
      pages: data.pages,
      total: data.total,
      query: q,
      notice: String(req.query.notice || ""),
      hint: engineHint(),
      ready: engineReady(),
    }));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/edit/:slug", async (req, res) => {
  try {
    const data = await api(`/api/articles/${encodeURIComponent(req.params.slug)}`);
    res.type("html").send(editPage({ article: data.article, notice: String(req.query.notice || "") }));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/edit/:slug", async (req, res) => {
  if (!sameHost(req)) return res.status(403).type("text").send("Blocked.");
  const slug = req.params.slug;
  try {
    const body = {
      title: req.body.title,
      dek: req.body.dek,
      kicker: req.body.kicker,
      tags: req.body.tags,
      publication: req.body.publication,
      slot: req.body.slot,
      date: req.body.date,
      body: req.body.body,
    };
    if (req.body.remove_image) body.remove_image = true;
    if (req.body.image_url) body.image_url = req.body.image_url;
    const saved = await api(`/api/articles/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    res.redirect(303, `/edit/${encodeURIComponent(saved.slug)}?notice=${encodeURIComponent("Saved.")}`);
  } catch (error) {
    if (error.code === "DOWN") return sendError(res, error);
    const article = {
      slug,
      title: req.body.title,
      dek: req.body.dek,
      kicker: req.body.kicker,
      tags: String(req.body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      publication: req.body.publication,
      slot: req.body.slot,
      date: req.body.date,
      body: req.body.body,
      url: `${magazine}/article/${slug}`,
    };
    res.status(error.status || 500).type("html").send(editPage({ article, notice: error.message }));
  }
});

app.post("/delete", async (req, res) => {
  if (!sameHost(req)) return res.status(403).type("text").send("Blocked.");
  try {
    const raw = req.body.slugs;
    const slugs = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    const result = await api("/api/articles/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ slugs }),
    });
    const message = !slugs.length
      ? "Select at least one story."
      : result.deleted?.length
        ? `Deleted ${result.deleted.length}.`
        : "Those stories were already gone.";
    res.redirect(303, `/?notice=${encodeURIComponent(message)}`);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/write", async (req, res) => {
  if (!sameHost(req)) return res.status(403).type("text").send("Blocked.");
  try {
    const story = await fileStory();
    const message = story.photo
      ? `Published ${story.slug} with a free photograph.`
      : `Published ${story.slug}. No free photograph matched, so the cover is drawn.`;
    res.redirect(303, `/?notice=${encodeURIComponent(message)}`);
  } catch (error) {
    res.redirect(303, `/?notice=${encodeURIComponent(error.message)}`);
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Dashboard is on http://127.0.0.1:${port}`);
  console.log(`Magazine ${magazine}`);
  console.log(engineHint());
});
