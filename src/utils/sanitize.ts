import sanitizeHtml from "sanitize-html";

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows safe HTML tags for rich text content while removing dangerous scripts
 */
export function sanitizeHtmlContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "div",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "code",
      "pre",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target"],
      img: ["src", "alt", "title", "width", "height"],
      div: ["class"],
      span: ["class"],
      table: ["class"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    // Remove script tags and event handlers
    disallowedTagsMode: "discard",
  });
}

/**
 * Sanitize plain text (removes all HTML)
 */
export function sanitizeText(text: string): string {
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });
}
