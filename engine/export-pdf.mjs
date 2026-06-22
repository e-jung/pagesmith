/*
 * Pagewright — export a book (HTML) to a print-ready PDF.
 *
 *   node engine/export-pdf.mjs                       # list / prompt for a book
 *   node engine/export-pdf.mjs books/demo            # by slug or dir
 *   node engine/export-pdf.mjs books/demo/index.html dist/demo.pdf
 *   npm run pdf -- books/demo
 *
 * Requires: npm i && npx playwright install chromium
 *
 * The PDF is a render TARGET, not the source of truth — generate it at the end,
 * never edit it. preferCSSPageSize honours the @page size in base.css.
 */
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

import { requireBookArg } from './lib/cli.mjs';
import { extractBookData } from './lib/book-data.mjs';
import { validateBook, formatReport } from './validate-book.mjs';
import { launchBrowser } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const book = await requireBookArg(argv.slice(0, 1));
const output = argv[1] ? resolve(argv[1]) : resolve('dist', `${book.slug}.pdf`);

// Validate before launching the browser — fail fast with a clear message
// rather than a half-rendered PDF or a Playwright crash.
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

await mkdir(dirname(output), { recursive: true });

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(book.indexHtml).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: output, printBackground: true, preferCSSPageSize: true });
  console.log(`✓ wrote ${output}`);
} finally {
  await browser.close();
}
