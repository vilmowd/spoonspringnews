import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3000),
  databaseUrl: (process.env.DATABASE_URL || "").trim(),
  pgPort: num(process.env.PG_PORT, 5433),
  pgPool: Math.min(20, Math.max(2, num(process.env.PG_POOL, 10))),
  tz: process.env.SCHED_TZ || "Etc/GMT-3",
  hours: {
    morning: num(process.env.MORNING_HOUR, 8),
    midday: num(process.env.MIDDAY_HOUR, 12),
    evening: num(process.env.EVENING_HOUR, 18),
  },
  text: {
    key: (process.env.TEXT_API_KEY || "").trim(),
    base: (process.env.TEXT_API_BASE || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.TEXT_MODEL || "gpt-4o-mini",
  },
  image: {
    key: (process.env.IMAGE_API_KEY || "").trim(),
    base: (process.env.IMAGE_API_BASE || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.IMAGE_MODEL || "dall-e-3",
  },
  deskToken: process.env.DESK_TOKEN || "folio-desk",
  publishKey: loadPublishKey(),
  amazonTag: (process.env.AMAZON_TAG || "").trim(),
  adsenseClient: (process.env.ADSENSE_CLIENT || "").trim(),
  adsenseSlot: (process.env.ADSENSE_SLOT || "").trim(),
  adsenseCpmCents: num(process.env.ADSENSE_CPM_CENTS, 0),
  tipUrl: (process.env.TIP_URL || "").trim(),
  tipLabel: process.env.TIP_LABEL || "Support this desk",
  siteUrl: siteOrigin(process.env.SITE_URL),
  contactEmail: contactEmail(process.env.CONTACT_EMAIL),
  trustProxy: process.env.TRUST_PROXY === "1",
  googleSiteVerification: verificationToken(process.env.GOOGLE_SITE_VERIFICATION),
};

function siteOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function contactEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function verificationToken(value) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,120}$/.test(token) ? token : "";
}

function loadPublishKey() {
  const current = (process.env.PUBLISH_KEY || "").trim();
  if (current) return current;
  const key = crypto.randomBytes(24).toString("hex");
  const envPath = path.join(process.cwd(), ".env");
  let text = "";
  try { text = fs.readFileSync(envPath, "utf8"); } catch { text = ""; }
  if (/^PUBLISH_KEY=/m.test(text)) text = text.replace(/^PUBLISH_KEY=.*$/m, `PUBLISH_KEY=${key}`);
  else text = `${text.replace(/\s*$/, "")}\n\n# Secret for the publish API. Send it as Authorization: Bearer <key>\nPUBLISH_KEY=${key}\n`;
  fs.writeFileSync(envPath, text);
  return key;
}

export function tzLabel(tz = config.tz) {
  const match = /^Etc\/GMT([+-]\d+)$/.exec(tz);
  if (match) {
    const offset = -Number(match[1]);
    return `UTC${offset >= 0 ? "+" : ""}${offset}`;
  }
  return tz;
}
