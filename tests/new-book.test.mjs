/*
 * tools/new-book.mjs — book scaffolding CLI tests.
 * Runs the scaffolder as a subprocess (it has no process.exit-free pure core) and
 * checks the produced book is valid + renders.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateBook } from '../engine/validate-book.mjs';
import { extractBookData } from '../engine/lib/book-data.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const NEW_BOOK = join(ROOT, 'tools/new-book.mjs');
const SLUG = 'scaffold-test-book';
const DEST = join(ROOT, 'books', SLUG);

function runNewBook(args) {
  return spawnSync(process.execPath, [NEW_BOOK, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
}

test('new-book rejects a missing slug', () => {
  const r = runNewBook([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage/);
});

test('new-book rejects an invalid slug', () => {
  const r = runNewBook(['Bad Slug!']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid slug/);
});

test('new-book scaffolds a valid, renderable book', async () => {
  const r = runNewBook([SLUG]);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  try {
    assert.ok(existsSync(join(DEST, 'index.html')), 'index.html created');
    assert.ok(existsSync(join(DEST, 'book.css')), 'book.css copied');
    assert.ok(existsSync(join(DEST, 'images')), 'images dir copied');
    assert.ok(existsSync(join(DEST, 'images', 'README.md')), 'images README kept');

    const data = await extractBookData(join(DEST, 'index.html'));
    // title should reflect the humanized slug
    assert.match(data.title, /Scaffold Test Book/i);

    const report = validateBook(data, DEST);
    assert.equal(report.valid, true, formatErrors(report));

    // <title> tag updated too
    const html = await readFile(join(DEST, 'index.html'), 'utf8');
    assert.match(html, /<title>[^<]*Scaffold Test Book[^<]*<\/title>/);
  } finally {
    await rm(DEST, { recursive: true, force: true });
  }
});

test('new-book refuses to overwrite an existing book', async () => {
  // first create it
  const first = runNewBook([SLUG]);
  assert.equal(first.status, 0);
  try {
    const second = runNewBook([SLUG]);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /already exists/);
  } finally {
    await rm(DEST, { recursive: true, force: true });
  }
});

function formatErrors(report) {
  return report.errors.length ? report.errors.join('\n') : '';
}
