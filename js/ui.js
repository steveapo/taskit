/*
 * ui.js — small presentation helpers shared by the Home, Tasks and Analytics pages and
 * the activity feed, so each status icon, priority dot, date and agent name is written once.
 * The functions only build HTML strings (or plain text); they never touch the store's data.
 * Anything that came from the store is escaped before it goes into the HTML.
 * Load it right after js/store.js.
 */
(function (Taskit) {
  'use strict';

  const { store } = Taskit;
  const esc = store.escapeHtml;

  // How each status and priority reads on screen, in board / chart order. The word is
  // always shown, so the icon or dot next to it is only a visual aid (colour is never the
  // only signal). Pairs of [value, word], e.g. ['done', 'Completed'].
  const COLUMNS = [['todo', 'To do'], ['in-progress', 'In progress'], ['done', 'Completed']];
  const PRIORITIES = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
  const STATUS_WORD = Object.fromEntries(COLUMNS);      // { todo: 'To do', ... }
  const PRIORITY_WORD = Object.fromEntries(PRIORITIES); // { high: 'High', ... }

  // "20 Oct" for tables and cards, and "20 October 2026" for the tooltip, which also shows the year.
  const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // A saved "2026-10-20" as a Date. "T00:00" makes it parse in local time, not UTC (which
  // could be a day off). Returns null for a broken saved date such as "2026-13-45".
  function parseDate(iso) {
    const date = new Date(iso + 'T00:00');
    return isNaN(date) ? null : date;
  }

  // "20 Oct", or the saved text as it is (escaped) if it isn't a real date (format() would throw).
  function shortDate(iso) {
    const date = parseDate(iso);
    return date ? SHORT_DATE.format(date) : esc(iso);
  }

  // A <time> element: "20 Oct" as the text, the full date as a tooltip.
  function dueHtml(iso) {
    const date = parseDate(iso);
    if (!date) return `<span class="mono">${esc(iso)}</span>`;
    return `<time class="mono" datetime="${esc(iso)}" title="${LONG_DATE.format(date)}">${SHORT_DATE.format(date)}</time>`;
  }

  // The agent's name as plain text (the caller escapes it), or `fallback` if the id is unknown.
  function agentName(id, fallback = 'An agent') {
    const agent = store.agentById(id);
    return agent ? agent.name : fallback;
  }

  // The 14px status icon: hollow circle (To do), pulsing dot (In progress), check (Completed).
  // `drawCheck` makes the check draw itself; pages pass true only on the render where the
  // task has just become Completed. aria-hidden, because the word next to it says the same.
  function statusIcon(status, drawCheck) {
    if (status === 'in-progress') return '<span class="row-icon is-working" aria-hidden="true"><span class="dot-working"></span></span>';
    if (status === 'done') {
      return `<span class="row-icon" aria-hidden="true"><svg class="check-draw${drawCheck ? ' is-new' : ''}" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8"/><path d="M4.75 8.25l2.25 2.25 4.25-4.5" pathLength="1"/></svg></span>`;
    }
    return '<span class="row-icon is-todo" aria-hidden="true"></span>';
  }

  // Status as icon plus word ("✓ Completed"). An unknown status reads as To do.
  function statusHtml(status, drawCheck) {
    return `<span class="status">${statusIcon(status, drawCheck)}${STATUS_WORD[status] || STATUS_WORD.todo}</span>`;
  }

  // Priority as shape plus word: coral dot (High), amber dot (Medium), hollow grey ring (Low).
  // An unknown priority reads as Medium, the store's default.
  function priorityHtml(priority) {
    const key = PRIORITY_WORD[priority] ? priority : 'medium';
    return `<span class="prio"><span class="prio-dot is-${key}" aria-hidden="true"></span>${PRIORITY_WORD[key]}</span>`;
  }

  // The stat strip (Total / Pending / Completed) on the Tasks and Analytics pages.
  // textContent, not innerHTML, so nothing needs escaping.
  function renderCounts(c) {
    document.getElementById('count-total').textContent = c.total;
    document.getElementById('count-pending').textContent = c.pending;
    document.getElementById('count-done').textContent = c.done;
  }

  Taskit.ui = { COLUMNS, PRIORITIES, shortDate, dueHtml, agentName, statusIcon, statusHtml, priorityHtml, renderCounts };
})(window.Taskit);
