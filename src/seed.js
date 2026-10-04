import { pool } from "./db.js";

const PLACED = [
  ["brazil-votes-and-the-count-may-not-finish-it", "wire"],
  ["sanaa-is-being-bombed-and-riyadh-denies-the-return-fire", "wire"],
  ["oil-is-moving-through-hormuz-again", "ledger"],
  ["the-melanoma-vaccine-won-the-trial-companies-have-not-shown-the-size", "laboratory"],
];

const OFFERS = [
  ["A book on the same question", "Explainers for when the briefing is not enough.", ["technology", "software", "ai", "gadgets", "computing", "internet"], "best technology explainers", 20],
  ["A science shelf", "Books that stay with a hard topic after the news moves on.", ["science", "space", "physics", "climate", "environment", "nature"], "popular science books", 20],
  ["A plainer economics book", "Background reading for markets, work, and money.", ["business", "markets", "economy", "finance", "work", "jobs"], "economics books for beginners", 20],
  ["A health explainer", "Careful books for medical and food questions.", ["health", "medicine", "food", "disease"], "health explainers", 15],
  ["Essays on the culture desk", "Collections that sit next to film, music, and art.", ["culture", "film", "music", "books", "art"], "best essay collections", 15],
  ["A current-affairs shelf", "Longer context for politics and the world.", ["politics", "world", "policy", "war", "election"], "current affairs books", 15],
];

export async function seed() {
  await pool.query(
    `DELETE FROM articles WHERE kind = 'guide' OR slug IN ('how-folio-works', 'how-spoonspring-works')`,
  );

  const placed = await pool.query(`SELECT value FROM settings WHERE key = 'titles_placed'`);
  if (!placed.rows.length) {
    for (const [slug, publication] of PLACED) {
      await pool.query(`UPDATE articles SET publication = $2 WHERE slug = $1`, [slug, publication]);
    }
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('titles_placed', '1') ON CONFLICT (key) DO NOTHING`,
    );
  }

  for (const [title, blurb, keywords, query, epc] of OFFERS) {
    await pool.query(
      `INSERT INTO offers (title, blurb, keywords, query, href, epc_cents, active)
       VALUES ($1,$2,$3,$4,NULL,$5, TRUE)
       ON CONFLICT (title) DO NOTHING`,
      [title, blurb, keywords, query, epc],
    );
  }
}
