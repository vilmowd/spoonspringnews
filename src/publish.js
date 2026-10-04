import fs from "node:fs";
import path from "node:path";
import { SLOT_ORDER, slotMeta, zonedNow } from "./clock.js";
import { PALETTES, MOTIFS, renderCover } from "./art.js";
import { renderMarkdown, wordCount } from "./markdown.js";
import { assertPublicUrl, isPublicHttpUrl } from "./security.js";
import * as store from "./store.js";
import { titleBySlug, TITLES } from "./titles.js";

const PALETTE_NAMES = Object.keys(PALETTES);
const MAX_IMAGE = 6 * 1024 * 1024;

const WINDOWS_1252 = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A],
  [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92],
  [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C],
  [0x017E, 0x9E], [0x0178, 0x9F],
]);

function repairText(value) {
  const text = String(value ?? "");
  if (!text.includes("Ã") && !text.includes("Â")) return text;
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code <= 0xFF) bytes.push(code);
    else if (WINDOWS_1252.has(code)) bytes.push(WINDOWS_1252.get(code));
    else return text;
  }
  const fixed = Buffer.from(bytes).toString("utf8");
  if (fixed.includes("\uFFFD")) return text;
  const marks = (sample) => (sample.match(/[ÃÂ]/g) || []).length;
  return marks(fixed) < marks(text) ? fixed : text;
}

