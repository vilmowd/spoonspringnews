import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { config } from "./config.js";

const { Pool, Client } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  dek TEXT NOT NULL,
  kicker TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_md TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  queries TEXT[] NOT NULL DEFAULT '{}',
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'midday', 'evening')),
  edition_date DATE NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  art_svg TEXT,
  image_path TEXT,
  image_prompt TEXT,
  kind TEXT NOT NULL DEFAULT 'briefing',
  ai_model TEXT,
  minutes INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS articles_one_briefing_per_slot
  ON articles (edition_date, slot) WHERE kind = 'briefing';
CREATE INDEX IF NOT EXISTS articles_recent ON articles (created_at DESC);

CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  title TEXT UNIQUE NOT NULL,
  blurb TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  query TEXT NOT NULL DEFAULT '',
  href TEXT,
  epc_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  line TEXT NOT NULL,
  href TEXT NOT NULL,
  cpm_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_kind ON events (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS runs (
  id SERIAL PRIMARY KEY,
  slot TEXT,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export let pool;
let embedded;
let ownsEmbedded = false;

async function canConnect(connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    return true;
  } catch {
    try { await client.end(); } catch { /* already closed */ }
    return false;
  }
}

export async function initDb() {
  const connectionString = config.databaseUrl || await startEmbedded();
  pool = new Pool({ connectionString, max: config.pgPool });
  await pool.query(SCHEMA);
  await pool.query(`ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_slot_check`);
  await pool.query(`ALTER TABLE articles ADD CONSTRAINT articles_slot_check CHECK (slot IN ('morning', 'midday', 'evening', 'extra'))`);
  await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS publication TEXT NOT NULL DEFAULT 'magazine'`);
  await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);
  await pool.query(`UPDATE articles SET updated_at = created_at WHERE updated_at IS NULL`);
  await pool.query(`ALTER TABLE articles ALTER COLUMN updated_at SET DEFAULT now()`);
  await pool.query(`ALTER TABLE articles ALTER COLUMN updated_at SET NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS articles_publication ON articles (publication, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS articles_edition ON articles (edition_date DESC, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS articles_tags ON articles USING gin (tags)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS events_recent ON events (created_at DESC)`);
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await pool.query(`CREATE INDEX IF NOT EXISTS articles_search ON articles USING gin ((title || ' ' || coalesce(dek, '')) gin_trgm_ops)`);
  } catch (error) {
    console.warn(`[spoonspring] search index skipped: ${error.message}`);
  }
  const version = await pool.query("SELECT version()");
  return { connectionString: safeUrl(connectionString), version: version.rows[0].version };
}

async function startEmbedded() {
  const connectionString = `postgresql://folio:folio@127.0.0.1:${config.pgPort}/folio`;
  if (await canConnect(connectionString)) return connectionString;
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  const databaseDir = path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(databaseDir, { recursive: true });
  const ready = fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  embedded = new EmbeddedPostgres({
    databaseDir,
    user: "folio",
    password: "folio",
    port: config.pgPort,
    persistent: true,
    onLog: () => {},
    onError: (message) => console.error(`[postgres] ${message}`),
  });
  if (!ready) await embedded.initialise();
  await embedded.start();
  try {
    await embedded.createDatabase("folio");
  } catch (error) {
    if (!/already exists/i.test(String(error?.message || error))) throw error;
  }
  ownsEmbedded = true;
  return connectionString;
}

function safeUrl(connectionString) {
  return connectionString.replace(/:([^:@/]+)@/, ":****@");
}

export async function shutdown() {
  if (pool) await pool.end();
  pool = null;
  if (embedded && ownsEmbedded) await embedded.stop();
  embedded = null;
  ownsEmbedded = false;
}
