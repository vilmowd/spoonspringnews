import { config } from "./config.js";

export const SLOT_ORDER = ["morning", "midday", "evening"];

const LABELS = { morning: "Morning", midday: "Midday", evening: "Evening" };

export function slotMeta(name) {
  const hour = config.hours[name];
  return {
    name,
    label: LABELS[name] || name,
    hour,
    time: `${String(hour).padStart(2, "0")}:00`,
  };
}

export function zonedNow(date = new Date(), timeZone = config.tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const monthName = new Intl.DateTimeFormat("en-US", { timeZone, month: "long" }).format(date);
  const dayNum = Number(parts.day);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute: Number(parts.minute),
    weekday: parts.weekday,
    pretty: `${parts.weekday}, ${monthName} ${dayNum}`,
    stamp: `${dayNum} ${monthName.slice(0, 3).toUpperCase()}`,
  };
}

export function prettyDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function shortDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function monthYear(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function issueNumber(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const start = Date.UTC(2026, 0, 1);
  return Math.round((utc - start) / 86400000) + 1;
}

export function dueSlot(now = new Date()) {
  const z = zonedNow(now);
  let chosen = null;
  for (const name of SLOT_ORDER) {
    const hour = config.hours[name];
    if (z.hour >= hour && (chosen === null || hour >= config.hours[chosen])) chosen = name;
  }
  return { slot: chosen, date: z.date, clock: z };
}
