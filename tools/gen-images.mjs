/*
 * Pagesmith — image generator (dev). Two backends:
 *
 *   pollinations  free, keyless FLUX. Fast, but each image is independent —
 *                 it CANNOT keep a character consistent across pages.
 *   gemini        Google "nano banana" (gemini-2.5-flash-image). Conditions each
 *                 image on a REFERENCE image you pass in, so the three trees /
 *                 Jesus / etc. stay on-model. Free tier: 500 images/day.
 *                 Needs env GEMINI_API_KEY (from aistudio.google.com/apikey).
 *
 * Usage:
 *   node tools/gen-images.mjs books/<slug>                          # all pages
 *   node tools/gen-images.mjs books/<slug> --only 1,14,22           # just these
 *   node tools/gen-images.mjs books/<slug> --backend gemini \
 *        --reference books/<slug>/reference.png                     # consistent
 *
 * Config (books/<slug>/art-sources.json "gen"): { backend, model, style, size,
 *   seedBase, fixedSeed, aspectRatio }. CLI flags override config.
 * Page prompts come from each page's "art" field in index.html.
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: gen-images.mjs books/<slug> [--backend gemini] [--reference img] [--only n,n]'); process.exit(1); }
const args = process.argv.slice(3);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = flag('--only')?.split(',').map(Number);

const cfg = JSON.parse(await readFile(join(bookDir, 'art-sources.json'), 'utf8'));
const gen = cfg.gen || {};
const sizeFlag = flag('--size')?.split('x').map(Number);
const [W, H] = sizeFlag?.length === 2 ? sizeFlag : (gen.size || [1280, 720]);
const style = gen.style || '';
const seedBase = Number(flag('--seed')) || (gen.seedBase ?? 1000);
const fixedSeed = gen.fixedSeed;
const outDir = flag('--out') || join(bookDir, 'images');
const backend = flag('--backend') || gen.backend || 'pollinations';

// reference image (gemini only) — the locked "character sheet" every page conditions on
const refPath = flag('--reference') || gen.reference;
let refB64 = null;
if (backend === 'gemini' && refPath) {
  refB64 = (await sharp(await readFile(refPath)).png().toBuffer()).toString('base64');
}

const html = await readFile(join(bookDir, 'index.html'), 'utf8');
const book = JSON.parse(html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)[1]);
await mkdir(outDir, { recursive: true });

// --- backend: Pollinations (free FLUX, no reference) ---
async function genPollinations(prompt, seed) {
  const model = gen.model || 'flux';
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${W}&height=${H}&model=${model}&seed=${seed}&nologo=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error('tiny response');
  return buf;
}

// --- backend: Gemini nano banana (reference-conditioned) ---
async function genGemini(prompt) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('set GEMINI_API_KEY (aistudio.google.com/apikey)');
  const model = gen.model?.startsWith('gemini') ? gen.model : 'gemini-2.5-flash-image';
  const parts = [{ text: prompt }];
  if (refB64) parts.push({ inline_data: { mime_type: 'image/png', data: refB64 } });
  const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } };
  if (gen.aspectRatio) body.generationConfig.imageConfig = { aspectRatio: gen.aspectRatio };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const out = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inline_data || p.inlineData);
  if (!out) throw new Error('no image in response');
  return Buffer.from((out.inline_data || out.inlineData).data, 'base64');
}

// retry + normalize to canvas
async function generate(prompt, seed, outPath, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const buf = backend === 'gemini' ? await genGemini(prompt) : await genPollinations(prompt, seed);
      await sharp(buf).resize(W, H, { fit: 'cover' }).png().toFile(outPath);
      return buf.length;
    } catch (e) {
      if (a === tries) throw e;
      await new Promise((r) => setTimeout(r, 3000 * a));
    }
  }
}

// pages that own an image; skip matter (no image) and back (reuses art).
// full run skips "lock": true pages; --only can force-regen any page.
const pages = book.pages.filter((p) =>
  p.image && p.kind !== 'back' && (only ? only.includes(p.n) : !p.lock));

console.log(`backend: ${backend}${backend === 'gemini' ? (refB64 ? ` (reference: ${refPath})` : ' (no reference!)') : ''}`);
let ok = 0;
for (const p of pages) {
  const subject = p.art || p.title || 'a gentle storybook scene';
  const prompt = `${subject}. ${style}`;
  const outPath = join(outDir, `page-${String(p.n).padStart(2, '0')}.png`);
  try {
    const sz = await generate(prompt, fixedSeed ?? (seedBase + p.n), outPath);
    ok++;
    console.log(`page ${p.n}: ok (${(sz / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log(`page ${p.n}: FAILED ${e.message}`);
  }
}
console.log(`✓ generated ${ok}/${pages.length} -> ${outDir}`);
