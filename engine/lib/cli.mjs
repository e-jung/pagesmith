/*
 * Pagewright — shared CLI helpers for the export / validate / prep tools.
 *
 * A "book argument" can be any of:
 *   demo                     a bare slug  -> books/demo
 *   books/demo               a book dir
 *   books/demo/index.html    an explicit HTML file
 *
 * resolveBook() is pure (no IO beyond existsSync) and unit-tested.
 * requireBookArg() wraps it with the interactive behaviour the CLIs share:
 * list + prompt when no argument is given, fail loudly on a missing book.
 */
import { existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BOOKS_DIR = join(REPO_ROOT, 'books');

export function booksDir() {
  return BOOKS_DIR;
}

export function listBooks() {
  if (!existsSync(BOOKS_DIR)) return [];
  return readdirSync(BOOKS_DIR)
    .filter((d) => {
      const p = join(BOOKS_DIR, d);
      return statSync(p).isDirectory() && existsSync(join(p, 'index.html'));
    })
    .sort();
}

export function resolveBook(arg) {
  if (!arg || typeof arg !== 'string') return null;
  if (/\.html?$/i.test(arg)) {
    const indexHtml = resolve(arg);
    return { slug: basename(dirname(indexHtml)), bookDir: dirname(indexHtml), indexHtml };
  }
  // Contains a path separator -> treat as a path (books/demo, ./books/demo, /abs).
  if (/[\\/]/.test(arg)) {
    const bookDir = resolve(arg);
    return { slug: basename(bookDir), bookDir, indexHtml: join(bookDir, 'index.html') };
  }
  // Bare slug -> books/<slug>
  const bookDir = join(BOOKS_DIR, arg);
  return { slug: basename(bookDir), bookDir, indexHtml: join(bookDir, 'index.html') };
}

function printAvailable() {
  const books = listBooks();
  if (books.length === 0) {
    console.error('No books found under books/. Create one with: npm run new-book -- <slug>');
    return;
  }
  console.error('Available books:');
  for (const b of books) console.error(`  - ${b}`);
  console.error('Usage: npm run <pdf|png|validate|prep> -- <book-slug>');
}

export async function requireBookArg(argv) {
  const arg = argv[0];
  if (arg) {
    const resolved = resolveBook(arg);
    if (!existsSync(resolved.indexHtml)) {
      console.error(`✗ Book not found: ${arg}`);
      console.error(`  expected index.html at: ${resolved.indexHtml}`);
      printAvailable();
      process.exit(1);
    }
    return resolved;
  }

  const books = listBooks();
  if (books.length === 0) {
    console.error('✗ No book argument given, and no books found under books/.');
    console.error('  Create one with: npm run new-book -- <slug>');
    process.exit(1);
  }

  if (!process.stdin.isTTY) {
    console.error('✗ No book argument given.');
    printAvailable();
    process.exit(1);
  }

  console.log('Available books:');
  books.forEach((b, i) => console.log(`  ${i + 1}) ${b}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const choice = await ask(rl, `Pick a book (1-${books.length}): `);
  rl.close();
  const idx = parseInt(String(choice).trim(), 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= books.length) {
    console.error('✗ Invalid selection.');
    process.exit(1);
  }
  return resolveBook(books[idx]);
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}
