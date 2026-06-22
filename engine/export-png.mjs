/*
 * Pagewright — export each page to a PNG (for previews, or feeding a video tool
 * like hyperframes for a page-turn render).
 *
 *   node engine/export-png.mjs                       # list / prompt for a book
 *   node engine/export-png.mjs books/demo            # by slug or dir
 *   node engine/export-png.mjs books/demo/index.html dist/demo-png
 *   npm run png -- books/demo
 *
 * Requires: npm i && npx playwright install chromium
 */
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

import { requireBookArg } from './lib/cli.mjs';
import { extractBookData } from './lib/book-data.mjs';
import { validateBook, formatReport } from './validate-book.mjs';
import { launchBrowser } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const book = await requireBookArg(argv.slice(0, 1));
const outDir = argv[1] ? resolve(argv[1]) : resolve('dist', `${book.slug}-png`);

// Validate before launching the browser — fail fast with a clear message.
let data;
try {
  data = await extractBookData(book.indexHtml);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
const report = validateBook(data, book.bookDir);
if (!report.valid) {
  console.error(formatReport(report, book.slug));
  console.error(`\n✗ Cannot export "${book.slug}" — fix the issues above first.`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(book.indexHtml).href, { waitUntil: 'networkidle' });

  const pages = await page.$$('.page');
  if (pages.length === 0) {
    throw new Error(`No .page elements rendered for "${book.slug}" — is render.js wired up?`);
  }
  let i = 0;
  for (const el of pages) {
    const n = String(++i).padStart(2, '0');
    await el.screenshot({ path: join(outDir, `page-${n}.png`) });
  }
  console.log(`✓ wrote ${pages.length} PNGs to ${outDir}`);
} finally {
  await browser.close();
}
