import { pool } from "./db.js";

const VISIBLE = "('briefing', 'story')";
const FILED = "('briefing', 'story')";

const CARD = `id, slug, title, dek, kicker, tags, queries, slot, publication, to_char(edition_date, 'YYYY-MM-DD') AS edition_date,
  image_path, kind, minutes, created_at, updated_at`;
const FULL = `${CARD}, body_html, body_md, sources, art_svg, image_prompt, ai_model`;

function mapArticle(row) {
  if (!row) return null;
  return {
    ...row,
    tags: row.tags || [],
    queries: row.queries || [],
    sources: Array.isArray(row.sources) ? row.sources : [],
    minutes: Number(row.minutes) || 1,
  };
}

export async function listBriefings(limit = 30) {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles WHERE kind = 'briefing' ORDER BY edition_date DESC,
      CASE slot WHEN 'evening' THEN 1 WHEN 'midday' THEN 2 ELSE 3 END, id DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapArticle);
}

export async function listAllBriefings() {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles WHERE kind = 'briefing' ORDER BY edition_date DESC,
      CASE slot WHEN 'evening' THEN 1 WHEN 'midday' THEN 2 ELSE 3 END, id DESC LIMIT 500`,
  );
  return rows.map(mapArticle);
}

export async function listHome(limit = 12) {
  const posts = await listPublished(limit);
  if (posts.length) return posts;
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles WHERE kind = 'guide'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map(mapArticle);
}

export async function listByPublication(publication, limit = 24) {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles
     WHERE kind IN ${VISIBLE} AND publication = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [publication, limit],
  );
  return rows.map(mapArticle);
}

export async function countByPublication() {
  const { rows } = await pool.query(
    `SELECT publication, count(*)::int AS n FROM articles WHERE kind IN ${VISIBLE} GROUP BY publication`,
  );
  return Object.fromEntries(rows.map((row) => [row.publication, row.n]));
}

export async function listPublished(limit = 60) {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles WHERE kind IN ${VISIBLE}
     ORDER BY edition_date DESC, created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map(mapArticle);
}

export async function listByTopic(tags, limit = 24) {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles
     WHERE kind IN ${VISIBLE} AND tags && $1::text[]
     ORDER BY created_at DESC
     LIMIT $2`,
    [tags, limit],
  );
  return rows.map(mapArticle);
}

export async function searchArticles(query, limit = 24) {
  const safe = String(query || "").replace(/[%_\\]/g, "").trim();
  if (!safe) return [];
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles
     WHERE kind IN ${VISIBLE}
       AND (title ILIKE $1 OR dek ILIKE $1 OR kicker ILIKE $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [`%${safe}%`, limit],
  );
  return rows.map(mapArticle);
}

export async function getBySlug(slug) {
  const { rows } = await pool.query(`SELECT ${FULL} FROM articles WHERE slug = $1`, [slug]);
  return mapArticle(rows[0]);
}

export async function pageArticles({ page = 1, limit = 20, publication = "", query = "" } = {}) {
  const size = Math.min(50, Math.max(1, Number(limit) || 20));
  const current = Math.max(1, Number(page) || 1);
  const offset = (current - 1) * size;
  if (offset > 10000) {
    const error = new Error("That page is too far down the list. Narrow it with a title or a publication.");
    error.status = 400;
    throw error;
  }
  const where = [`kind IN ${VISIBLE}`];
  const params = [];
  if (publication) {
    params.push(publication);
    where.push(`publication = $${params.length}`);
  }
  const safe = String(query || "").replace(/[%_\\]/g, "").trim();
  if (safe) {
    params.push(`%${safe}%`);
    where.push(`(title ILIKE $${params.length} OR dek ILIKE $${params.length} OR slug ILIKE $${params.length})`);
  }
  const filter = where.join(" AND ");
  const total = await pool.query(`SELECT count(*)::int AS n FROM articles WHERE ${filter}`, params);
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles WHERE ${filter}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, size, offset],
  );
  return { articles: rows.map(mapArticle), total: total.rows[0].n, page: current, limit: size };
}

export async function listFeed(limit = 30) {
  const { rows } = await pool.query(
    `SELECT ${CARD}, body_html FROM articles WHERE kind IN ${VISIBLE}
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map(mapArticle);
}

export async function findBriefing(editionDate, slot) {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles WHERE kind = 'briefing' AND edition_date = $1 AND slot = $2`,
    [editionDate, slot],
  );
  return mapArticle(rows[0]);
}

export async function sectionsFiledOn(editionDate, topicTags) {
  const { rows } = await pool.query(
    `SELECT tags FROM articles WHERE kind IN ${FILED} AND edition_date = $1`,
    [editionDate],
  );
  const found = new Set();
  for (const [slug, tags] of Object.entries(topicTags)) {
    const wanted = new Set(tags);
    const hit = rows.some((row) => (row.tags || []).some((tag) => wanted.has(String(tag).toLowerCase())));
    if (hit) found.add(slug);
  }
  return found;
}

