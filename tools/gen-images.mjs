/*
 * Pagesmith — image generator (dev).
 * Generates one full-res image per page from each page's art direction, in a
 * locked style, via a free keyless FLUX endpoint (Pollinations). No batching,
 * no watermark — output goes straight to page-NN.png at the book's canvas size.
 *
 * Usage:
 *   node tools/gen-images.mjs books/<slug>                 # all pages -> images/
 *   node tools/gen-images.mjs books/<slug> --out dist/gen  # to a staging dir
 *   node tools/gen-images.mjs books/<slug> --only 1,14,22  # just these pages
 *
 * Config lives in books/<slug>/art-sources.json under "gen":
 *   { model, style, size:[w,h], seedBase }
 * Page prompts come from each page's "art" field in index.html (the art direction).
 *
 * NOTE: each image is generated independently — same prompt won't reproduce the
 * *same* character across pages. For lock-step consistency use local ComfyUI +
 * IP-Adapter (roadmap). The crayon style is forgiving of this.
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: gen-images.mjs books/<slug> [--out dir] [--only n,n]'); process.exit(1); }
const args = process.argv.slice(3);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = flag('--only')?.split(',').map(Number);

const cfg = JSON.parse(await readFile(join(bookDir, 'art-sources.json'), 'utf8'));
const gen = cfg.gen || {};
const sizeFlag = flag('--size')?.split('x').map(Number); // e.g. --size 2048x1152 for print res
const [W, H] = sizeFlag?.length === 2 ? sizeFlag : (gen.size || [1280, 720]);
const model = gen.model || 'flux';
const style = gen.style || '';
const seedBase = gen.seedBase ?? 1000;
const outDir = flag('--out') || join(bookDir, 'images');

const html = await readFile(join(bookDir, 'index.html'), 'utf8');
const book = JSON.parse(html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)[1]);
await mkdir(outDir, { recursive: true });

async function generate(prompt, seed, outPath, tries = 3) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${W}&height=${H}&model=${model}&seed=${seed}&nologo=true`;
  for (let a = 1; a <= tries; a++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) throw new Error('tiny response');
      await sharp(buf).resize(W, H, { fit: 'cover' }).png().toFile(outPath); // normalize to PNG + exact size
      return buf.length;
    } catch (e) {
      if (a === tries) throw e;
      await new Promise((r) => setTimeout(r, 3000 * a));
    } finally { clearTimeout(t); }
  }
}

const pages = book.pages.filter((p) => p.image && (!only || only.includes(p.n)));
let ok = 0;
for (const p of pages) {
  const subject = p.art || p.title || 'a gentle storybook scene';
  const prompt = `${subject}. ${style}`;
  const outPath = join(outDir, `page-${String(p.n).padStart(2, '0')}.png`);
  try {
    const sz = await generate(prompt, seedBase + p.n, outPath);
    ok++;
    console.log(`page ${p.n}: ok (${(sz / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log(`page ${p.n}: FAILED ${e.message}`);
  }
}
console.log(`✓ generated ${ok}/${pages.length} -> ${outDir}`);
