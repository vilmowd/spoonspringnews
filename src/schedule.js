import { config } from "./config.js";
import { zonedNow } from "./clock.js";
import { SECTIONS, TOPIC_TAGS } from "./sections.js";
import { fileStory } from "./engine.js";
import * as store from "./store.js";

let timer;
let running = false;
let doneDate = "";
let retryAt = 0;
let quietLogged = false;

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileDailySections() {
  const now = zonedNow();
  if (now.hour < config.hours.morning) return;
  if (!config.text.key) {
    if (!quietLogged) {
      console.error("[spoonspring] daily sections skipped until TEXT_API_KEY is set");
      quietLogged = true;
    }
    return;
  }
  if (doneDate === now.date || Date.now() < retryAt || running) return;
  running = true;
  try {
    const covered = await store.sectionsFiledOn(now.date, TOPIC_TAGS);
    const pending = SECTIONS.filter((section) => !covered.has(section.slug));
    if (!pending.length) {
      doneDate = now.date;
      return;
    }
    let failed = false;
    for (const section of pending) {
      try {
        const story = await fileStory({ section });
        console.log(`[spoonspring] filed ${section.label}: ${story.slug}`);
      } catch (error) {
        failed = true;
        console.error(`[spoonspring] ${section.label} not filed: ${error.message}`);
      }
      await pause(2000);
    }
    const again = await store.sectionsFiledOn(now.date, TOPIC_TAGS);
    if (SECTIONS.every((section) => again.has(section.slug))) doneDate = now.date;
    else if (failed) retryAt = Date.now() + 60 * 60 * 1000;
  } catch (error) {
    retryAt = Date.now() + 60 * 60 * 1000;
    console.error(`[spoonspring] scheduler: ${error.message}`);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  fileDailySections();
  timer = setInterval(fileDailySections, 60 * 1000);
  timer.unref?.();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
}
