/*
 * Pagewright — runtime renderer (browser, no build step, no server).
 *
 * Reads the book from an inlined <script type="application/json" id="book-data">
 * block (inlined so it works straight from file:// with no fetch/CORS), and
 * paints each page into the DOM. The JSON is the editable content; engine/base.css
 * + the book's own css own the look. Open index.html in any browser to see it.
 */
(function () {
  const dataEl = document.getElementById('book-data');
  if (!dataEl) return;
  const book = JSON.parse(dataEl.textContent);

  const root = document.createElement('main');
  root.className = 'book';
  root.innerHTML = `<div class="book__masthead">${esc(book.title || '')}${
    book.author ? ' · ' + esc(book.author) : ''
  } — Pagewright preview</div>`;

  book.pages.forEach((pg) => root.appendChild(renderPage(pg)));
  document.body.appendChild(root);

  function renderPage(pg) {
    const section = document.createElement('section');
    section.className = `page page--${pg.kind || 'story'}`;
    section.dataset.n = pg.n;

    // --- art layer (real image, or a labelled placeholder) ---
    const art = document.createElement('div');
    art.className = 'page__art';
    if (pg.image) {
      const img = new Image();
      img.src = pg.image;
      img.alt = pg.art || '';
      img.onerror = () => { art.innerHTML = placeholder(pg); };
      art.appendChild(img);
    } else {
      art.innerHTML = placeholder(pg);
    }
    section.appendChild(art);

    // --- text layer ---
    const text = document.createElement('div');
    text.className = `page__text pos-${pg.pos || 'center'}`;
    if (pg.title) {
      text.innerHTML =
        `<h1 class="page__title">${pg.title}</h1>` +
        (pg.subtitle ? `<p class="page__subtitle">${pg.subtitle}</p>` : '');
    } else if (pg.text) {
      text.innerHTML = paragraphs(pg.text);
    }
    if (text.innerHTML) section.appendChild(text);

    return section;
  }

  // \n\n -> paragraphs, single \n -> line break. Inline HTML (<em>, <span>) passes through.
  function paragraphs(t) {
    return t
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function placeholder(pg) {
    // cover/title get a clean wash (CSS gradient) — no art-direction caption behind the title
    if (pg.kind === 'cover' || pg.kind === 'title') return '';
    return `<div class="page__placeholder"><span>${esc(pg.art || 'art goes here')}` +
      `<small>page ${pg.n} — drop ${pg.image || 'an image'} to replace</small></span></div>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();
