/*
 * Pagesmith — image generator (dev). Three backends:
 *
 *   pollinations  free, keyless FLUX. No reference conditioning (no consistency).
 *   gemini        Google nano-banana via API (needs GEMINI_API_KEY + billing).
 *   browser       Google nano-banana via @steipete/oracle using your
 *                 gemini.google.com session (free). Reference-conditioned.
 *                 --cookie-path picks a Chrome profile (rotate accounts past the
 *                 daily web limit).
 *
 * References are PER PAGE: art-sources.json "gen.references" maps a name -> image,
 * and each page's `ref` (set by build-prompts.mjs from continuity) selects one.
 * A global --reference / gen.reference is the fallback when a page has no `ref`.
 *
 * Usage:
 *   node tools/gen-images.mjs books/<slug> [--only n,n] [--backend browser]
 *        [--cookie-path <Chrome profile Cookies>] [--reference img] [--size WxH]
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const bookDir = process.argv[2];
if (!bookDir) { console.error('usage: gen-images.mjs books/<slug> [--only n,n] [--backend browser]'); process.exit(1); }
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
const cookiePath = flag('--cookie-path') || gen.cookiePath;
const globalRef = flag('--reference') || gen.reference;

// resolve a page's reference image path: named (gen.references[name]) or global fallback
function refForPage(p) {
  if (p.ref) return gen.references?.[p.ref] || p.ref;
  if (gen.references) return null; // per-page system in use: no ref unless declared
  return globalRef || null;
}

const html = await readFile(join(bookDir, 'index.html'), 'utf8');
const book = JSON.parse(html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)[1]);
await mkdir(outDir, { recursive: true });

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

async function genGemini(prompt, ref) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('set GEMINI_API_KEY (aistudio.google.com/apikey)');
  const model = gen.model?.startsWith('gemini') ? gen.model : 'gemini-2.5-flash-image';
  const parts = [{ text: prompt }];
  if (ref) parts.push({ inline_data: { mime_type: 'image/png', data: (await sharp(await readFile(ref)).png().toBuffer()).toString('base64') } });
  const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } };
  if (gen.aspectRatio) body.generationConfig.imageConfig = { aspectRatio: gen.aspectRatio };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const out = (json.candidates?.[0]?.content?.parts || []).find((p) => p.inline_data || p.inlineData);
  if (!out) throw new Error('no image in response');
  return Buffer.from((out.inline_data || out.inlineData).data, 'base64');
}

// nano-banana via Oracle browser mode (free, your Gemini session). ~30s/image.
async function genBrowser(prompt, ref) {
  const model = gen.model?.startsWith('gemini') ? gen.model : 'gemini-3.1-pro';
  const full = `${prompt}` + (ref ? ' Keep the same characters and exact art style as the attached reference image.' : '') +
    ' No text, no words, no labels, no captions in the image.';
  const tmp = `/tmp/pw-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const a = ['-y', '@steipete/oracle', '--engine', 'browser', '--model', model,
    '--prompt', full, '--generate-image', tmp, '--aspect', gen.aspectRatio || '16:9'];
  if (ref) a.push('--file', ref);
  if (cookiePath) a.push('--browser-cookie-path', cookiePath);
  await execFileP('npx', a, { timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
  return await readFile(tmp);
}

async function generate(prompt, seed, outPath, ref, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const buf = backend === 'gemini' ? await genGemini(prompt, ref)
        : backend === 'browser' ? await genBrowser(prompt, ref)
        : await genPollinations(prompt, seed);
      await sharp(buf).resize(W, H, { fit: 'cover' }).png().toFile(outPath);
      return buf.length;
    } catch (e) {
      if (a === tries) throw e;
      await new Promise((r) => setTimeout(r, 3000 * a));
    }
  }
}

// pages that own an image; skip matter (no image) and back (reuses art).
// full run skips "lock": true; --only can force any page.
const pages = book.pages.filter((p) =>
  p.image && p.kind !== 'back' && (only ? only.includes(p.n) : !p.lock));

console.log(`backend: ${backend}${cookiePath ? ` (cookies: ${cookiePath.split('/').slice(-2)[0]})` : ''}`);
let ok = 0;
for (const p of pages) {
  const prompt = `${p.art || p.title || 'a gentle storybook scene'}. ${style}`.trim();
  const ref = refForPage(p);
  const outPath = join(outDir, `page-${String(p.n).padStart(2, '0')}.png`);
  try {
    const sz = await generate(prompt, fixedSeed ?? (seedBase + p.n), outPath, ref);
    ok++;
    console.log(`page ${p.n}: ok${ref ? ' [ref]' : ''} (${(sz / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log(`page ${p.n}: FAILED ${e.message}`);
  }
}
console.log(`✓ generated ${ok}/${pages.length} -> ${outDir}`);
