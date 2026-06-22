/*
 * validate-book.mjs — schema validation tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBook, VALID_POS } from '../engine/validate-book.mjs';

const GOOD_BOOK = {
  title: 'Good Book',
  pages: [
    { n: 1, kind: 'cover', pos: 'center', title: 'Cover' },
    { n: 2, kind: 'story', pos: 'sky', text: 'Once upon a time.' },
  ],
};

test('a valid book passes with no errors', () => {
  const r = validateBook(GOOD_BOOK, '/nonexistent-dir');
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
});

test('missing top-level title is an error', () => {
  const r = validateBook({ pages: GOOD_BOOK.pages }, '/x');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('title')));
});

test('empty pages array is an error', () => {
  const r = validateBook({ title: 'T', pages: [] }, '/x');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('no pages')));
});

test('non-sequential page numbers are reported', () => {
  const r = validateBook(
    {
      title: 'T',
      pages: [
        { n: 1, pos: 'center', text: 'a' },
        { n: 5, pos: 'center', text: 'b' },
      ],
    },
    '/x',
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('page 2') && e.includes('"n"')));
});

test('invalid pos value is reported and lists valid options', () => {
  const r = validateBook(
    {
      title: 'T',
      pages: [{ n: 1, pos: 'middle', text: 'a' }],
    },
    '/x',
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('"pos"') && e.includes('middle')));
  assert.equal(VALID_POS.join('|'), 'center|top|bottom|sky|left|right|wavy');
});

test('a page with neither text nor title is empty', () => {
  const r = validateBook(
    { title: 'T', pages: [{ n: 1, pos: 'center' }] },
    '/x',
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('empty page')));
});

test('a cover page is valid with only a title (no text)', () => {
  const r = validateBook(
    { title: 'T', pages: [{ n: 1, kind: 'cover', pos: 'center', title: 'Hi' }] },
    '/x',
  );
  assert.equal(r.valid, true);
});

test('missing image is a warning, not an error (placeholder is intentional)', () => {
  const r = validateBook(
    { title: 'T', pages: [{ n: 1, pos: 'center', text: 'a', image: 'images/page-01.png' }] },
    '/nonexistent-dir',
  );
  assert.equal(r.valid, true, 'still valid — art is optional');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /images\/page-01.png/);
});

test('invalid kind is reported', () => {
  const r = validateBook(
    { title: 'T', pages: [{ n: 1, kind: 'prologue', pos: 'center', text: 'a' }] },
    '/x',
  );
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('"kind"') && e.includes('prologue')));
});

test('non-object book data is an error', () => {
  const r = validateBook(null, '/x');
  assert.equal(r.valid, false);
});

test('missing pos is a warning (defaults to center), not an error', () => {
  const r = validateBook(
    { title: 'T', pages: [{ n: 1, text: 'a' }] },
    '/x',
  );
  assert.equal(r.valid, true);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /no "pos"/);
});
