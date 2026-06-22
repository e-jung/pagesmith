# Pagesmith

**An agent-native authoring engine for illustrated books.**
A book is a plain HTML document an agent (or you) edits directly — words, layout,
and art are separate, swappable layers. Rendering and image generation are
isolated steps. Like [hyperframes](https://github.com/heygen-com/hyperframes) made
video web-native and agent-authorable, Pagesmith does it for **books** — picture
books, comics, photo books, anything that's pages of images + text.

> Status: early. Engine + tooling + a runnable demo book.

## Why this exists — generator app vs. authoring engine

Most "AI book" tools are **generators**: prompt in → finished artifact out. When you
want a change you re-roll the dice and hope; the thing you liked last time is gone,
and there's no durable, inspectable source to edit.

Pagesmith is an **authoring engine**. The book is a document:

| | Generator app | Pagesmith (authoring engine) |
|---|---|---|
| Source of truth | an ephemeral prompt | an HTML doc in your repo |
| A small fix | re-roll the whole book | edit one line, re-render one page |
| Randomness | contaminates the whole artifact | **quarantined** to the image step |
| Version control | nothing meaningful to diff | clean diffs, git-friendly |
| Who's the author | the app | **you / your agent** |

The key move: **quarantine the dice.** Image generation is the only stochastic
step, so a page you like stays good forever — regenerating art never disturbs the
words or the layout.

## Quickstart
```bash
# Preview — no build, no server:
open books/demo/index.html        # placeholders show until art is added

# Exports + image prep (optional):
npm install && npx playwright install chromium
npm run pdf -- books/demo     # -> dist/demo.pdf  (print-ready flip-through)
npm run png -- books/demo     # -> dist/demo-png/page-NN.png  (also how an agent "looks")
npm run validate -- books/demo   # check book data before exporting
npm run new-book -- <slug>        # scaffold a new book from the demo template
```
All `npm run` book commands accept a bare slug (`demo`), a dir (`books/demo`),
or an HTML path; with no argument they list available books and prompt.

## How a book is built
```
engine/                 reusable, book-agnostic
  base.css              page canvas, fonts, pos-* text-placement zones
  render.js             paints pages from inlined JSON (browser, no build)
  export-pdf.mjs        HTML -> print-ready PDF (Playwright)
  export-png.mjs        each page -> PNG (Playwright)
  validate-book.mjs     checks book data: schema, page order, image refs
  lib/                  shared CLI helpers (arg resolution, book-data, browser launch)
tools/
  prep-images.mjs       de-batch grid sheets, trim captions, scrub watermarks,
                        normalize to one full-bleed canvas (config: art-sources.json)
  new-book.mjs          scaffold a new book from books/demo/
books/demo/
  index.html            SOURCE OF TRUTH: pages as inlined JSON + links to engine
  book.css              this book's palette
  images/               page-NN.png (placeholders until real art drops in)
tests/                  node:test suite (render, validate, cli, export, new-book)
AGENTS.md               how an agent authors/edits a book here
```
Text and layout are deterministic and editable today. Plug your own image model
into `images/` — the engine doesn't care which one.

## Make your own book
`npm run new-book -- <slug>` scaffolds from `books/demo/`: it copies the template,
rewrites the title, and empties `images/`. Then edit the JSON pages. Keep your
books in their own (private, if you like) repo and vendor or depend on this
engine — see `AGENTS.md`.

## The agent review loop
Because pages are real HTML, an agent can **render → look → fix → re-render**: run
`npm run png`, view the PNGs, adjust `pos-*`/wording/CSS per page, re-render. No
regeneration, no dice.

## Generating art
`tools/gen-images.mjs` generates one full-res image per page from each page's art
direction in a locked style, via a free keyless FLUX endpoint (Pollinations) — no
batching, no watermark. Configure the `gen` block in `art-sources.json` (model,
style, size, seedBase) and run `npm run gen`. Swap in a keyed backend (fal.ai /
Replicate / local ComfyUI) by editing the one `generate()` function.

## Roadmap
- [ ] Character consistency recipe (ComfyUI + IP-Adapter) — same character across pages
- [x] `tools/gen-images.mjs` — generate full-res art from a free/hosted endpoint
- [ ] Second template: `comic` (panel-grid pages + speech bubbles)
- [x] `npm run new-book <slug>` scaffolding command
- [ ] Spread (two-page) layouts + print bleed/trim presets
- [ ] Bundled OFL handwriting font (offline, no Google Fonts dependency)

## License
Apache-2.0.
