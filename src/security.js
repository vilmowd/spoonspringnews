import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { AsyncLocalStorage } from "node:async_hooks";
export const requestContext = new AsyncLocalStorage();

const sessions = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;

export function safeEqual(a, b) {
  const left = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const right = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(left, right);
}

export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function requestIsHttps(req) {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  return proto === "https";
}

export function createSession() {
  const id = crypto.randomBytes(32).toString("base64url");
  sessions.set(id, Date.now() + SESSION_MS);
  return id;
}

export function validSession(id) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(id || ""))) return false;
  const expires = sessions.get(id);
  if (!expires || expires < Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}

export function destroySession(id) {
  sessions.delete(id);
}

export function deskCookie(req, value, maxAge) {
  const secure = requestIsHttps(req) ? "; Secure" : "";
  return `spoonspring_desk=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearDeskCookies(req) {
  const secure = requestIsHttps(req) ? "; Secure" : "";
  const flags = `HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
  return [
    `spoonspring_desk=; ${flags}`,
    `folio_desk=; ${flags}`,
  ];
}

export function limitRequests({ windowMs, max, keyFn }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);
    const hits = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
    if (hits.length >= max) {
      const retry = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
      res.set("Retry-After", String(retry));
      res.set("Cache-Control", "no-store");
      if (req.path.startsWith("/api/")) {
        return res.status(429).json({ ok: false, message: "Too many requests. Try again shortly." });
      }
      return res.status(429).type("text").send("Too many requests. Try again shortly.");
    }
    hits.push(now);
    buckets.set(key, hits);
    if (buckets.size > 5000) {
      for (const [name, stamps] of buckets) {
        if (stamps.every((stamp) => now - stamp >= windowMs)) buckets.delete(name);
      }
    }
    return next();
  };
}

export const limitLogin = limitRequests({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyFn: (req) => `login:${clientIp(req)}`,
});

export const limitPublish = limitRequests({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyFn: (req) => `publish:${clientIp(req)}`,
});

export const limitPublishGlobal = limitRequests({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyFn: () => "publish:all",
});

export const limitEvents = limitRequests({
  windowMs: 60 * 1000,
  max: 90,
  keyFn: (req) => `event:${clientIp(req)}`,
});

export const limitManage = limitRequests({
  windowMs: 10 * 60 * 1000,
  max: 80,
  keyFn: (req) => `manage:${clientIp(req)}`,
});

export const limitManageGlobal = limitRequests({
  windowMs: 60 * 60 * 1000,
  max: 400,
  keyFn: () => "manage:all",
});

export const limitRead = limitRequests({
  windowMs: 60 * 1000,
  max: 120,
  keyFn: (req) => `read:${clientIp(req)}`,
});

export const limitSearch = limitRequests({
  windowMs: 60 * 1000,
  max: 40,
  keyFn: (req) => `search:${clientIp(req)}`,
});

function isPrivateIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (kind === 6) {
    const value = ip.toLowerCase();
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
    if (value.startsWith("::ffff:")) return isPrivateIp(value.slice(7));
    return false;
  }
  return true;
}

export function isPublicHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return "";
    if (host === "metadata.google.internal" || host === "0.0.0.0") return "";
    if (net.isIP(host) && isPrivateIp(host)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function assertPublicUrl(value) {
  const href = isPublicHttpUrl(value);
  if (!href) {
    const error = new Error("The picture link is not a public http(s) address.");
    error.status = 400;
    throw error;
  }
  const { hostname } = new URL(href);
  if (net.isIP(hostname)) return href;
  let records = [];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    const error = new Error("Could not resolve the picture host.");
    error.status = 400;
    throw error;
  }
  if (!records.length || records.some((row) => isPrivateIp(row.address))) {
    const error = new Error("The picture link is not a public http(s) address.");
    error.status = 400;
    throw error;
  }
  return href;
}

export function bindRequest(req, res, next) {
  const nonce = crypto.randomBytes(16).toString("base64url");
  res.locals.cspNonce = nonce;
  requestContext.run({ nonce }, () => {
    const https = requestIsHttps(req);
    const ads = [
      "https://pagead2.googlesyndication.com",
      "https://www.googletagservices.com",
      "https://adservice.google.com",
      "https://www.google.com",
      "https://googleads.g.doubleclick.net",
      "https://tpc.googlesyndication.com",
    ].join(" ");
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${ads}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      `connect-src 'self' ${ads}`,
      `frame-src 'self' ${ads}`,
      "form-action 'self'",
      https ? "upgrade-insecure-requests" : "",
    ].filter(Boolean).join("; ");
    res.set({
      "Content-Security-Policy": csp,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      "X-Permitted-Cross-Domain-Policies": "none",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "X-DNS-Prefetch-Control": "off",
    });
    if (https) res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    if (req.path.startsWith("/api/") || req.path.startsWith("/desk")) res.set("Cache-Control", "no-store");
    next();
  });
}

export function pageNonce() {
  return requestContext.getStore()?.nonce || "";
}
