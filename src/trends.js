function decode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function getText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Spoonspring/1.0 (magazine)", Accept: "application/json, application/xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.text();
}

async function hackerNews() {
  const ids = JSON.parse(await getText("https://hacker-news.firebaseio.com/v0/topstories.json")).slice(0, 12);
  const items = await Promise.all(ids.map(async (id) => {
    try {
      return JSON.parse(await getText(`https://hacker-news.firebaseio.com/v0/item/${id}.json`));
    } catch {
      return null;
    }
  }));
  return items.filter(Boolean).map((item) => ({
    title: decode(item.title),
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    source: "Hacker News",
    score: Number(item.score) || 0,
  }));
}

async function bbcNews() {
  const xml = await getText("https://feeds.bbci.co.uk/news/rss.xml");
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);
  return items.map((match) => {
    const block = match[1];
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] || "");
    return { title, url: link, source: "BBC News", score: 0 };
  }).filter((item) => item.title && item.url);
}

export async function fetchTrends() {
  const settled = await Promise.allSettled([hackerNews(), bbcNews()]);
  const seeds = [];
  const seen = new Set();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = item.title.toLowerCase();
      if (!item.title || seen.has(key)) continue;
      seen.add(key);
      seeds.push(item);
    }
  }
  if (!seeds.length) {
    const reason = settled.map((result) => (result.status === "rejected" ? result.reason?.message : "")).filter(Boolean).join("; ");
    throw new Error(reason || "No headlines came back.");
  }
  return seeds.slice(0, 14);
}
