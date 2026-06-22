/*
 * Pagewright — book-data validator.
 *
 * Validates a parsed book object (the JSON from <script id="book-data">) against
 * the shape render.js expects, plus structural checks the renderer can't catch
 * (sequential page numbers, missing images). Missing art is a *warning*, not an
 * error — Pagewright intentionally renders labelled placeholders so layout is
 * reviewable before art exists.
 *
 *   npm run validate -- books/<slug>
 *   node engine/validate-book.mjs books/<slug>
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBookData } from './lib/book-data.mjs';
import { requireBookArg } from './lib/cli.mjs';

export const VALID_POS = ['center', 'top', 'bottom', 'sky', 'left', 'right', 'wavy'];
export const VALID_KIND = ['cover', 'title', 'story'];

export function validateBook(data, bookDir) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['book data is not an object'], warnings };
  }
  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('book is missing a top-level "title" string');
  }
  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    errors.push('book has no pages ("pages" is missing or empty)');
    return { valid: false, errors, warnings };
  }

  data.pages.forEach((pg, i) => {
    const where = `page ${i + 1}`;
    if (!pg || typeof pg !== 'object' || Array.isArray(pg)) {
      errors.push(`${where}: not an object`);
      return;
    }
    if (typeof pg.n !== 'number' || pg.n !== i + 1) {
      errors.push(`${where}: expected "n": ${i + 1}, got ${JSON.stringify(pg.n)}`);
    }
    if (pg.kind && !VALID_KIND.includes(pg.kind)) {
      errors.push(`${where}: unknown "kind" "${pg.kind}" (valid: ${VALID_KIND.join(' | ')})`);
    }
    if (pg.pos && !VALID_POS.includes(pg.pos)) {
      errors.push(
        `${where}: "pos" "${pg.pos}" is not valid (valid: ${VALID_POS.join(' | ')})`,
      );
    } else if (!pg.pos) {
      warnings.push(`${where}: no "pos" (defaults to center)`);
    }

    // A page must carry some content. Cover/title pages use title+subtitle;
    // story pages use text. Empty pages are always wrong.
    const hasText = typeof pg.text === 'string' && pg.text.trim().length > 0;
    const hasTitle = typeof pg.title === 'string' && pg.title.trim().length > 0;
    if (!hasText && !hasTitle) {
      errors.push(`${where}: empty page (needs "text" or "title")`);
    }

    // Image references resolve relative to the book directory.
    if (pg.image) {
      const imgPath = join(bookDir, pg.image);
      if (!existsSync(imgPath)) {
        warnings.push(`${where}: image "${pg.image}" not found (renders as placeholder)`);
      }
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

export function formatReport(report, slug) {
  const lines = [];
  if (report.valid && report.warnings.length === 0) {
    lines.push(`✓ ${slug}: valid (${report.errors.length} issues)`);
    return lines.join('\n');
  }
  if (report.valid) {
    lines.push(`✓ ${slug}: valid, with ${report.warnings.length} warning(s)`);
  } else {
    lines.push(`✗ ${slug}: ${report.errors.length} issue(s)`);
  }
  for (const e of report.errors) lines.push(`  • ${e}`);
  if (report.warnings.length) {
    lines.push(`⚠  ${report.warnings.length} warning(s):`);
    for (const w of report.warnings) lines.push(`  • ${w}`);
  }
  return lines.join('\n');
}

async function runCli() {
  const book = await requireBookArg(process.argv.slice(2));
  const data = await extractBookData(book.indexHtml);
  const report = validateBook(data, book.bookDir);
  const msg = formatReport(report, book.slug);
  if (report.valid) {
    console.log(msg);
  } else {
    console.error(msg);
    process.exit(1);
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) runCli();
