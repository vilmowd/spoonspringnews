# Spoonspring

Spoonspring is a small article site. It keeps its articles in Postgres. While the app is running and a writing key is set, it files one story a day in each section: Technology, Science, Business, Health, Culture, and World. Partner links, sponsors, and an ad unit can be attached on their own.

## Run it

```powershell
npm install
npm start
```

The first start downloads a local Postgres and stores it in `data/pg`. That can take a few minutes. After that, open http://localhost:3000. Later starts reuse that database. If Postgres is already running on port 5433, Spoonspring connects to it instead of launching a second copy.

Story edits go through the publish API. The public site does not include a desk.

You can also connect with any Postgres client:

```text
host 127.0.0.1
port 5433
database folio
user folio
password folio
```

To use your own Postgres instead, set `DATABASE_URL` in `.env`. A Docker example is in `docker-compose.yml`.

## Before a public deploy

The local database password and the starter desk token are for a machine only you can reach. Before the domain points here:

- Put a real Postgres URL in `DATABASE_URL`. Do not leave the built-in database, with user `folio` and password `folio`, on a public server.
- Change `DESK_TOKEN` to a long random value.
- Keep `PUBLISH_KEY` private. It is already generated in `.env`.
- Set `SITE_URL` to `https://` plus the domain, and `CONTACT_EMAIL` to a real address.
- Serve the app behind HTTPS. Set `TRUST_PROXY=1` only when that proxy sets `X-Forwarded-For` and `X-Forwarded-Proto`.
- Keep the `public/media` folder on a disk that survives restarts. Story photos live there, and they are not stored in git.

`npm start` listens on the port in `.env` and shuts the database down on SIGTERM. A process manager can restart it. The health check is `GET /health`.

## The titles

Spoonspring is the company. It publishes six titles. An agent with `PUBLISH_KEY` files every one of them.

| Slug | Title | What it is |
| --- | --- | --- |
| magazine | Spoonspring | The flagship magazine, at `/` |
| wire | Wire | The news of the day |
| ledger | Ledger | Money, work, and markets |
| laboratory | Laboratory | Science and health |
| signal | Signal | Technology |
| stage | Stage | Culture |

`GET /api/titles` lists them and how many stories each one has. Post a story with `"publication": "wire"`. Leave it off and the story runs in the magazine. The morning, midday, and evening slots belong to the magazine. The other titles do not use those slots.

Each title has its own page, such as http://localhost:3000/title/wire. The public pages do not describe how a story was written.

## The three editions

The clock uses `SCHED_TZ`. The default `Etc/GMT-3` means UTC+3 all year. If you want daylight saving, set a region such as `Europe/Bucharest`.

| Edition | Default time |
| --- | --- |
| Morning | 08:00 |
| Midday | 12:00 |
| Evening | 18:00 |

Leave `npm start` running. Each day has three slots. A slot is filled when a story is posted into it. `npm run editions` asks the running site which of today's slots are still open.

An agent fills a slot by posting a story (see below) with `"slot": "morning"`, `"midday"`, or `"evening"`. If `slot` is left off, the story takes the first open slot for that day. A fourth story the same day is still published, and it does not take over a slot that already has one. Send the JSON as UTF-8. Names such as Créteil and Édouard stay intact, and a client that accidentally sends them as mojibake is repaired on the way in.

If `TEXT_API_KEY` is set, the clock files one story in each section after `MORNING_HOUR` (08:00 by default), and it skips a section that already has a story that day. Without that key, the clock does not write. Morning, midday, and evening remain open for a story posted by hand.

If the app was off and a slot was missed, open the Desk and file that slot, or post it through the API. You can also run `npm run generate -- morning` (or `midday`, or `evening`) when a text key is set. If the site is already running, that command asks the running site to file the piece, so it does not start a second database.

## The model

Put a key in `.env` and restart:

```text
TEXT_API_KEY=sk-...
TEXT_API_BASE=https://api.openai.com/v1
TEXT_MODEL=gpt-4o-mini
```

Any OpenAI-compatible chat API works. A few bases:

