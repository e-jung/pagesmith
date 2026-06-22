/*
 * Pagesmith — contact sheet (dev).
 * Tiles a folder of rendered page PNGs into one grid image, for judging an
 * edition at a glance (coherence, style, text placement across the whole book).
 *
 * Usage: node tools/contact-sheet.mjs <pages-dir> <out.png> [cols]
 *   e.g. node tools/contact-sheet.mjs dist/crayon-png dist/sheets/crayon.png 4
 */
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

const [dir, out = 'dist/sheet.png', colsArg] = process.argv.slice(2);
if (!dir) { console.error('usage: contact-sheet.mjs <pages-dir> <out.png> [cols]'); process.exit(1); }

const cols = Number(colsArg) || 4;
const tw = 360, th = Math.round((tw * 9) / 16), gap = 12, bg = { r: 245, g: 240, b: 230 };

const files = (await readdir(dir)).filter((f) => /\.png$/i.test(f)).sort();
const rows = Math.ceil(files.length / cols);
const W = cols * tw + (cols + 1) * gap;
const H = rows * th + (rows + 1) * gap;

const tiles = await Promise.all(files.map(async (f, i) => {
  const buf = await sharp(join(dir, f)).resize(tw, th, { fit: 'cover' })
    .extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 200, g: 190, b: 175 } })
    .toBuffer();
  return { input: buf, left: gap + (i % cols) * (tw + gap), top: gap + Math.floor(i / cols) * (th + gap) };
}));

await mkdir(dirname(resolve(out)), { recursive: true });
await sharp({ create: { width: W, height: H, channels: 3, background: bg } })
  .composite(tiles).png().toFile(out);
console.log(`✓ ${files.length} pages -> ${out} (${W}x${H})`);
