/** Highlights ranges on the page with the CSS Custom Highlight API, so the DOM is never modified. */

export const HIGHLIGHT_NAME = 'siyaq-unit';

let styleInstalled = false;

export function supportsHighlight(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function ensureStyle(doc: Document): void {
  if (styleInstalled) return;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    `::highlight(${HIGHLIGHT_NAME}) { background-color: rgba(242, 179, 61, 0.45); color: inherit; text-decoration: underline; text-decoration-color: rgba(242, 179, 61, 0.9); text-underline-offset: 2px; }`,
  );
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  styleInstalled = true;
}

export function setHighlight(ranges: Range[]): void {
  if (!supportsHighlight()) return;
  if (ranges.length === 0) {
    clearHighlight();
    return;
  }
  ensureStyle(document);
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
}

export function clearHighlight(): void {
  if (!supportsHighlight()) return;
  CSS.highlights.delete(HIGHLIGHT_NAME);
}
