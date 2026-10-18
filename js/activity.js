/*
 * activity.js — the "Latest activity" feed, from the store's activity log.
 * Used by the Tasks page (the feed itself) and the Home page (only timeAgo, for the
 * step log in the app window). It draws nothing on its own: the page calls
 * Taskit.activity.render(listEl, limit) whenever it wants the list redrawn.
 */
(function (Taskit) {
  'use strict';

  const { store } = Taskit;
  const { agentName } = Taskit.ui; // "Athena", or "An agent" if the id is unknown
  const esc = store.escapeHtml;

  // How each activity type reads in the feed: [icon name, sentence builder]
  const ACTIVITY = {
    added: ['plus', (agent, task) => `New task for ${agent}: ${task}`],
    edited: ['pencil', (agent, task) => `${task} was updated`],
    deleted: ['trash', (agent, task) => `${task} was removed`],
    started: ['play', (agent, task) => `${agent} started working on ${task}`],
    completed: ['check', (agent, task) => `${agent} completed ${task}`],
    moved: ['arrows-right-left', (agent, task) => `${task} was moved on the board`],
  };

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const UNITS = [['day', 86400], ['hour', 3600], ['minute', 60]];

  // "5 minutes ago", "yesterday"... Anything under a minute reads "just now".
  function timeAgo(ms) {
    const seconds = Math.round((ms - Date.now()) / 1000);
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  // Draws the newest `limit` entries into `listEl`. Returns the newest entry as plain text
  // (or '' if there is none), so the page can announce it in its live status line.
  function render(listEl, limit) {
    const items = store.getActivity(limit);
    if (!items.length) {
      listEl.innerHTML = '<li class="text-body-secondary">No activity yet. Add a task to get your agents going.</li>';
      return '';
    }
    listEl.innerHTML = items.map(item => {
      const [iconName, sentence] = ACTIVITY[item.type] || ACTIVITY.edited;
      // Every store string is escaped before it goes into the HTML.
      const text = sentence(`<strong>${esc(agentName(item.agentId))}</strong>`, `“${esc(item.taskName)}”`);
      return `<li>
          <span class="row-icon" aria-hidden="true">${Taskit.icon(iconName)}</span>
          <span class="row-main">${text}<span class="row-meta">${timeAgo(item.at)}</span></span>
        </li>`;
    }).join('');
    // The same sentence again with no HTML, for the status line (set with textContent).
    const newest = items[0];
    const plainSentence = (ACTIVITY[newest.type] || ACTIVITY.edited)[1];
    return plainSentence(agentName(newest.agentId), `“${newest.taskName}”`);
  }

  Taskit.activity = { render, timeAgo };
})(window.Taskit);
