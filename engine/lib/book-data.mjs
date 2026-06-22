/*
 * Pagewright — extract the inlined book-data JSON from a book's index.html.
 *
 * The book's source of truth is the <script type="application/json" id="book-data">
 * block. This pulls the JSON back out for validation / export, throwing a clear
 * error (not a ParseError stack) when the block is missing or malformed.
 */
import { readFile } from 'node:fs/promises';

const BOOK_DATA_RE = /<script[^>]*\bid=["']book-data["'][^>]*>([\s\S]*?)<\/script>/i;

export async function extractBookData(htmlPath) {
  const html = await readFile(htmlPath, 'utf8');
  const m = html.match(BOOK_DATA_RE);
  if (!m) {
    throw new Error(
      `No <script id="book-data"> block found in ${htmlPath}. ` +
        `A book's content lives in that block (see books/demo/index.html).`,
    );
  }
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`book-data JSON in ${htmlPath} is invalid: ${e.message}`);
  }
  return data;
}
