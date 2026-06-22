/*
 * Pagewright — image prep tool (dev).
 * Turns raw generator output into normalized, full-bleed page-NN.png for a book:
 *   - de-batches grid sheets (multiple panels in one image) into single panels
 *   - trims baked-in captions (via per-grid crop rects)
 *   - normalizes every page to ONE canvas size, cover-cropped to full bleed so
 *     every page is edge-to-edge and consistent
 *
 * Usage: node tools/prep-images.mjs books/<slug>
 * Driven by books/<slug>/art-sources.json. Re-run any time after dropping new art.
 *
 * Manifest schema:
 *   sourceDirs: [ ...folders to search for raw art ]   (sourceDir string also ok)
 *   canvas:     { w, h }
 *   grids:      { <prefix>: { cols:[{x,w}...], rows:[{y,h}...] } }
 *   map: { "<page>": one of
 *           { file:  <prefix> }                      whole image
 *           { grid:  <prefix>, col, row }            one grid cell
 *           { src:   <prefix>, rect:[l,t,w,h] }      explicit crop (irregular cells)
 *        }
 * Files are matched by filename PREFIX so long UUID/Gemini names needn't be typed.
 *
 * NOTE: resizes, does not invent detail. Low-res panels stay soft — for print, run
 * a real AI upscaler on the originals first.
 */
import sharp from 'sharp';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: prep-images.mjs books/<slug>'); process.exit(1); }

const cfg = JSON.parse(await readFile(join(bookDir, 'art-sources.json'), 'utf8'));
const { w: W, h: H } = cfg.canvas;
const dirs = cfg.sourceDirs || [cfg.sourceDir];
const watermarks = cfg.watermarks || {}; // keyed "WxH": { box:[x,y,w,h] }
const outDir = join(bookDir, 'images');
await mkdir(outDir, { recursive: true });

// index every candidate file across all source dirs, resolve by prefix
const index = [];
for (const d of dirs) for (const f of await readdir(d)) index.push(join(d, f));
const find = (prefix) => {
  const hit = index.find((p) => p.split('/').pop().startsWith(prefix));
  if (!hit) throw new Error(`no source file starting with "${prefix}" in ${dirs.join(', ')}`);
  return hit;
};

// paint over a corner watermark by mirroring the adjacent patch over it
async function scrub(buf, box) {
  const [x, y, w, h] = box;
  const patch = await sharp(buf)
    .extract({ left: Math.max(0, x - w), top: y, width: w, height: h })
    .flop().toBuffer();
  return sharp(buf).composite([{ input: patch, left: x, top: y }]).png().toBuffer();
}

// load a source once (de-watermarked if its dimensions match a known sheet), cached
const srcCache = new Map();
async function getSource(prefix) {
  const file = find(prefix);
  if (srcCache.has(file)) return srcCache.get(file);
  let buf = await readFile(file);
  const m = await sharp(buf).metadata();
  const wm = watermarks[`${m.width}x${m.height}`];
  if (wm) buf = await scrub(buf, wm.box);
  srcCache.set(file, buf);
  return buf;
}

// every page fills the whole canvas, cover-cropped -> consistent full bleed
const cover = (buf) => sharp(buf).resize(W, H, { fit: 'cover' }).sharpen({ sigma: 0.6 }).png();

async function crop(buf, rect) {
  return sharp(buf).extract({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }).toBuffer();
}

let n = 0;
for (const [page, spec] of Object.entries(cfg.map)) {
  const out = join(outDir, `page-${String(page).padStart(2, '0')}.png`);
  let buf;
  if (spec.file) {
    buf = await getSource(spec.file);
  } else if (spec.grid) {
    const g = cfg.grids[spec.grid];
    const c = g.cols[spec.col], r = g.rows[spec.row];
    buf = await crop(await getSource(spec.grid), [c.x, r.y, c.w, r.h]);
  } else if (spec.src) {
    buf = await crop(await getSource(spec.src), spec.rect);
  } else {
    console.warn(`  page ${page}: no source, skipped`); continue;
  }
  await cover(buf).toFile(out);
  n++;
  console.log(`  page ${page} -> page-${String(page).padStart(2, '0')}.png`);
}
console.log(`✓ prepared ${n} images at ${W}x${H} (full bleed)`);
