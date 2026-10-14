/*
 * home.js — Home page: the latest-activity feed and "Agent thought of the day",
 * which comes from a public quotes API (dummyjson.com, no key needed).
 */
(function (Taskit) {
  'use strict';

  const { store } = Taskit;
  const esc = store.escapeHtml;
  const QUOTE_URL = 'https://dummyjson.com/quotes/random';
  const FALLBACK = { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' };

  // How each activity type reads in the feed: [icon classes, sentence builder]
  const ACTIVITY = {
    added: ['bi-plus-circle text-primary', (agent, task) => `New task for ${agent}: ${task}`],
    edited: ['bi-pencil text-secondary', (agent, task) => `${task} was updated`],
    deleted: ['bi-trash text-danger', (agent, task) => `${task} was removed`],
    started: ['bi-play-circle text-warning', (agent, task) => `${agent} started working on ${task}`],
    completed: ['bi-check-circle text-success', (agent, task) => `${agent} completed ${task}`],
    moved: ['bi-arrow-left-right text-info', (agent, task) => `${task} was moved on the board`],
  };

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const UNITS = [['day', 86400], ['hour', 3600], ['minute', 60]];

  function timeAgo(ms) {
    const seconds = Math.round((ms - Date.now()) / 1000);
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  function renderActivity() {
    const list = document.getElementById('activity-list');
    const items = store.getActivity(8);
    if (!items.length) {
      list.innerHTML = '<li class="py-2 text-body-secondary">No activity yet. Add a task to get your agents going.</li>';
      return;
    }
    list.innerHTML = items.map(item => {
      const agent = store.agentById(item.agentId);
      const [icon, sentence] = ACTIVITY[item.type] || ACTIVITY.edited;
      const text = sentence(`<strong>${esc(agent ? agent.name : 'An agent')}</strong>`, `“${esc(item.taskName)}”`);
      return `<li class="d-flex gap-3 py-2 border-bottom">
          <i class="bi ${icon} fs-5" aria-hidden="true"></i>
          <div><div>${text}</div><small class="text-body-secondary">${timeAgo(item.at)}</small></div>
        </li>`;
    }).join('');
  }

  async function loadQuote() {
    const box = document.getElementById('quote');
    const button = document.getElementById('new-quote');
    button.disabled = true;
    box.innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"><span class="visually-hidden">Loading…</span></div>';
    let data;
    try {
      const res = await fetch(QUOTE_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (err) {
      console.warn('Quote API failed, showing a fallback quote.', err);
      data = FALLBACK;
    }
    box.innerHTML = `<figure class="mb-0">
        <blockquote class="blockquote mb-1"><p class="mb-0">${esc(data.quote)}</p></blockquote>
        <figcaption class="blockquote-footer mb-0">${esc(data.author)}</figcaption>
      </figure>`;
    button.disabled = false;
  }

  document.getElementById('new-quote').addEventListener('click', loadQuote);
  document.addEventListener('taskit:change', renderActivity);
  setInterval(renderActivity, 60000); // keep "5 minutes ago" labels fresh

  renderActivity();
  loadQuote();
})(window.Taskit);
