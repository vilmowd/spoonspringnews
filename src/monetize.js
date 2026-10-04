function includesTerm(blob, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return false;
  if (needle.length <= 3) return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob);
  return blob.includes(needle);
}

export function amazonUrl(query, tag) {
  if (!tag || !query) return "";
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${encodeURIComponent(tag)}`;
}

export function matchOffers(offers, article, amazonTag) {
  const blob = [...(article.tags || []), ...(article.queries || [])].join(" ").toLowerCase();
  const matched = [];
  for (const offer of offers) {
    if (!offer.active) continue;
    const hit = (offer.keywords || []).some((keyword) => includesTerm(blob, keyword));
    if (!hit) continue;
    const url = offer.href || amazonUrl(offer.query, amazonTag);
    if (!url) continue;
    matched.push({ ...offer, url });
    if (matched.length === 2) break;
  }
  return matched;
}

export function pickSponsor(sponsors, articleId) {
  const active = sponsors.filter((sponsor) => sponsor.active && sponsor.href);
  if (!active.length) return null;
  const index = Math.abs(Number(articleId) || 0) % active.length;
  return active[index];
}

export function money(cents) {
  const n = Number(cents) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${(Math.abs(n) / 100).toFixed(2)}`;
}
