/*
 * Test helper: render a book object through engine/render.js inside a jsdom
 * document, so we exercise the real browser code (unmodified) and can assert on
 * the resulting DOM. render.js is a classic-script IIFE; we eval its source in
 * the jsdom window where `document` and `Image` exist.
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let cachedSrc = null;
async function renderSrc() {
  if (!cachedSrc) cachedSrc = await readFile(join(process.cwd(), 'engine/render.js'), 'utf8');
  return cachedSrc;
}

export async function renderBook(book) {
  const html = `<!doctype html><html><body>
    <script type="application/json" id="book-data">${JSON.stringify(book)}</script>
  </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(await renderSrc());
  return dom.window.document;
}
