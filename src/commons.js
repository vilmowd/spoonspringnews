function plain(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function usableLicense(license) {
  if (!license) return false;
  return !/copyright|all rights reserved|unknown|non-free|fair use/i.test(license);
}

export async function findFreePhoto(query) {
  const search = String(query || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (search.length < 3) return null;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `${search} filetype:bitmap`);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|mime|extmetadata");
  url.searchParams.set("iiurlwidth", "1280");
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Spoonspring/1.0 (magazine image search)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = Object.values(data.query?.pages || {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = String(info.mime || "");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) continue;
    const meta = info.extmetadata || {};
    const license = plain(meta.LicenseShortName?.value);
    if (!usableLicense(license)) continue;
    const thumb = info.thumburl || "";
    const width = Number(info.thumbwidth) || 0;
    if (!thumb.startsWith("https://") || width < 640) continue;
    if (Number(info.thumbsize || info.size || 0) > 6 * 1024 * 1024) continue;
    return {
      url: thumb,
      title: plain(page.title).replace(/^File:/, ""),
      artist: plain(meta.Artist?.value).slice(0, 180) || "the photographer credited on the file",
      license,
      description: plain(meta.ImageDescription?.value).slice(0, 180),
    };
  }
  return null;
}
