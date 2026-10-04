function watchMedia(img) {
  const frame = img.closest(".cover, .story-figure");
  if (!frame) return;
  const done = () => {
    frame.classList.remove("is-waiting");
    frame.classList.add("is-ready");
  };
  if (img.complete && img.naturalWidth > 0) {
    frame.classList.add("is-ready");
    return;
  }
  frame.classList.add("is-waiting");
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", done, { once: true });
}

document.querySelectorAll(".cover img, .story-figure img").forEach(watchMedia);

const loadbar = document.getElementById("loadbar");

function startLoad() {
  if (!loadbar || loadbar.classList.contains("is-on")) return;
  loadbar.hidden = false;
  loadbar.classList.add("is-on");
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a[href]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#")) return;
  let url;
  try { url = new URL(link.href, location.href); } catch { return; }
  if (url.origin !== location.origin) return;
  startLoad();
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
  if ((form.method || "get").toLowerCase() !== "get") return;
  form.setAttribute("aria-busy", "true");
  startLoad();
});

const menuToggle = document.querySelector(".menu-toggle");
const siteMenu = document.getElementById("site-menu");

function setMenu(open) {
  if (!menuToggle) return;
  document.body.classList.toggle("nav-open", open);
  menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  const label = menuToggle.querySelector(".sr");
  if (label) label.textContent = open ? "Close menu" : "Menu";
  const mast = document.querySelector(".mast");
  if (mast) document.documentElement.style.setProperty("--mast-h", `${mast.offsetHeight}px`);
}

if (menuToggle && siteMenu) {
  menuToggle.addEventListener("click", () => setMenu(!document.body.classList.contains("nav-open")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setMenu(false);
  });
}

const page = document.querySelector("[data-article-id]");

