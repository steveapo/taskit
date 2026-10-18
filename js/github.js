/*
 * github.js — "Built in the open" on the About page: the site's public API feature.
 * Fetches the 5 latest commits of a GitHub repository from the GitHub REST API (no key
 * needed for public repositories) and shows them as rows. Successful answers are kept
 * in sessionStorage for 5 minutes, because GitHub allows only 60 requests an hour
 * without a key. Taskit.github.load(skipCache) reloads the list; Refresh calls it with true.
 */
(function (Taskit) {
  'use strict';

  // Change this to your own "username/repository" once the Taskit repo is public on GitHub.
  const REPO = 'twbs/bootstrap';

  const API_URL = `https://api.github.com/repos/${REPO}/commits?per_page=5`;
  const REPO_URL = `https://github.com/${REPO}`;
  const CACHE_KEY = 'taskit.github.' + REPO; // one cache entry per repository
  const CACHE_MS = 5 * 60 * 1000;            // 5 minutes, in milliseconds

  // What to show for each way the request can fail. The keys are the error messages
  // that fetchCommits() throws: an HTTP status code, or 'network'.
  const LIMIT = "GitHub's hourly limit was reached. Try again later.";
  const MESSAGES = {
    404: "This repository isn't public yet.",
    403: LIMIT,
    429: LIMIT,
    network: "Couldn't reach GitHub. Check your connection.",
    other: "GitHub sent an answer Taskit couldn't read. Try again later.",
  };

  const esc = Taskit.store.escapeHtml;
  const list = document.getElementById('github-commits');
  const refresh = document.getElementById('github-refresh');

  /* ---------- cache ---------- */

  // The saved commits, if they are younger than 5 minutes; otherwise null.
  // try/catch: storage can be blocked, and the saved text could be broken.
  function readCache() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (saved && Date.now() - saved.at < CACHE_MS && Array.isArray(saved.data)) return saved.data;
    } catch (err) { /* treat it as "nothing saved" */ }
    return null;
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch (err) { /* not cached; the next visit simply asks GitHub again */ }
  }

  /* ---------- request ---------- */

  // Asks GitHub for the commits. Throws an Error whose message is a key of MESSAGES.
  async function fetchCommits() {
    let res;
    try {
      res = await fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } });
    } catch (err) {
      throw new Error('network'); // fetch only throws when no answer came back at all
    }
    if (!res.ok) throw new Error(String(res.status)); // 404, 403, 429...
    const data = await res.json();
    // Never trust the shape of someone else's API: we need a list.
    if (!Array.isArray(data)) throw new Error('other');
    return data;
  }

  /* ---------- drawing ---------- */

  // A single quiet row for loading, empty and error states.
  function quietRow(html) {
    return `<li class="text-body-secondary">${html}</li>`;
  }

  // "5 minutes ago" from the commit date. If the date can't be read, show it as it came;
  // if there is none, show nothing.
  function whenText(date) {
    const ms = Date.parse(date);
    return Number.isNaN(ms) ? String(date || '') : Taskit.activity.timeAgo(ms);
  }

  // One commit row. Every value from the API is escaped before it goes into the HTML,
  // and the row only becomes a link if the address really points at github.com.
  function commitHtml(item) {
    const commit = (item && item.commit) || {};
    const author = commit.author || {};
    const message = String(commit.message || 'No message').split('\n')[0]; // first line only
    const sha = String((item && item.sha) || '').slice(0, 7);               // short id, like git shows
    const meta = [
      sha ? `<span class="mono">${esc(sha)}</span>` : '',
      esc(author.name || 'Unknown author'),
      esc(whenText(author.date)),
    ].filter(Boolean).join(' · ');
    const body = `<span class="row-main"><span class="commit-message">${esc(message)}</span><span class="row-meta">${meta}</span></span>`;

    const url = item && item.html_url;
    if (typeof url !== 'string' || !url.startsWith('https://github.com/')) return `<li>${body}</li>`;
    return `<li><a class="commit-link" href="${esc(url)}" target="_blank" rel="noopener">${body}${Taskit.icon('arrow-up-right')}<span class="visually-hidden"> (opens in a new tab)</span></a></li>`;
  }

  // Shows the commits: from the cache when it is fresh, otherwise from GitHub.
  // skipCache = true (the Refresh button) always asks GitHub.
  async function load(skipCache) {
    // A disabled button loses keyboard focus, so remember whether it had it and give it back.
    const hadFocus = document.activeElement === refresh;
    refresh.disabled = true;
    // role="status" makes screen readers say "Loading commits…"; the list itself is not a live region.
    list.innerHTML = quietRow('<span role="status" class="d-inline-flex align-items-center gap-2"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Loading commits…</span>');
    try {
      let data = skipCache ? null : readCache();
      if (!data) {
        data = await fetchCommits();
        writeCache(data);
      }
      list.innerHTML = data.length ? data.slice(0, 5).map(commitHtml).join('') : quietRow('No commits yet.');
    } catch (err) {
      console.warn('GitHub activity could not load:', err.message);
      list.innerHTML = quietRow(esc(MESSAGES[err.message] || MESSAGES.other));
    } finally {
      refresh.disabled = false;
      if (hadFocus) refresh.focus();
    }
  }

  // Wire up the About page: repository name and link, the Refresh button, first load.
  document.getElementById('github-repo').textContent = REPO;
  document.getElementById('github-link').href = REPO_URL;
  refresh.addEventListener('click', () => load(true));
  load(false);

  Taskit.github = { load };
})(window.Taskit);
