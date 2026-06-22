/*
 * export-pdf.mjs / export-png.mjs — CLI tests.
 *
 * Error paths (missing input, no arg, invalid data) are tested by spawning the
 * real scripts as subprocesses, since they call process.exit. The happy path is
 * a Playwright smoke test that exports the demo book; it is skipped
 * automatically if Chromium isn't installed in this environment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const PDF = join(ROOT, 'engine/export-pdf.mjs');
const PNG = join(ROOT, 'engine/export-png.mjs');

function run(script, args, opts = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    ...opts,
  });
}

// Chromium may not be installed in every environment; probe once.
let chromiumOk;
async function hasChromium() {
  if (chromiumOk !== undefined) return chromiumOk;
  let browser;
  try {
    browser = await chromium.launch();
    chromiumOk = true;
  } catch {
    chromiumOk = false;
  } finally {
    if (browser) await browser.close();
  }
  return chromiumOk;
}

async function makeBrokenBook() {
  const dir = await mkdtemp(join(tmpdir(), 'pw-broken-'));
  // page 2 has an invalid pos and a non-sequential n -> validation must fail
  await writeFile(
    join(dir, 'index.html'),
    `<!doctype html><html><body>
<script type="application/json" id="book-data">
{ "title": "Broken", "pages": [
  { "n": 1, "pos": "center", "text": "ok" },
  { "n": 9, "pos": "middle", "text": "bad" }
] }
</script>
</body></html>`,
  );
  return dir;
}

async function makeMalformedBook() {
  const dir = await mkdtemp(join(tmpdir(), 'pw-malformed-'));
  await writeFile(
    join(dir, 'index.html'),
    `<!doctype html><html><body>
<script type="application/json" id="book-data">
{ "title": "Oops", "pages": [ { "n": 1, "pos": "center", "text": "ok" } ,,, }
</script>
</body></html>`,
  );
  return dir;
}

test('export-pdf: missing book exits 1 with a clear message', () => {
  const r = run(PDF, ['books/does-not-exist']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Book not found/);
  assert.match(r.stderr, /Available books/);
});

test('export-pdf: no argument (non-TTY) lists books and exits 1', () => {
  const r = run(PDF, []);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No book argument given/);
  assert.match(r.stderr, /demo/);
});

test('export-pdf: invalid book data fails validation before launching a browser', async () => {
  const broken = await makeBrokenBook();
  try {
    const r = run(PDF, [broken]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Cannot export/);
    assert.match(r.stderr, /page 2/);
  } finally {
    await rm(broken, { recursive: true, force: true });
  }
});

test('export-pdf: malformed book-data JSON fails cleanly (no Playwright crash)', async () => {
  const malformed = await makeMalformedBook();
  try {
    const r = run(PDF, [malformed]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /invalid/);
    // must NOT have reached Playwright / a raw launch stack
    assert.doesNotMatch(r.stderr, /browserType\.launch|chromium\.launch/);
  } finally {
    await rm(malformed, { recursive: true, force: true });
  }
});

test('export-pdf: smoke export of demo book (Playwright)', async (t) => {
  if (!(await hasChromium())) return t.skip('chromium not installed');
  const out = join(ROOT, 'dist', 'smoke-test.pdf');
  const r = run(PDF, ['books/demo', out]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(existsSync(out), 'pdf file created');
  assert.ok(statSync(out).size > 1000, 'pdf is non-trivial');
});

test('export-png: smoke export of demo book (Playwright)', async (t) => {
  if (!(await hasChromium())) return t.skip('chromium not installed');
  const outDir = join(ROOT, 'dist', 'smoke-test-png');
  const r = run(PNG, ['books/demo', outDir]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(existsSync(join(outDir, 'page-01.png')), 'page-01.png created');
  assert.ok(existsSync(join(outDir, 'page-03.png')), 'page-03.png created');
});
