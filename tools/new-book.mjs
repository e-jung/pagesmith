/*
 * Pagewright — scaffold a new book from the demo template.
 *
 *   node tools/new-book.mjs <slug>
 *   npm run new-book -- <slug>
 *
 * Copies books/demo/ -> books/<slug>/, rewrites the book's title/author to the
 * new slug, and empties images/ (keeps its README). The new book is valid and
 * immediately renderable, with the demo pages as a starting point to edit.
 */
import { cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBookData } from '../engine/lib/book-data.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(REPO_ROOT, 'books', 'demo');

function humanize(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npm run new-book -- <slug>');
  console.error('  slug: lowercase letters, numbers, and dashes (e.g. three-little-trees)');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(`✗ Invalid slug "${slug}". Use lowercase letters, numbers, and dashes only.`);
  process.exit(1);
}

const dest = join(REPO_ROOT, 'books', slug);
if (existsSync(dest)) {
  console.error(`✗ A book already exists at ${dest}`);
  process.exit(1);
}
if (!existsSync(TEMPLATE)) {
  console.error(`✗ Template not found at ${TEMPLATE}`);
  process.exit(1);
}

await cp(TEMPLATE, dest, { recursive: true });

// Empty images/ (keep README.md so the folder + its docs survive).
const imgDir = join(dest, 'images');
if (existsSync(imgDir)) {
  for (const f of await readdir(imgDir)) {
    if (f === 'README.md') continue;
    await rm(join(imgDir, f), { recursive: true, force: true });
  }
}

// Rewrite the book-data: point the title/author at the new slug. The demo's
// page contents are left in place as a starting point the author edits next.
const indexHtml = join(dest, 'index.html');
let html = await readFile(indexHtml, 'utf8');
const data = await extractBookData(indexHtml);
const title = humanize(slug);
data.title = title;
data.author = title;
const cover = Array.isArray(data.pages) ? data.pages[0] : null;
if (cover && typeof cover.title === 'string') cover.title = title;
if (cover && typeof cover.subtitle === 'string') cover.subtitle = 'a Pagesmith book';

const newBlock = `<script type="application/json" id="book-data">\n${JSON.stringify(data, null, 2)}\n  </script>`;
html = html
  .replace(/<script[^>]*\bid=["']book-data["'][^>]*>[\s\S]*?<\/script>/i, newBlock)
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
await writeFile(indexHtml, html);

console.log(`✓ created books/${slug}`);
console.log(`  Next: edit books/${slug}/index.html, then \`npm run pdf -- books/${slug}\`.`);
