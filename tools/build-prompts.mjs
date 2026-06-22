/*
 * Pagesmith — build per-page art prompts from a deterministic continuity spec.
 * Reads books/<slug>/continuity.json and writes each story page's `art` (the
 * prompt) and `ref` (which reference image to condition on) into index.html.
 *
 * Continuity is the source of truth for STORY STATE: who/what is present on each
 * page, the setting, and that a chopped tree leaves the cast and its object joins
 * it. Fix a continuity bug by editing continuity.json + rerunning this — never by
 * re-rolling images.
 *
 * `ref` is set automatically: a page that still has a standing tree character
 * gets the "trees" reference; pages with only objects/people get no tree
 * reference (so vanished trees can't creep back in).
 *
 * Usage: node tools/build-prompts.mjs books/<slug>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: build-prompts.mjs books/<slug>'); process.exit(1); }

const c = JSON.parse(await readFile(join(bookDir, 'continuity.json'), 'utf8'));
const lookOf = (k) => c.characters[k]?.look || c.cast[k] || k;

const htmlPath = join(bookDir, 'index.html');
let html = await readFile(htmlPath, 'utf8');
const m = html.match(/(<script type="application\/json" id="book-data">)([\s\S]*?)(<\/script>)/);
const book = JSON.parse(m[2]);

let n = 0;
for (const p of book.pages) {
  const spec = c.pages[String(p.n)];
  if (!spec) continue; // matter/back/etc.
  const present = spec.present || [];
  const inScene = present.map(lookOf).join('; ');
  const standingTree = present.some((k) => k in c.characters);
  const art = `${spec.scene}, ${c.settings[spec.setting]}.` +
    (inScene ? ` In the picture: ${inScene}.` : '') + ` ${c.style}.`;
  p.art = art;
  if (standingTree) p.ref = 'trees'; else delete p.ref;
  n++;
}

html = html.replace(m[0], `${m[1]}\n${JSON.stringify(book, null, 2)}\n  ${m[3]}`);
await writeFile(htmlPath, html);
console.log(`✓ built ${n} prompts from continuity.json`);
// quick preview of the continuity-sensitive pages
for (const k of ['11', '12', '17', '20', '21', '25', '32']) {
  const p = book.pages.find((x) => String(x.n) === k);
  if (p) console.log(`\np${k} [ref:${p.ref || 'none'}]\n  ${p.art}`);
}
