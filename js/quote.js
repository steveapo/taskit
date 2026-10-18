/*
 * quote.js — "Agent thought of the day", from a public quotes API (dummyjson.com, no key
 * needed). This is the site's one use of an external API. Used by the Agents page:
 * Taskit.quote.load(boxEl, buttonEl) fetches a quote and shows it in boxEl, keeping
 * buttonEl disabled while it waits.
 */
(function (Taskit) {
  'use strict';

  const esc = Taskit.store.escapeHtml;
  const QUOTE_URL = 'https://dummyjson.com/quotes/random';
  // Shown when the request fails (offline, blocked, bad response), so the page is never empty.
  const FALLBACK = { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' };

  async function load(box, button) {
    button.disabled = true;
    box.innerHTML = '<div class="spinner-border spinner-border-sm text-body-secondary" role="status"><span class="visually-hidden">Loading…</span></div>';
    let data;
    try {
      const res = await fetch(QUOTE_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      // Never trust the shape of someone else's API.
      if (typeof data.quote !== 'string' || typeof data.author !== 'string') throw new Error('Unexpected response');
    } catch (err) {
      console.warn('Quote API failed, showing a fallback quote.', err);
      data = FALLBACK;
    }
    // Quote in the text colour, author muted. Both are escaped: they come from outside.
    box.innerHTML = `<figure class="mb-0">
        <blockquote class="mb-1"><p class="mb-0">${esc(data.quote)}</p></blockquote>
        <figcaption class="small text-body-secondary">${esc(data.author)}</figcaption>
      </figure>`;
    button.disabled = false;
  }

  Taskit.quote = { load };
})(window.Taskit);