function clip(value, max) {
  return repairText(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function slugify(title) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "story"}-${suffix}`;
}

function cleanSlug(value) {
  const slug = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return slug || "";
}

function asList(value, max, itemMax = 40) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((item) => clip(item, itemMax)).filter(Boolean).slice(0, max);
}

function httpUrl(value) {
  return isPublicHttpUrl(value);
}

function imageType(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF87a") return "gif";
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function saveImage(buffer, slug) {
  const type = imageType(buffer);
  if (!type) {
    const error = new Error("The picture needs to be a PNG, JPEG, GIF, or WebP.");
    error.status = 400;
    throw error;
  }
  if (buffer.length > MAX_IMAGE) {
    const error = new Error("The picture is larger than 6 MB.");
    error.status = 400;
    throw error;
  }
  const dir = path.join(process.cwd(), "public", "media");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${slug}.${type}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return `/media/${name}`;
}

async function pictureFromUrl(start) {
  let current = await assertPublicUrl(start);
  for (let hop = 0; hop < 3; hop += 1) {
    let res;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: {
          Accept: "image/png,image/jpeg,image/gif,image/webp",
          "User-Agent": "Spoonspring/1.0 (magazine image fetch)",
        },
      });
      if (res.status !== 429 && res.status !== 503) break;
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const pause = Math.max(2000, (retryAfter || attempt + 1) * 2000);
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        const error = new Error("The picture link redirected without a destination.");
        error.status = 400;
        throw error;
      }
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!res.ok) {
      const error = new Error(`Could not download the picture (${res.status}).`);
      error.status = 400;
      throw error;
    }
    const length = Number(res.headers.get("content-length") || 0);
    if (length > MAX_IMAGE) {
      const error = new Error("The picture is larger than 6 MB.");
      error.status = 400;
      throw error;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE) {
      const error = new Error("The picture is larger than 6 MB.");
      error.status = 400;
      throw error;
    }
    return buffer;
  }
  const error = new Error("The picture link redirected too many times.");
  error.status = 400;
  throw error;
}

function pictureFromBase64(value) {
  const raw = String(value || "").trim().replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) {
    const error = new Error("The picture data was empty.");
    error.status = 400;
    throw error;
  }
  return buffer;
}

export async function publishStory(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Send a JSON object with a title and the article text.");
    error.status = 400;
    throw error;
  }
  const title = clip(input.title, 140);
  const body = repairText(input.body_markdown || input.body).trim();
  if (!title || body.length < 40) {
    const error = new Error("Send a title and the article text.");
    error.status = 400;
    throw error;
  }
  if (body.length > 100000) {
    const error = new Error("The article text is longer than 100,000 characters.");
    error.status = 400;
    throw error;
  }
  const requested = cleanSlug(input.slug);
  const slug = requested || slugify(title);
  if (await store.getBySlug(slug)) {
    const error = new Error("A story with that slug is already published.");
    error.status = 409;
    throw error;
  }
  const publication = String(input.publication || "magazine").trim().toLowerCase();
  if (!titleBySlug(publication)) {
    const error = new Error(`publication must be one of: ${TITLES.map((item) => item.slug).join(", ")}.`);
    error.status = 400;
    throw error;
  }
  const clock = zonedNow();
  const editionDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || "")) ? String(input.date) : clock.date;
  const asked = String(input.slot || "");
  const requestedSlot = publication === "magazine" && (SLOT_ORDER.includes(asked) || asked === "extra") ? asked : "";
  let slot = publication === "magazine" ? requestedSlot : "extra";
  if (publication === "magazine" && !slot) {
    for (const name of SLOT_ORDER) {
      if (!(await store.findEdition(editionDate, name))) {
        slot = name;
        break;
      }
    }
  }
  if (publication === "magazine" && SLOT_ORDER.includes(slot) && await store.findEdition(editionDate, slot)) {
    const error = new Error(`${slotMeta(slot).label} for ${editionDate} already has a story. GET /api/editions shows which slots are still open.`);
    error.status = 409;
    throw error;
  }
  if (!slot) slot = "extra";
  const tags = asList(input.tags, 8).map((tag) => tag.toLowerCase());
  const kicker = clip(input.kicker || tags[0] || "Story", 24);
  const palette = PALETTE_NAMES.includes(input.palette) ? input.palette : PALETTE_NAMES[title.length % PALETTE_NAMES.length];
  const motif = MOTIFS.includes(input.motif) ? input.motif : MOTIFS[title.length % MOTIFS.length];
  const label = clip(input.label || kicker, 12).toUpperCase().replace(/[^A-Z0-9 ]/g, "") || "SPOON";
  const sources = (Array.isArray(input.sources) ? input.sources : []).slice(0, 6).map((source) => ({
    title: clip(source?.title, 180),
    url: httpUrl(source?.url),
    source: clip(source?.source, 40),
  })).filter((source) => source.title && source.url);
  let imagePath = null;
  if (input.image_base64) imagePath = saveImage(pictureFromBase64(input.image_base64), slug);
  else if (input.image_url) {
    const remote = httpUrl(input.image_url);
    if (!remote) {
      const error = new Error("image_url needs to be a public http or https link.");
      error.status = 400;
      throw error;
    }
    imagePath = saveImage(await pictureFromUrl(remote), slug);
  }
  const figures = [];
  const requestedFigures = Array.isArray(input.figures) ? input.figures.slice(0, 3) : [];
  for (let index = 0; index < requestedFigures.length; index += 1) {
    const item = requestedFigures[index] || {};
    const remote = httpUrl(item.image_url || item.url);
    if (!remote) continue;
    const pathName = saveImage(await pictureFromUrl(remote), `${slug}-fig-${index + 1}`);
    figures.push({
      path: pathName,
      alt: clip(item.alt || item.caption || title, 180),
      caption: clip(item.caption, 240),
      credit: clip(item.credit, 180),
    });
  }
  let markdown = body;
  figures.forEach((_, index) => {
    markdown = markdown.replaceAll(`[[figure:${index}]]`, `\n\nSPOONFIGURE${index}\n\n`);
  });
  let bodyHtml = renderMarkdown(markdown);
  figures.forEach((figure, index) => {
    const caption = [figure.caption, figure.credit].filter(Boolean).join(" ");
    const block = `<figure class="story-figure"><img src="${escapeHtml(figure.path)}" alt="${escapeHtml(figure.alt)}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    const token = `SPOONFIGURE${index}`;
    if (bodyHtml.includes(token)) bodyHtml = bodyHtml.replace(`<p>${token}</p>`, block).replace(token, block);
    else bodyHtml += block;
  });
  const artSvg = renderCover({
    label,
    palette,
    motif,
    seed: `${slug}:${title}`,
    corner: kicker,
    dateLabel: clock.stamp,
  });
  const words = wordCount(body);
  await store.insertArticle({
    slug,
    title,
    dek: clip(input.dek, 240) || clip(body.replace(/[#>*_\n]+/g, " "), 180),
    kicker,
    bodyHtml,
    bodyMd: body,
    tags,
    queries: asList(input.queries, 4, 80),
    slot,
    editionDate,
    sources,
    artSvg,
    imagePath,
    imagePrompt: "",
    kind: "story",
    aiModel: null,
    minutes: Math.max(1, Math.round(words / 220)),
    publication,
  });
  return { slug, title, slot, date: editionDate, publication };
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function removeStoryFiles(slug) {
  const dir = path.join(process.cwd(), "public", "media");
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  const pattern = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-fig-\\d+)?\\.(?:png|jpe?g|gif|webp)$`, "i");
  for (const name of names) {
    if (pattern.test(name)) fs.rmSync(path.join(dir, name), { force: true });
  }
}

async function composeBody(body, figures) {
  let markdown = body;
  figures.forEach((_, index) => {
    markdown = markdown.replaceAll(`[[figure:${index}]]`, `\n\nSPOONFIGURE${index}\n\n`);
  });
  let bodyHtml = renderMarkdown(markdown);
  figures.forEach((figure, index) => {
    const caption = [figure.caption, figure.credit].filter(Boolean).join(" ");
    const block = `<figure class="story-figure"><img src="${escapeHtml(figure.path)}" alt="${escapeHtml(figure.alt)}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    const token = `SPOONFIGURE${index}`;
    if (bodyHtml.includes(token)) bodyHtml = bodyHtml.replace(`<p>${token}</p>`, block).replace(token, block);
    else bodyHtml += block;
  });
  return bodyHtml;
}

