/*
 * engine/lib/cli.mjs — book-argument resolution tests.
 * resolveBook() is pure (no process.exit / prompting), so we test it directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBook, listBooks } from '../engine/lib/cli.mjs';

test('resolves a bare slug to books/<slug>', () => {
  const r = resolveBook('demo');
  assert.equal(r.slug, 'demo');
  assert.ok(r.indexHtml.endsWith('books/demo/index.html'));
});

test('resolves a books/<slug> path', () => {
  const r = resolveBook('books/demo');
  assert.equal(r.slug, 'demo');
  assert.ok(r.indexHtml.endsWith('books/demo/index.html'));
});

test('resolves an explicit index.html path', () => {
  const r = resolveBook('books/demo/index.html');
  assert.equal(r.slug, 'demo');
  assert.ok(r.bookDir.endsWith('books/demo'));
  assert.ok(r.indexHtml.endsWith('books/demo/index.html'));
});

test('handles a path with a trailing slash', () => {
  const r = resolveBook('books/demo/');
  assert.equal(r.slug, 'demo');
});

test('returns null for no argument', () => {
  assert.equal(resolveBook(null), null);
  assert.equal(resolveBook(undefined), null);
  assert.equal(resolveBook(''), null);
});

test('listBooks includes the demo book', () => {
  const books = listBooks();
  assert.ok(books.includes('demo'));
});
