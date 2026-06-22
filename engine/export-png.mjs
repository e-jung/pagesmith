/*
 * Pagewright — export each page to a PNG (for previews, or feeding a video tool
 * like hyperframes for a page-turn render).
 * Usage: node engine/export-png.mjs <book/index.html> <out-dir>
 * Requires: npm i && npx playwright install chromium
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const [input, outDir = 'dist/png'] = process.argv.slice(2);
if (!input) { console.error('usage: export-png.mjs <index.html> <out-dir>'); process.exit(1); }

await mkdir(resolve(outDir), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(input)).href, { waitUntil: 'networkidle' });

const pages = await page.$$('.page');
let i = 0;
for (const el of pages) {
  const n = String(++i).padStart(2, '0');
  await el.screenshot({ path: join(resolve(outDir), `page-${n}.png`) });
}
await browser.close();
console.log(`✓ wrote ${pages.length} PNGs to ${outDir}`);
