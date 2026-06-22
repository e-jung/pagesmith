/*
 * Pagewright — Playwright launch helper with one retry and a helpful message.
 *
 * Exporting needs a headless browser; the most common failure in a fresh
 * checkout is a missing Chromium binary. We retry once (transient launches do
 * happen) and then surface a clear, actionable error instead of a raw stack.
 */
import { chromium } from 'playwright';

const INSTALL_HINT = /executable|chromium|browserType\.launch|ERR_FILE_NOT_FOUND|spawn/i;

export async function launchBrowser(opts = {}, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`⚠  Browser launch failed (${shortMsg(err)}); retrying…`);
      }
    }
  }
  const hint = INSTALL_HINT.test(lastErr.message || '')
    ? '\n  Chromium is not installed. Run: npx playwright install chromium'
    : '';
  throw new Error(`Could not launch browser: ${shortMsg(lastErr)}${hint}`);
}

function shortMsg(err) {
  const m = String(err.message || err).split('\n')[0].trim();
  return m;
}
