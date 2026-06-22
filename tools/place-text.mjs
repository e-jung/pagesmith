/*
 * Pagesmith — deterministic text placement.
 * For each story page, MEASURE where the image is busy (faces, focal art) vs.
 * empty (sky, grass), then put the text box in the emptiest candidate zone.
 * Same image always yields the same placement — no dice, fully repeatable.
 *
 * Usage:
 *   node tools/place-text.mjs books/<slug>            # write chosen pos back
 *   node tools/place-text.mjs books/<slug> --dry      # just report, don't write
 *
 * It only moves `story` pages. To override one, just hand-edit its `pos`
 * (and add "lock": true to that page to make this tool leave it alone).
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: place-text.mjs books/<slug> [--dry]'); process.exit(1); }
const dry = process.argv.includes('--dry');

// candidate text zones as normalized boxes [x0,y0,x1,y1], matching the CSS pos-* classes
const W = 0.58, H = 0.40; // text box footprint (≈max-width 70% + padding, multi-line)
const at = (cx, cy) => [cx - W / 2, cy - H / 2, cx + W / 2, cy + H / 2].map((v, i) =>
  Math.max(0, Math.min(1, v)));
const ZONES = {
  top:    at(0.50, 0.23),
  bottom: at(0.50, 0.77),
  center: at(0.50, 0.50),
  sky:    at(0.34, 0.26),   // top-left
  left:   at(0.33, 0.50),
  right:  at(0.67, 0.50),
};

// busyness of a normalized rect = mean gradient magnitude (edges) over that rect
function busyness(gray, w, h, [x0, y0, x1, y1]) {
  const px0 = Math.floor(x0 * w), px1 = Math.ceil(x1 * w);
  const py0 = Math.floor(y0 * h), py1 = Math.ceil(y1 * h);
  let sum = 0, n = 0;
  for (let y = py0; y < py1; y++) {
    for (let x = px0; x < px1; x++) {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      const gx = Math.abs(gray[i + 1] - gray[i - 1]);
      const gy = Math.abs(gray[i + w] - gray[i - w]);
      sum += gx + gy; n++;
    }
  }
  return n ? sum / n : Infinity;
}

const htmlPath = join(bookDir, 'index.html');
let html = await readFile(htmlPath, 'utf8');
const m = html.match(/(<script type="application\/json" id="book-data">)([\s\S]*?)(<\/script>)/);
const book = JSON.parse(m[2]);

let changed = 0;
for (const p of book.pages) {
  if (p.kind !== 'story' || !p.image || p.lock) continue;
  let buf;
  try { buf = await readFile(join(bookDir, p.image)); } catch { continue; }
  const w = 320, h = 180;
  const { data } = await sharp(buf).greyscale().resize(w, h, { fit: 'fill' })
    .raw().toBuffer({ resolveWithObject: true });
  const scores = Object.fromEntries(
    Object.entries(ZONES).map(([pos, box]) => [pos, busyness(data, w, h, box)]));
  const best = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];
  const old = p.pos;
  if (best !== old) changed++;
  p.pos = best;
  const fmt = (s) => s.toFixed(0).padStart(4);
  console.log(`p${String(p.n).padStart(2)}: ${old.padEnd(6)}-> ${best.padEnd(6)}  ` +
    Object.entries(scores).map(([k, v]) => `${k}:${fmt(v)}`).join('  '));
}

if (!dry) {
  html = html.replace(m[0], `${m[1]}\n${JSON.stringify(book, null, 2)}\n  ${m[3]}`);
  await writeFile(htmlPath, html);
}
console.log(`${dry ? '[dry] ' : ''}${changed} pages re-placed`);
