/*
 * render.js — runtime renderer tests.
 * Exercises the real browser code via jsdom (see helpers/render.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBook } from './helpers/render.mjs';

const BOOK = {
  title: 'Test Book',
  author: 'Tester',
  pages: [
    { n: 1, kind: 'cover', pos: 'center', title: 'Cover Title', subtitle: 'sub' },
    { n: 2, kind: 'story', pos: 'sky', text: 'Hello world.' },
    { n: 3, kind: 'story', pos: 'bottom', text: 'Para one.\n\nPara two.' },
  ],
};

test('renders a masthead with the book title and author', async () => {
  const doc = await renderBook(BOOK);
  const masthead = doc.querySelector('.book__masthead');
  assert.ok(masthead, 'masthead exists');
  assert.match(masthead.textContent, /Test Book/);
  assert.match(masthead.textContent, /Tester/);
});

test('renders one .page section per book page', async () => {
  const doc = await renderBook(BOOK);
  const pages = doc.querySelectorAll('.page');
  assert.equal(pages.length, 3);
  assert.equal(pages[0].dataset.n, '1');
  assert.equal(pages[2].dataset.n, '3');
});

test('applies the kind class (cover / story default)', async () => {
  const doc = await renderBook(BOOK);
  assert.ok(doc.querySelector('.page--cover'));
  assert.ok(doc.querySelector('.page--story'));
});

test('applies the pos-* placement class from each page', async () => {
  const doc = await renderBook(BOOK);
  const sky = doc.querySelectorAll('.pos-sky');
  const bottom = doc.querySelectorAll('.pos-bottom');
  assert.equal(sky.length, 1, 'sky placement applied');
  assert.equal(bottom.length, 1, 'bottom placement applied');
});

test('defaults missing pos to center', async () => {
  const doc = await renderBook({
    title: 'T',
    pages: [{ n: 1, kind: 'story', text: 'hi' }],
  });
  assert.ok(doc.querySelector('.pos-center'));
});

test('splits \\n\\n into <p> paragraphs and \\n into <br>', async () => {
  const doc = await renderBook(BOOK);
  const paras = doc.querySelectorAll('.pos-bottom p');
  assert.equal(paras.length, 2, 'two paragraphs from one double-newline block');
  assert.ok(paras[0].textContent.includes('Para one.'));
  assert.ok(paras[1].textContent.includes('Para two.'));
});

test('renders a title page with .page__title', async () => {
  const doc = await renderBook(BOOK);
  const title = doc.querySelector('.page--cover .page__title');
  assert.ok(title);
  assert.match(title.textContent, /Cover Title/);
  assert.ok(doc.querySelector('.page__subtitle'), 'subtitle rendered');
});

test('passes inline <em> through to the text layer', async () => {
  const doc = await renderBook({
    title: 'T',
    pages: [{ n: 1, kind: 'story', pos: 'center', text: 'see <em>the bold red</em> word' }],
  });
  const em = doc.querySelector('.page__text em');
  assert.ok(em, 'em element present');
  assert.match(em.textContent, /the bold red/);
});

test('passes inline <span class="shout"> through to the text layer', async () => {
  const doc = await renderBook({
    title: 'T',
    pages: [{ n: 1, kind: 'story', pos: 'center', text: '<span class="shout">BOOM</span>' }],
  });
  const shout = doc.querySelector('.page__text .shout');
  assert.ok(shout, 'shout span present');
  assert.match(shout.textContent, /BOOM/);
});

test('shows a labelled placeholder when a story page has no image', async () => {
  const doc = await renderBook({
    title: 'T',
    pages: [{ n: 1, kind: 'story', pos: 'center', text: 'words', art: 'a tree' }],
  });
  const ph = doc.querySelector('.page__placeholder');
  assert.ok(ph, 'placeholder rendered');
  assert.match(ph.textContent, /a tree/);
});

test('omits the placeholder on cover/title pages', async () => {
  const doc = await renderBook(BOOK);
  const cover = doc.querySelector('.page--cover');
  assert.ok(cover, 'cover exists');
  assert.ok(!cover.querySelector('.page__placeholder'), 'no placeholder on cover');
});
