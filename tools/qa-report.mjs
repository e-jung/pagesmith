/*
 * Pagesmith — QA report. Turns "is it good?" into numbers, per page.
 * For each story page it measures, from the actual rendered art:
 *   - text_risk: busyness under the CURRENT text position (high = text clashes)
 *   - best:      busyness of the emptiest available zone
 * Flags:
 *   - CLASH  : text_risk high AND a clearly emptier zone exists -> run place-text
 *   - BUSY   : even the emptiest zone is high -> the image itself is the problem
 *              (this is the only honest reason to re-roll ONE page's art)
 *
 * Usage: node tools/qa-report.mjs books/<slug>
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: qa-report.mjs books/<slug>'); process.exit(1); }

const W = 0.58, H = 0.40;
const at = (cx, cy) => [cx - W / 2, cy - H / 2, cx + W / 2, cy + H / 2].map((v) => Math.max(0, Math.min(1, v)));
const ZONES = { top: at(.5, .23), bottom: at(.5, .77), center: at(.5, .5), sky: at(.34, .26), left: at(.33, .5), right: at(.67, .5) };
const CLASH = 22, BUSY = 20; // thresholds (mean gradient magnitude)

function busy(g, w, h, [x0, y0, x1, y1]) {
  let s = 0, n = 0;
  for (let y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++)
    for (let x = Math.floor(x0 * w); x < Math.ceil(x1 * w); x++) {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      s += Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]); n++;
    }
  return n ? s / n : Infinity;
}

const html = await readFile(join(bookDir, 'index.html'), 'utf8');
const book = JSON.parse(html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)[1]);

const rows = [];
for (const p of book.pages) {
  if (p.kind !== 'story' || !p.image) continue;
  const { data } = await sharp(await readFile(join(bookDir, p.image)))
    .greyscale().resize(320, 180, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const scores = Object.fromEntries(Object.entries(ZONES).map(([k, b]) => [k, busy(data, 320, 180, b)]));
  const risk = scores[p.pos] ?? Math.min(...Object.values(scores));
  const best = Math.min(...Object.values(scores));
  let flag = 'ok';
  if (best > BUSY) flag = 'BUSY';            // image busy everywhere -> re-roll this one
  else if (risk > CLASH) flag = 'CLASH';     // just mis-placed -> place-text fixes it
  rows.push({ n: p.n, pos: p.pos, risk, best, flag });
}

rows.sort((a, b) => b.risk - a.risk);
console.log('page  pos      risk  best  flag');
for (const r of rows)
  console.log(`p${String(r.n).padStart(2)}  ${r.pos.padEnd(7)} ${r.risk.toFixed(0).padStart(4)}  ${r.best.toFixed(0).padStart(4)}  ${r.flag === 'ok' ? '' : r.flag}`);
const busyN = rows.filter((r) => r.flag === 'BUSY').length;
const clashN = rows.filter((r) => r.flag === 'CLASH').length;
console.log(`\n${rows.length} story pages · ${clashN} CLASH (run place-text) · ${busyN} BUSY (re-roll just these: ${rows.filter(r => r.flag === 'BUSY').map(r => 'p' + r.n).join(' ') || 'none'})`);
