# Authoring books in Pagewright (for agents)

Pagewright is an **authoring engine**, not a generator. The book is a document you
edit, not a roll of the dice you re-roll. Make surgical edits; never regenerate a
whole book to fix one page.

## Where things live
- `books/<slug>/index.html` — **the source of truth.** The book's content is the
  inlined `<script type="application/json" id="book-data">` block. Edit it directly.
- `engine/base.css` — book-agnostic layout, fonts, and `pos-*` text-placement zones.
- `books/<slug>/book.css` — that book's palette/overrides only.
- `books/<slug>/images/` — page art (`page-NN.png`). Missing art renders as a
  labelled placeholder, so layout is reviewable before art exists.

## How to make common changes
- **Reword a page** → edit that page's `text`. `\n\n` = paragraph, `\n` = line break.
- **Move the text** → change `pos`: `center|top|bottom|sky|left|right|wavy`.
- **Emphasize** → wrap words in `<em>…</em>`; shout lines in `<span class="shout">…</span>`.
- **Swap art** → drop a new `images/page-NN.png`. Don't touch other pages.
- **Re-skin** → edit `book.css` CSS variables. The words and art are untouched.

## Preview & export
- Preview: open `books/<slug>/index.html` in a browser (no build, no server).
- PDF (print target): `npm run pdf -- books/<slug>`. PNGs: `npm run png -- books/<slug>`.
  - A bare slug (`demo`), a dir (`books/demo`), or an HTML path all work.
  - No argument lists available books and prompts (or lists + exits if non-interactive).
  - Output defaults to `dist/<slug>.pdf` and `dist/<slug>-png/`; pass a second arg to override.
- Validate a book before exporting: `npm run validate -- books/<slug>`. Catches bad
  `pos`, non-sequential page numbers, empty pages, etc. Exports run this automatically.
- Exports are render targets — generate them at the end, never edit them.

## The one stochastic step
Image generation is the only non-deterministic part, and it's **quarantined** in
`images/`. A page you like stays liked; regenerating art never disturbs the words
or layout. (A book with an art pipeline keeps an `art-sources.json` for
`npm run prep`; the demo book does not — it ships placeholders.)

## Starting a new book
Run `npm run new-book -- <slug>` to scaffold from `books/demo/`: it copies the
template, rewrites the title to the slug, and empties `images/`. Then edit the
JSON pages. Everything in `engine/` is reused unchanged.
