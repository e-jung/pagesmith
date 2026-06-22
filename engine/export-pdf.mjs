/*
 * Pagewright — export a book (HTML) to a print-ready PDF.
 * Usage: node engine/export-pdf.mjs <book/index.html> <out.pdf>
 * Requires: npm i && npx playwright install chromium
 *
 * The PDF is a render TARGET, not the source of truth — generate it at the end,
 * never edit it. preferCSSPageSize honours the @page size in base.css.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [input, output = 'dist/book.pdf'] = process.argv.slice(2);
if (!input) { console.error('usage: export-pdf.mjs <index.html> <out.pdf>'); process.exit(1); }

await mkdir(dirname(resolve(output)), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(input)).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: resolve(output), printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`✓ wrote ${output}`);