export async function updateStory(slug, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(400, "Send a JSON object with the fields to change.");
  const current = await store.getBySlug(slug);
  if (!current) fail(404, "No story with that slug.");
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);
  const title = has("title") ? clip(input.title, 140) : current.title;
  const body = has("body") || has("body_markdown") ? repairText(input.body_markdown || input.body).trim() : String(current.body_md || "");
  if (!title || body.length < 40) fail(400, "Send a title and the article text.");
  if (body.length > 100000) fail(400, "The article text is longer than 100,000 characters.");
  let nextSlug = slug;
  if (has("slug")) {
    nextSlug = cleanSlug(input.slug);
    if (!nextSlug) fail(400, "The slug can use letters, numbers, and hyphens.");
    if (nextSlug !== slug && await store.getBySlug(nextSlug)) fail(409, "A story with that slug is already published.");
  }
  const publication = has("publication") ? String(input.publication || "").trim().toLowerCase() : (current.publication || "magazine");
  if (!titleBySlug(publication)) fail(400, `publication must be one of: ${TITLES.map((item) => item.slug).join(", ")}.`);
  let editionDate = current.edition_date;
  if (has("date")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))) fail(400, "date needs to be YYYY-MM-DD.");
    editionDate = String(input.date);
  }
  let slot = publication === "magazine" ? current.slot : "extra";
  if (publication === "magazine" && has("slot")) {
    const requested = String(input.slot || "");
    if (![...SLOT_ORDER, "extra"].includes(requested)) fail(400, "slot must be morning, midday, evening, or extra.");
    slot = requested;
  }
  if (publication === "magazine" && SLOT_ORDER.includes(slot)) {
    const taken = await store.findEdition(editionDate, slot);
    if (taken && taken.slug !== slug) fail(409, `${slotMeta(slot).label} for ${editionDate} already has a story.`);
  }
  const tags = has("tags") ? asList(input.tags, 8).map((tag) => tag.toLowerCase()) : current.tags;
  const kicker = has("kicker") ? clip(input.kicker, 24) : current.kicker;
  const dek = has("dek") ? clip(input.dek, 240) : current.dek;
  const queries = has("queries") ? asList(input.queries, 4, 80) : current.queries;
  const sources = has("sources")
    ? (Array.isArray(input.sources) ? input.sources : []).slice(0, 6).map((source) => ({
      title: clip(source?.title, 180),
      url: httpUrl(source?.url),
      source: clip(source?.source, 40),
    })).filter((source) => source.title && source.url)
    : current.sources;
  let imagePath = current.image_path;
  if (input.remove_image) imagePath = null;
  if (input.image_base64) imagePath = saveImage(pictureFromBase64(input.image_base64), nextSlug);
  else if (has("image_url") && input.image_url) {
    const remote = httpUrl(input.image_url);
    if (!remote) fail(400, "image_url needs to be a public http or https link.");
    imagePath = saveImage(await pictureFromUrl(remote), nextSlug);
  }
  const figures = [];
  const requestedFigures = Array.isArray(input.figures) ? input.figures.slice(0, 3) : [];
  for (let index = 0; index < requestedFigures.length; index += 1) {
    const item = requestedFigures[index] || {};
    const remote = httpUrl(item.image_url || item.url);
    if (!remote) continue;
    const pathName = saveImage(await pictureFromUrl(remote), `${nextSlug}-fig-${index + 1}`);
    figures.push({
      path: pathName,
      alt: clip(item.alt || item.caption || title, 180),
      caption: clip(item.caption, 240),
      credit: clip(item.credit, 180),
    });
  }
  const bodyChanged = has("body") || has("body_markdown") || figures.length > 0;
  let bodyHtml = current.body_html;
  if (figures.length) bodyHtml = await composeBody(body, figures);
  else if (bodyChanged && body.includes("[[figure:")) {
    const kept = [...String(current.body_html || "").matchAll(/<figure class="story-figure">[\s\S]*?<\/figure>/g)].map((match) => match[0]);
    let markdown = body;
    kept.forEach((_, index) => {
      markdown = markdown.replaceAll(`[[figure:${index}]]`, `\n\nSPOONFIGURE${index}\n\n`);
    });
    bodyHtml = renderMarkdown(markdown);
    kept.forEach((block, index) => {
      const token = `SPOONFIGURE${index}`;
      if (bodyHtml.includes(token)) bodyHtml = bodyHtml.replace(`<p>${token}</p>`, block).replace(token, block);
    });
  } else if (bodyChanged) bodyHtml = renderMarkdown(body);
  let artSvg = current.art_svg;
  if (has("palette") || has("motif") || has("label")) {
    const palette = PALETTE_NAMES.includes(input.palette) ? input.palette : PALETTE_NAMES[title.length % PALETTE_NAMES.length];
    const motif = MOTIFS.includes(input.motif) ? input.motif : MOTIFS[title.length % MOTIFS.length];
    const label = clip(input.label || kicker, 12).toUpperCase().replace(/[^A-Z0-9 ]/g, "") || "SPOON";
    artSvg = renderCover({ label, palette, motif, seed: `${nextSlug}:${title}`, corner: kicker, dateLabel: editionDate });
  }
  const saved = await store.updateArticle(slug, {
    slug: nextSlug,
    title,
    dek: dek || clip(body.replace(/[#>*_\n]+/g, " "), 180),
    kicker: kicker || clip(tags[0] || "Story", 24),
    bodyHtml,
    bodyMd: body,
    tags,
    queries,
    slot,
    editionDate,
    sources,
    artSvg,
    imagePath,
    minutes: Math.max(1, Math.round(wordCount(body) / 220)),
    publication,
  });
  if (!saved) fail(404, "No story with that slug.");
  if (nextSlug !== slug && (input.image_base64 || input.image_url || input.remove_image)) removeStoryFiles(slug);
  return { slug: nextSlug, title, slot, date: editionDate, publication };
}

export async function removeStories(slugs) {
  const unique = [...new Set(slugs.map((slug) => cleanSlug(slug)).filter(Boolean))].slice(0, 100);
  if (!unique.length) fail(400, "Send one or more story slugs.");
  const deleted = await store.deleteBySlugs(unique);
  for (const slug of deleted) removeStoryFiles(slug);
  return { deleted, missing: unique.filter((slug) => !deleted.includes(slug)) };
}
