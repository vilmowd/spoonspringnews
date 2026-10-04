import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(markdown) {
  const raw = marked.parse(String(markdown || ""), { async: false });
  return sanitizeHtml(raw, {
    allowedTags: ["p", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "strong", "em", "code", "pre", "br"],
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tag, attribs) => ({
        tagName: "a",
        attribs: {
          href: attribs.href || "",
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    },
  });
}

export function wordCount(markdown) {
  return String(markdown || "").trim().split(/\s+/).filter(Boolean).length;
}
