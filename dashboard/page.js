import { TITLES } from "../src/titles.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

const SLOTS = ["morning", "midday", "evening", "extra"];

function shell({ title, notice, main }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.45 "Segoe UI", sans-serif; color: #1c1c1c; background: #f6f6f6; }
    header, main { width: min(980px, calc(100% - 2rem)); margin: 0 auto; }
    header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 1.2rem 0; }
    h1 { margin: 0; font-size: 1.6rem; letter-spacing: -0.03em; }
    a { color: #9d1c1c; }
    .bar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
    button, .button { border: 0; background: #1c1c1c; color: #fff; padding: 0.55rem 0.8rem; font: 700 0.82rem/1 "Segoe UI", sans-serif; letter-spacing: 0.04em; text-transform: uppercase; text-decoration: none; cursor: pointer; }
    button.ghost { background: #fff; color: #1c1c1c; border: 1px solid #1c1c1c; }
    button.danger { background: #e44545; }
    .notice { background: #1c1c1c; color: #fff; padding: 0.7rem 0.85rem; margin: 0 0 1rem; }
    .panel { background: #fff; border: 1px solid #e4e4e4; padding: 1rem; margin: 0 0 1rem; }
    .fine { color: #666; font-size: 0.92rem; }
    form.search { display: flex; gap: 0.5rem; }
    form.search input { flex: 1; min-width: 0; border: 1px solid #ccc; padding: 0.45rem 0.55rem; font: inherit; }
    ul.stories { list-style: none; margin: 0; padding: 0; }
    ul.stories li { display: flex; gap: 0.8rem; align-items: center; padding: 0.75rem 0; border-top: 1px solid #ececec; }
    ul.stories label { display: flex; gap: 0.65rem; align-items: flex-start; flex: 1; min-width: 0; }
    ul.stories strong { display: block; }
    ul.stories img { width: 72px; height: 48px; object-fit: cover; background: #111; flex: none; }
    .tools { display: flex; gap: 0.4rem; flex: none; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem 1rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    input, select, textarea { border: 1px solid #ccc; padding: 0.5rem; font: 16px/1.4 "Segoe UI", sans-serif; text-transform: none; letter-spacing: 0; font-weight: 400; }
    textarea { min-height: 22rem; width: 100%; }
    .span { grid-column: 1 / -1; }
    @media (max-width: 700px) {
      .grid, ul.stories li { grid-template-columns: 1fr; }
      ul.stories li { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Spoonspring dashboard</h1>
      <p class="fine">This machine only. Stories are saved on the magazine.</p>
    </div>
    <a href="/">Stories</a>
  </header>
  <main>
    ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
    ${main}
  </main>
</body>
</html>`;
}

export function listPage({ articles, page, pages, total, query, notice, hint, ready }) {
  const rows = articles.map((article) => `<li>
      <label><input form="bulk" type="checkbox" name="slugs" value="${esc(article.slug)}">
        ${article.image ? `<img src="${esc(article.image)}" alt="">` : ""}
        <span><strong>${esc(article.title)}</strong><span class="fine">${esc(article.publication)} · ${esc(article.date)} · ${esc(article.slot)}</span></span>
      </label>
      <span class="tools">
        <a class="button" href="/edit/${esc(article.slug)}">Edit</a>
        <form method="post" action="/delete" onsubmit="return confirm('Delete this story?')">
          <input type="hidden" name="slugs" value="${esc(article.slug)}">
          <button class="danger" type="submit">Delete</button>
        </form>
      </span>
    </li>`).join("");
  const pager = pages > 1
    ? `<p class="fine">${page > 1 ? `<a href="/?page=${page - 1}&q=${encodeURIComponent(query)}">Previous</a>` : ""} ${page < pages ? `<a href="/?page=${page + 1}&q=${encodeURIComponent(query)}">Next</a>` : ""}</p>`
    : "";
  return shell({
    title: "Stories — Spoonspring dashboard",
    notice,
    main: `<section class="panel">
        <p>${esc(hint)}</p>
        <form method="post" action="/write"><button type="submit" ${ready ? "" : "class=\"ghost\""}>Write and publish a story</button></form>
      </section>
      <section class="panel">
        <div class="bar">
          <form class="search" action="/" method="get">
            <input name="q" value="${esc(query)}" placeholder="Search titles" maxlength="80">
            <button type="submit">Search</button>
          </form>
          <form id="bulk" method="post" action="/delete" onsubmit="return confirm('Delete the selected stories?')">
            <button class="danger" type="submit">Delete selected</button>
          </form>
        </div>
        <p class="fine">${total} published.</p>
        ${rows ? `<ul class="stories">${rows}</ul>` : `<p>No stories match.</p>`}
        ${pager}
      </section>`,
  });
}

export function editPage({ article, notice }) {
  const publications = TITLES.map((title) => `<option value="${esc(title.slug)}"${article.publication === title.slug ? " selected" : ""}>${esc(title.name)}</option>`).join("");
  const slots = SLOTS.map((slot) => `<option value="${slot}"${article.slot === slot ? " selected" : ""}>${slot}</option>`).join("");
  return shell({
    title: `Edit — ${article.title}`,
    notice,
    main: `<section class="panel">
        <form class="grid" method="post" action="/edit/${esc(article.slug)}">
          <label class="span">Title <input name="title" required maxlength="140" value="${esc(article.title)}"></label>
          <label class="span">Deck <input name="dek" maxlength="240" value="${esc(article.dek || "")}"></label>
          <label>Kicker <input name="kicker" maxlength="24" value="${esc(article.kicker || "")}"></label>
          <label>Tags <input name="tags" maxlength="200" value="${esc((article.tags || []).join(", "))}"></label>
          <label>Publication <select name="publication">${publications}</select></label>
          <label>Slot <select name="slot">${slots}</select></label>
          <label>Date <input name="date" type="date" required value="${esc(article.date || "")}"></label>
          <label>New cover link <input name="image_url" placeholder="https://" maxlength="500"></label>
          <label class="span">Article <textarea name="body" required maxlength="100000">${esc(article.body || "")}</textarea></label>
          <label><span>Remove cover</span><input name="remove_image" type="checkbox" value="1"></label>
          <div class="bar span">
            <button type="submit">Save</button>
            <a href="${esc(article.url || "/")}">View on the magazine</a>
            <a href="/">Back</a>
          </div>
        </form>
      </section>`,
  });
}

export function downPage(message) {
  return shell({
    title: "Dashboard — Spoonspring",
    notice: message,
    main: `<section class="panel"><p>Start the magazine with <code>npm start</code>, then refresh this page.</p></section>`,
  });
}