- OpenAI: `https://api.openai.com/v1`
- xAI: `https://api.x.ai/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

The model picks one public headline, writes an original explainer, and chooses the cover: a palette, a motif, and a label. Spoonspring draws that cover. It does not copy the source articles.

## The engine

`npm run engine` writes one original story and publishes it on the magazine. It reads public headlines, asks the writing API for an explainer, searches Wikimedia Commons for a free photograph, and posts the story with `PUBLISH_KEY`. If no free photograph fits, the cover is drawn. The same button is on the dashboard.

The running magazine uses that same writer once a day. After `MORNING_HOUR` it files one story for Technology, Science, Business, Health, Culture, and World. A section that already has a story that day is left alone. Each of those stories is posted with `slot` set to `extra`, so it does not take the morning, midday, or evening slot.

A free key is enough. Google AI Studio (Gemini) and Groq both have a free tier. Put the key in `TEXT_API_KEY` and set `TEXT_API_BASE` and `TEXT_MODEL` to the matching lines in `.env.example`.

## The dashboard

`npm run dashboard` opens http://127.0.0.1:4000 on this machine only. It lists the stories on the magazine. You can edit one and save it, delete one, or delete several. The key stays on the server. The magazine has to be running.

## Publishing by API

Leave the app running. An agent can publish a story at any time:

```text
POST http://localhost:3000/api/articles
Authorization: Bearer <PUBLISH_KEY>
Content-Type: application/json
```

See which slots are open:

```text
GET http://localhost:3000/api/editions
Authorization: Bearer <PUBLISH_KEY>
```

The reply lists morning, midday, and evening for today, with `open: true` or `false` on each.

The body needs `title` and `body` (markdown). Optional fields: `publication`, `slot`, `dek`, `kicker`, `tags`, `sources`, `slug`, `date`, `palette`, `motif`, `label`, `image_url`, `image_base64`, or `figures`. `publication` is `magazine`, `wire`, `ledger`, `laboratory`, `signal`, or `stage`. `slot` is `morning`, `midday`, or `evening`. Each item in `figures` has an `image_url`, a `caption`, and a `credit`. Write `[[figure:0]]` in the article where the first extra picture should appear. The cover stays `image_url`. The key is `PUBLISH_KEY` in `.env`. The site creates one on first start if the value is empty. Send `Content-Type: application/json; charset=utf-8`. A missing or wrong key is rejected before the upload is read. Picture links have to be public http(s) addresses. The route is limited to 30 publishes per 10 minutes from one address, and 60 per hour overall.

The same key can list, read, edit, and delete stories. A dashboard on another machine can use these routes against the public site:

```text
GET    /api/articles?page=1&limit=20&publication=wire&q=brazil
GET    /api/articles/:slug
PATCH  /api/articles/:slug
PUT    /api/articles/:slug
DELETE /api/articles/:slug
POST   /api/articles/bulk-delete
```

`GET /api/articles` returns titles, dates, and links, not the full text. `GET /api/articles/:slug` adds `body` in markdown so it can be edited. `PATCH` and `PUT` send only the fields that change: `title`, `body`, `dek`, `kicker`, `tags`, `publication`, `slot`, `date`, `slug`, `image_url`, `image_base64`, `remove_image`, or `figures`. Bulk delete sends `{ "slugs": ["one-story", "another-story"] }` and deletes up to 100 at a time. A separate dashboard can call these routes. Reads are limited to 120 a minute. Edits and deletes are limited to 80 every 10 minutes from one address, and 400 an hour overall.

## Scale

One Node process and one Postgres database is the shape of this app. List pages no longer load the article text or the drawn cover, the pool is 10 connections (`PG_POOL`, up to 20), and stories are indexed by date, title, tags, and search text. That is enough for a large magazine catalog on one server.

It is not a multi-server cluster yet. To run more than one app process, point every process at the same `DATABASE_URL`, keep `public/media` on a disk they all share, and put a reverse proxy in front. Desk sign-in and the API rate limits live in the memory of each process, so they do not add up across machines. View counts are stored one row at a time; that is fine until the events table is in the millions.

## Security

Before the domain points at this app:

- Change `DESK_TOKEN`. The desk cookie is a random session, not the token itself, and it expires after 12 hours. Sign-in is limited to 8 tries per 15 minutes.
- Keep `PUBLISH_KEY` long and private. Treat it like a password.
- Serve the site over HTTPS. Strict transport security is sent when the request is HTTPS.
- Set `SITE_URL` to the public origin, such as `https://spoonspring.com`, so canonical links, share links, and the sitemap stay on that host.
- Set `TRUST_PROXY=1` only when a reverse proxy you control sets `X-Forwarded-For` and `X-Forwarded-Proto`.
- Set `CONTACT_EMAIL` so the privacy and terms pages have a real address.

The publish API does not allow browser calls from other sites. Desk forms are accepted only from this site. Pages send a content security policy, frame blocking, and a nosniff header.

## Discovery and sharing

Each story has a canonical link, Open Graph and Twitter card tags, NewsArticle structured data, a breadcrumb, and a large-image preview hint for Google. `robots.txt` points at `sitemap.xml` and keeps the desk, the API, and search results out of the index. The RSS feed is at `/feed.xml`.

A story page includes the link itself, Copy link, and links for X, Facebook, LinkedIn, WhatsApp, and email. On a phone, the page also offers the device share sheet. Uploaded photos are the images Google Discover can use. Drawn covers are included too, at 1200 by 675.

Privacy and terms are linked in the footer. Accessibility opens a panel for text size, contrast, link underlines, spacing, and related reading settings.

The daily clock files one story in each section when `TEXT_API_KEY` is set. API stories show up on the magazine alongside those.

Optional pictures, with a second key:

```text
IMAGE_API_KEY=sk-...
IMAGE_API_BASE=https://api.openai.com/v1
IMAGE_MODEL=dall-e-3
```

Headlines are read from Hacker News and BBC News. Only titles and links are kept.

## Revenue

Nothing here opens an account or pays you by itself. Once you connect a program, Spoonspring inserts it without a manual step per article.

- **Partner links.** The database ships with topic shelves (technology, science, business, health, culture, world). Add your Amazon Associates tag on the Desk and a matching shelf becomes a tagged Amazon search link. You can also add an offer with your own `https` link and the keywords that should trigger it.
- **Sponsors.** Add a name, a line, a link, and an estimated CPM. Each article keeps one sponsor, chosen from the active list.
- **Ads.** Add a Google AdSense client id (`ca-pub-...`) and a numeric slot id. One ad unit is placed after the briefing.
- **Tips.** A single support link at the end of the article, if you set one.

The Desk shows a 30-day count of views, partner clicks, sponsor views, and ad views. The dollar figure is an estimate from the cents-per-click and cents-per-thousand you entered. The network, the affiliate program, and the sponsor pay the real balance. Refreshing a page does not add another view in the same browser tab.

Affiliate links use `rel="sponsored"` and go straight to the merchant. They are not redirected through Spoonspring.

## What a briefing is

Each piece is an explainer. The headlines that were on the desk are listed under the article when the clock files it. API stories list sources only if the request includes them.
