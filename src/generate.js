import { config } from "./config.js";
import { zonedNow, slotMeta } from "./clock.js";
import { renderCover } from "./art.js";
import { renderMarkdown, wordCount } from "./markdown.js";
import { fetchTrends } from "./trends.js";
import { writeBriefing, makeRaster } from "./writer.js";
import * as store from "./store.js";

let busy = false;

function slugify(title) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "briefing"}-${suffix}`;
}

export function isBusy() {
  return busy;
}

export async function publishEdition(slot, editionDate, { force = false } = {}) {
  if (!["morning", "midday", "evening"].includes(slot)) {
    throw new Error("Choose morning, midday, or evening.");
  }
  const date = editionDate || zonedNow().date;
  if (busy) return { ok: false, skipped: true, message: "The desk is already filing a briefing." };
  const existing = await store.findEdition(date, slot);
  if (existing && !force) {
    return { ok: true, skipped: true, message: `${slotMeta(slot).label} edition for ${date} is already filed.`, slug: existing.slug };
  }
  if (!config.text.key) {
    const message = "Add TEXT_API_KEY to .env before Spoonspring can publish stories.";
    await store.logRun(slot, "skipped", message);
    return { ok: false, message };
  }
  busy = true;
  try {
    const seeds = await fetchTrends();
    const recent = await store.recentTitles();
    const draft = await writeBriefing({ slot, seeds, recentTitles: recent });
    const slug = slugify(draft.title);
    const clock = zonedNow();
    const artSvg = renderCover({
      label: draft.art.label,
      palette: draft.art.palette,
      motif: draft.art.motif,
      seed: `${slug}:${draft.title}`,
      corner: `${slotMeta(slot).label} edition`,
      dateLabel: clock.stamp,
    });
    let imagePath = null;
    if (config.image.key) {
      try {
        imagePath = await makeRaster(draft.imagePrompt, slug);
      } catch (error) {
        console.error(`[spoonspring] cover image skipped: ${error.message}`);
      }
    }
    const words = wordCount(draft.body);
    try {
      await store.insertArticle({
        slug,
        title: draft.title,
        dek: draft.dek,
        kicker: draft.kicker,
        bodyHtml: renderMarkdown(draft.body),
        bodyMd: draft.body,
        tags: draft.tags,
        queries: draft.queries,
        slot,
        editionDate: date,
        sources: draft.sources,
        artSvg,
        imagePath,
        imagePrompt: draft.imagePrompt,
        kind: "briefing",
        aiModel: config.text.model,
        minutes: Math.max(1, Math.round(words / 220)),
      });
    } catch (error) {
      if (error.code === "23505" && error.constraint === "articles_one_briefing_per_slot") {
        const again = await store.findBriefing(date, slot);
        return { ok: true, skipped: true, message: `${slotMeta(slot).label} edition was just filed.`, slug: again?.slug };
      }
      throw error;
    }
    await store.logRun(slot, "ok", draft.title);
    return { ok: true, slug, message: `${slotMeta(slot).label} edition filed: ${draft.title}` };
  } catch (error) {
    const status = error.code === "NO_KEY" ? "skipped" : "error";
    await store.logRun(slot, status, error.message);
    return { ok: false, message: error.message };
  } finally {
    busy = false;
  }
}