export async function findEdition(editionDate, slot) {
  const { rows } = await pool.query(
    `SELECT ${CARD} FROM articles
     WHERE kind IN ${FILED} AND edition_date = $1 AND slot = $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [editionDate, slot],
  );
  return mapArticle(rows[0]);
}

export async function recentTitles(limit = 12) {
  const { rows } = await pool.query(
    `SELECT title FROM articles WHERE kind IN ${FILED} ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((row) => row.title);
}

export async function insertArticle(article) {
  const { rows } = await pool.query(
    `INSERT INTO articles
      (slug, title, dek, kicker, body_html, body_md, tags, queries, slot, edition_date, sources, art_svg, image_path, image_prompt, kind, ai_model, minutes, publication)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18)
     RETURNING slug`,
    [
      article.slug,
      article.title,
      article.dek,
      article.kicker,
      article.bodyHtml,
      article.bodyMd,
      article.tags,
      article.queries,
      article.slot,
      article.editionDate,
      JSON.stringify(article.sources || []),
      article.artSvg,
      article.imagePath,
      article.imagePrompt,
      article.kind || "briefing",
      article.aiModel,
      article.minutes,
      article.publication || "magazine",
    ],
  );
  return rows[0];
}

export async function updateArticle(slug, article) {
  const { rows } = await pool.query(
    `UPDATE articles SET
      slug = $1, title = $2, dek = $3, kicker = $4, body_html = $5, body_md = $6,
      tags = $7, queries = $8, slot = $9, edition_date = $10, sources = $11::jsonb,
      art_svg = $12, image_path = $13, minutes = $14, publication = $15, updated_at = now()
     WHERE slug = $16
     RETURNING slug`,
    [
      article.slug,
      article.title,
      article.dek,
      article.kicker,
      article.bodyHtml,
      article.bodyMd,
      article.tags,
      article.queries,
      article.slot,
      article.editionDate,
      JSON.stringify(article.sources || []),
      article.artSvg,
      article.imagePath,
      article.minutes,
      article.publication,
      slug,
    ],
  );
  return rows[0] || null;
}

export async function deleteBySlugs(slugs) {
  const { rows } = await pool.query(
    `DELETE FROM articles WHERE slug = ANY($1::text[]) RETURNING slug`,
    [slugs],
  );
  return rows.map((row) => row.slug);
}

export async function relatedBriefings(article, limit = 3) {
  const { rows } = await pool.query(
    `SELECT ${CARD},
        (SELECT count(*)::int FROM unnest(tags) AS tag WHERE tag = ANY($2::text[])) AS overlap
     FROM articles
     WHERE kind IN ${FILED} AND id <> $1
     ORDER BY overlap DESC, created_at DESC
     LIMIT $3`,
    [article.id, article.tags || [], limit],
  );
  return rows.map(mapArticle);
}

export async function hasArticle(id) {
  const { rows } = await pool.query(`SELECT 1 FROM articles WHERE id = $1`, [id]);
  return Boolean(rows[0]);
}

export async function logRun(slot, status, detail) {
  await pool.query(`INSERT INTO runs (slot, status, detail) VALUES ($1, $2, $3)`, [slot, status, detail?.slice(0, 800) || ""]);
}

export async function listRuns(limit = 12) {
  const { rows } = await pool.query(
    `SELECT id, slot, status, detail, created_at FROM runs ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function insertEvent(articleId, kind, refId = null) {
  await pool.query(`INSERT INTO events (article_id, kind, ref_id) VALUES ($1, $2, $3)`, [articleId, kind, refId]);
}

export async function revenueSummary() {
  const { rows } = await pool.query(
    `SELECT kind, count(*)::int AS n FROM events WHERE created_at > now() - interval '30 days' GROUP BY kind`,
  );
  const counts = Object.fromEntries(rows.map((row) => [row.kind, row.n]));
  const offers = await pool.query(
    `SELECT o.id, o.title, o.epc_cents, count(e.id)::int AS clicks
     FROM offers o
     LEFT JOIN events e ON e.kind = 'offer_click' AND e.ref_id = o.id AND e.created_at > now() - interval '30 days'
     GROUP BY o.id
     ORDER BY o.id`,
  );
  const sponsors = await pool.query(
    `SELECT s.id, s.name, s.cpm_cents, count(e.id)::int AS views
     FROM sponsors s
     LEFT JOIN events e ON e.kind = 'sponsor_view' AND e.ref_id = s.id AND e.created_at > now() - interval '30 days'
     GROUP BY s.id
     ORDER BY s.id`,
  );
  return { counts, offers: offers.rows, sponsors: sponsors.rows };
}

export async function listOffers() {
  const { rows } = await pool.query(`SELECT * FROM offers ORDER BY id`);
  return rows.map((row) => ({ ...row, keywords: row.keywords || [] }));
}

export async function insertOffer(offer) {
  await pool.query(
    `INSERT INTO offers (title, blurb, keywords, query, href, epc_cents, active)
     VALUES ($1,$2,$3,$4,$5,$6, TRUE)`,
    [offer.title, offer.blurb, offer.keywords, offer.query, offer.href, offer.epcCents],
  );
}

export async function deleteOffer(id) {
  await pool.query(`DELETE FROM offers WHERE id = $1`, [id]);
}

export async function listSponsors() {
  const { rows } = await pool.query(`SELECT * FROM sponsors ORDER BY id`);
  return rows;
}

export async function insertSponsor(sponsor) {
  await pool.query(
    `INSERT INTO sponsors (name, line, href, cpm_cents, active) VALUES ($1,$2,$3,$4, TRUE)`,
    [sponsor.name, sponsor.line, sponsor.href, sponsor.cpmCents],
  );
}

export async function deleteSponsor(id) {
  await pool.query(`DELETE FROM sponsors WHERE id = $1`, [id]);
}

export async function getSettings() {
  const { rows } = await pool.query(`SELECT key, value FROM settings`);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}
