import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { PALETTES, MOTIFS } from "./art.js";
import { tagsForSection } from "./sections.js";

const PALETTE_NAMES = Object.keys(PALETTES);

function stripFence(text) {
  return String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function parseJson(text) {
  const clean = stripFence(text);
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The model did not return JSON.");
    return JSON.parse(clean.slice(start, end + 1));
  }
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function asList(value, max) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((item) => clip(item, 40)).filter(Boolean).slice(0, max);
}

export function normalizeDraft(raw, seeds) {
  const title = clip(raw.title, 140);
  const body = String(raw.body_markdown || raw.body || "").trim();
  if (!title || body.length < 80) throw new Error("The model returned a briefing that was too thin to publish.");
  const palette = PALETTE_NAMES.includes(raw.art?.palette) ? raw.art.palette : PALETTE_NAMES[title.length % PALETTE_NAMES.length];
  const motif = MOTIFS.includes(raw.art?.motif) ? raw.art.motif : MOTIFS[title.length % MOTIFS.length];
  const indexes = Array.isArray(raw.seed_indexes) ? raw.seed_indexes.map(Number).filter((n) => seeds[n]) : [];
  const used = (indexes.length ? indexes.map((n) => seeds[n]) : seeds.slice(0, 4)).slice(0, 5);
  return {
    title,
    dek: clip(raw.dek, 240) || title,
    kicker: clip(raw.kicker, 24).toUpperCase() || "BRIEFING",
    tags: asList(raw.tags, 6).map((tag) => tag.toLowerCase()),
    queries: asList(raw.queries, 4),
    body,
    art: {
      palette,
      motif,
      label: clip(raw.art?.label, 12).toUpperCase().replace(/[^A-Z0-9 ]/g, "") || clip(raw.kicker, 12).toUpperCase() || "SPOON",
    },
    imagePrompt: clip(raw.image_prompt, 500),
    imageSearch: clip(raw.image_search, 120),
    sources: used.map((seed) => ({ title: seed.title, url: seed.url, source: seed.source })),
  };
}

async function chat(messages) {
  const res = await fetch(`${config.text.base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.text.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.text.model,
      temperature: 0.7,
      messages,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Text API ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Text API returned an empty briefing.");
  return content;
}

export async function writeBriefing({ slot, seeds, recentTitles, section }) {
  if (!config.text.key) {
    const error = new Error("Add TEXT_API_KEY to .env before Spoonspring can publish stories.");
    error.code = "NO_KEY";
    throw error;
  }
  const seedList = seeds.map((seed, index) => `${index}. [${seed.source}] ${seed.title} — ${seed.url}`).join("\n");
  const covered = recentTitles.length ? recentTitles.map((title) => `- ${title}`).join("\n") : "- none yet";
  const assignment = section
    ? `File one ${section.label} story.

The story has to belong in ${section.label}. Prefer a headline that fits ${section.label}. If none of the headlines fit, write about a current ${section.label} subject a general reader would still care about. Do not write a story for another section. Set "kicker" to "${section.label}" and include "${section.slug}" in "tags". Skip topics already covered.`
    : `File the ${slot} briefing.

Choose one topic from the headlines that a general reader would still care about tonight. Skip topics already covered.`;
  const messages = [
    {
      role: "system",
      content: "You are the editor of Spoonspring, a magazine. You return only JSON. Do not claim a person reported the story. Do not invent quotes or numbers.",
    },
    {
      role: "user",
      content: `${assignment}

Write an original explainer. Headlines are pointers only. Do not copy sentences from them. Do not invent quotes, numbers, studies, or named facts. Where a detail is not in your reliable knowledge, say what is still unclear. Explain why the topic matters and what is worth watching next.

Return JSON with this shape:
{
  "title": "specific, calm, under 90 characters",
  "dek": "one sentence under 180 characters",
  "kicker": "ONE OR TWO WORDS",
  "tags": ["three", "lowercase", "topics"],
  "queries": ["a book or tool a curious reader might look up", "another short search phrase"],
  "seed_indexes": [0],
  "body_markdown": "500 to 800 words. Start with a paragraph. Use ## subheads. Short paragraphs. At most one blockquote, and it must be your own summary, not a quotation from a person.",
  "art": { "palette": "clay|tide|ink|moss|dusk|citrus", "motif": "orbit|grid|wave|stack|slash|ring", "label": "ONE WORD" },
  "image_prompt": "an editorial illustration with no text, no letters, no logos, and no real people",
  "image_search": "two or three words for a Wikimedia Commons search of a real place or object connected to the topic, not a search for a photo of the event itself"
}

Already covered:
${covered}

Headlines:
${seedList}`,
    },
  ];
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await chat(attempt === 0 ? messages : [...messages, {
        role: "user",
        content: "The last reply could not be published. Return only the JSON object, with a full body_markdown.",
      }]);
      const draft = normalizeDraft(parseJson(content), seeds);
      if (section) {
        draft.kicker = section.label;
        draft.tags = tagsForSection(draft.tags, section);
      }
      return draft;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function makeRaster(prompt, slug) {
  if (!config.image.key || !prompt) return null;
  const baseBody = {
    model: config.image.model,
    prompt: `${prompt}. Editorial illustration for a print magazine, limited palette, no text, no letters, no watermark, no logos, no photorealistic faces.`,
    size: "1024x1024",
  };
  let res = await fetch(`${config.image.base}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.image.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...baseBody, response_format: "b64_json" }),
    signal: AbortSignal.timeout(120000),
  });
  if (res.status === 400) {
    res = await fetch(`${config.image.base}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.image.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(baseBody),
      signal: AbortSignal.timeout(120000),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Image API ${res.status}: ${text.slice(0, 300)}`);
  const item = JSON.parse(text).data?.[0];
  if (!item) return null;
  let buffer = null;
  if (item.b64_json) buffer = Buffer.from(item.b64_json, "base64");
  else if (item.url) {
    const image = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
    if (!image.ok) throw new Error(`Could not download the generated image (${image.status}).`);
    buffer = Buffer.from(await image.arrayBuffer());
  }
  if (!buffer) return null;
  const dir = path.join(process.cwd(), "public", "media");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${slug}.png`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return `/media/${name}`;
}