function send(payload) {
  const body = JSON.stringify(payload);
  if (payload.kind.endsWith("click") && navigator.sendBeacon) {
    navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

if (page) {
  const articleId = Number(page.dataset.articleId);
  const key = `folio-view-${articleId}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    send({ articleId, kind: "view" });
    if (page.dataset.sponsorId) send({ articleId, kind: "sponsor_view", refId: Number(page.dataset.sponsorId) });
    if (page.dataset.ad === "1") send({ articleId, kind: "ad_view" });
  }
  page.querySelectorAll("[data-track]").forEach((link) => {
    link.addEventListener("click", () => {
      send({
        articleId,
        kind: link.dataset.track,
        refId: link.dataset.ref ? Number(link.dataset.ref) : null,
      });
    });
  });
}

document.querySelectorAll("[data-copy-link]").forEach((button) => {
  button.addEventListener("click", async () => {
    const input = document.getElementById("share-url");
    const value = input ? input.value : "";
    let label = "Copy link";
    try {
      await navigator.clipboard.writeText(value);
      button.classList.add("is-copied");
      label = "Copied";
    } catch {
      if (input) {
        input.focus();
        input.select();
      }
      label = "Select the link";
    }
    button.setAttribute("aria-label", label);
    window.setTimeout(() => {
      button.classList.remove("is-copied");
      button.setAttribute("aria-label", "Copy link");
    }, 2000);
  });
});

const story = document.querySelector("[data-share-title]");
if (story && navigator.share) {
  const share = story.querySelector(".share");
  if (share) {
    const native = document.createElement("button");
    native.type = "button";
    native.setAttribute("aria-label", "Share");
    native.innerHTML = `<svg class="share-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="6" cy="12" r="2.1" fill="currentColor"/><circle cx="17" cy="6.5" r="2.1" fill="currentColor"/><circle cx="17" cy="17.5" r="2.1" fill="currentColor"/><path d="M8 11.2 15 7.4M8 12.8l7 3.8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
    native.addEventListener("click", () => {
      const urlInput = document.getElementById("share-url");
      navigator.share({
        title: story.dataset.shareTitle || document.title,
        url: urlInput ? urlInput.value : location.href,
      }).catch(() => {});
    });
    share.append(native);
  }
}

const A11Y_KEY = "spoonspring-a11y";
const A11Y_TEXT = ["100", "110", "125", "150", "175", "200"];
const A11Y_TOGGLES = ["links", "highlight", "spacing", "font", "guide", "motion", "focus", "cursor", "targets", "gray"];

function a11yDefaults() {
  return {
    text: "100",
    contrast: "default",
    links: false,
    highlight: false,
    spacing: false,
    font: false,
    guide: false,
    motion: false,
    focus: false,
    cursor: false,
    targets: false,
    gray: false,
  };
}

function a11yRead() {
  try {
    return { ...a11yDefaults(), ...JSON.parse(localStorage.getItem(A11Y_KEY) || "null") };
  } catch {
    return a11yDefaults();
  }
}

function a11yApply(settings) {
  const root = document.documentElement;
  if (settings.text && settings.text !== "100") root.dataset.a11yText = settings.text;
  else delete root.dataset.a11yText;
  if (settings.contrast && settings.contrast !== "default") root.dataset.a11yContrast = settings.contrast;
  else delete root.dataset.a11yContrast;
  for (const key of A11Y_TOGGLES) {
    const dataKey = `a11y${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    if (settings[key]) root.dataset[dataKey] = "1";
    else delete root.dataset[dataKey];
  }
  const value = document.getElementById("a11y-text-value");
  if (value) value.textContent = `${settings.text || "100"}%`;
  document.querySelectorAll('input[name="a11y-contrast"]').forEach((input) => {
    input.checked = input.value === (settings.contrast || "default");
  });
  document.querySelectorAll("[data-a11y-toggle]").forEach((input) => {
    input.checked = Boolean(settings[input.dataset.a11yToggle]);
  });
}

function a11ySave(settings) {
  localStorage.setItem(A11Y_KEY, JSON.stringify(settings));
  a11yApply(settings);
}

const a11yPop = document.getElementById("a11y-pop");
if (a11yPop) {
  let settings = a11yRead();
  let opener = null;
  a11yApply(settings);

  const panel = a11yPop.querySelector(".a11y-panel");
  const focusable = () => [...panel.querySelectorAll("button, input, [href], [tabindex]")].filter((node) => !node.disabled);

  function openA11y(from) {
    opener = from || document.activeElement;
    a11yPop.hidden = false;
    document.querySelectorAll("[data-a11y-open]").forEach((button) => button.setAttribute("aria-expanded", "true"));
    const close = a11yPop.querySelector("[data-a11y-close]");
    if (close) close.focus();
  }

  function closeA11y() {
    a11yPop.hidden = true;
    document.querySelectorAll("[data-a11y-open]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    if (opener && typeof opener.focus === "function") opener.focus();
  }

  document.querySelectorAll("[data-a11y-open]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => openA11y(button));
  });
  a11yPop.querySelector("[data-a11y-close]").addEventListener("click", closeA11y);
  a11yPop.addEventListener("click", (event) => {
    if (event.target === a11yPop) closeA11y();
  });
  document.addEventListener("keydown", (event) => {
    if (a11yPop.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeA11y();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.querySelectorAll("[data-a11y-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Math.max(0, A11Y_TEXT.indexOf(String(settings.text || "100")));
      const next = button.dataset.a11yStep === "up" ? Math.min(A11Y_TEXT.length - 1, index + 1) : Math.max(0, index - 1);
      settings = { ...settings, text: A11Y_TEXT[next] };
      a11ySave(settings);
    });
  });
  document.querySelectorAll('input[name="a11y-contrast"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      settings = { ...settings, contrast: input.value };
      a11ySave(settings);
    });
  });
  document.querySelectorAll("[data-a11y-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      settings = { ...settings, [input.dataset.a11yToggle]: input.checked };
      a11ySave(settings);
    });
  });
  a11yPop.querySelector("[data-a11y-reset]").addEventListener("click", () => {
    settings = a11yDefaults();
    localStorage.removeItem(A11Y_KEY);
    a11yApply(settings);
  });

  const guide = document.getElementById("a11y-guide");
  document.addEventListener("pointermove", (event) => {
    if (!guide || document.documentElement.dataset.a11yGuide !== "1") return;
    guide.style.top = `${event.clientY}px`;
  });

  const params = new URLSearchParams(location.search);
  if (params.get("a11y") === "1") {
    openA11y(document.querySelector("[data-a11y-open]"));
    params.delete("a11y");
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    history.replaceState(null, "", next);
  }
}
