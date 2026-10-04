import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { fetchTrends } from "./trends.js";
import { writeBriefing } from "./writer.js";
import { findFreePhoto } from "./commons.js";

function magazineUrl() {
  return (process.env.MAGAZINE_URL || `http://127.0.0.1:${config.port}`).replace(/\/$/, "");
}

async function magazine(path, options = {}) {
  const res = await fetch(`${magazineUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.publishKey}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `The magazine returned ${res.status}.`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function withCredit(body, photo) {
  if (!photo) return body;
  const subject = photo.description || photo.title;
  const credit = `The photograph shows ${subject}. It was made by ${photo.artist}, and it is free to reuse under ${photo.license}. It is a Wikimedia Commons file, not a picture taken for this story.`;
  return `${body.trim()}\n\n${credit}`;
}

export function engineReady() {
  return Boolean(config.text.key);
}

export function engineHint() {
  const hour = String(config.hours.morning).padStart(2, "0");
  if (config.text.key) {
    return `The writing key is set (${config.text.model}). After ${hour}:00 the magazine files one story in each section.`;
  }
  return `Add a free TEXT_API_KEY before a story can be written. After ${hour}:00 the magazine then files one story in each section. Google AI Studio and Groq both have a free tier. The addresses are in .env.example.`;
}

export async function fileStory({ section } = {}) {
  if (!config.text.key) {
    const error = new Error(engineHint());
    error.code = "NO_KEY";
    throw error;
  }
  const [trends, listed] = await Promise.all([
    fetchTrends(),
    magazine("/api/articles?limit=12"),
  ]);
  const recentTitles = (listed.articles || []).map((article) => article.title);
  const draft = await writeBriefing({
    slot: section ? section.label : "evening",
    seeds: trends,
    recentTitles,
    section,
  });
  const photo = await findFreePhoto(draft.imageSearch || section?.label || draft.kicker).catch(() => null);
  const story = await magazine("/api/articles", {
    method: "POST",
    body: JSON.stringify({
      title: draft.title,
      dek: draft.dek,
      kicker: draft.kicker,
      tags: draft.tags,
      queries: draft.queries,
      sources: draft.sources,
      body: withCredit(draft.body, photo),
      publication: "magazine",
      slot: section ? "extra" : undefined,
      ...(photo ? { image_url: photo.url } : {}),
    }),
  });
  return { ...story, photo: Boolean(photo), section: section?.slug || "" };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  fileStory()
    .then((story) => {
      console.log(story.url || story.slug);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
