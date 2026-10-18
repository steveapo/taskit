/*
 * analytics.js — Analytics page: the summary counts, two charts and the Kanban board.
 * The charts need no library: each bar is a <span> whose width is a percentage, and the
 * priority bar is a row of segments whose flex-grow is their count. Moving a card
 * (drag-and-drop or the "Move to" menu) just calls store.setStatus(), and the
 * `taskit:change` event redraws everything.
 */
(function (Taskit) {
  'use strict';

  const { store, icon } = Taskit;
  const esc = store.escapeHtml;
  const $ = id => document.getElementById(id);
  const COLUMNS = [['todo', 'To do'], ['in-progress', 'In progress'], ['done', 'Completed']];
  const PRIORITIES = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
  const PRIORITY_WORD = { high: 'High', medium: 'Medium', low: 'Low' };
  // "20 Oct", the same short date as the Tasks table. "T00:00" parses it in local time.
  const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const board = $('board');

  // "20 Oct", or the saved text as it is if it isn't a real date (format() would throw).
  function dueText(iso) {
    const date = new Date(iso + 'T00:00');
    return isNaN(date) ? esc(iso) : shortDate.format(date);
  }

  // Whole-number share of the total, e.g. 2 of 6 → 33. Zero when there are no tasks.
  const percent = (n, total) => (total ? Math.round((n / total) * 100) : 0);

  /* ---------- counts and charts ---------- */

  function renderCounts(c) {
    $('count-total').textContent = c.total;
    $('count-pending').textContent = c.pending;
    $('count-done').textContent = c.done;
  }

  // Completed vs pending: one row per bar. Label, a thin track with the fill, then the
  // count and the percentage. The chart is role="img", so its aria-label carries the numbers.
  function renderBars(c) {
    const bars = [['Completed', c.done, 'is-done'], ['Pending', c.pending, 'is-pending']];
    const chart = $('bar-chart');
    chart.innerHTML = bars.map(([label, n, cls]) => `
      <div class="hbar">
        <span class="label">${label}</span>
        <span class="hbar-track"><span class="hbar-fill ${cls}" style="width: ${percent(n, c.total)}%"></span></span>
        <span class="hbar-value"><span class="mono">${n}</span><span class="mono text-body-secondary">${percent(n, c.total)}%</span></span>
      </div>`).join('');
    chart.setAttribute('aria-label', `Completed vs pending: ${c.done} completed (${percent(c.done, c.total)}%) and ` +
      `${c.pending} pending (${percent(c.pending, c.total)}%) out of ${c.total} tasks`);
  }

  // By priority: one bar split into segments. Each segment's flex-grow is its count, so the
  // widths share the bar in proportion without any maths. Empty priorities get no segment.
  function renderPriority(c) {
    const bar = $('priority-bar');
    bar.innerHTML = PRIORITIES
      .filter(([key]) => c[key] > 0)
      .map(([key]) => `<span class="seg is-${key}" style="flex-grow: ${c[key]}"></span>`)
      .join('');
    bar.setAttribute('aria-label', c.total
      ? 'Tasks by priority: ' + PRIORITIES.map(([key, label]) => `${label} ${c[key]} (${percent(c[key], c.total)}%)`).join(', ')
      : 'Tasks by priority: no tasks yet');
    // The legend uses the same shapes as the Tasks table: coral dot, amber dot, grey ring.
    $('priority-legend').innerHTML = c.total
      ? PRIORITIES.map(([key, label]) => `
          <li>
            <span class="prio"><span class="prio-dot is-${key}" aria-hidden="true"></span>${label}</span>
            <span class="mono">${c[key]}</span>
            <span class="mono text-body-secondary">${percent(c[key], c.total)}%</span>
          </li>`).join('')
      : '<li class="legend-empty">No tasks yet. <a class="link-arrow" href="tasks.html">Add one ' + icon('arrow-right') + '</a></li>';
  }

  /* ---------- Kanban ---------- */

  // The keyboard and touch alternative to dragging: a small ghost select in each card.
  function moveSelectHtml(t, id) {
    const options = COLUMNS
      .map(([status, label]) => `<option value="${status}"${status === t.status ? ' selected' : ''}>${label}</option>`).join('');
    return `<div class="pill pill-ghost">
        <label class="visually-hidden" for="move-${id}">Move “${esc(t.name)}” to</label>
        <select class="pill-select" id="move-${id}" data-move="${id}">${options}</select>
        ${icon('chevron-down', 'pill-chevron')}
      </div>`;
  }

  // One card: name (with the pulsing dot while an agent works on it), then
  // "Athena · 20 Oct · ● High", then the move menu. The hidden words make the meta
  // line read "due 20 Oct" and "High priority" to screen readers.
  function cardHtml(t) {
    const agent = store.agentById(t.agentId);
    const id = esc(t.id);
    const key = PRIORITY_WORD[t.priority] ? t.priority : 'medium';
    const working = t.status === 'in-progress' ? '<span class="dot-working" aria-hidden="true"></span>' : '';
    return `<article class="board-card${t.status === 'done' ? ' is-done' : ''}" draggable="true" data-id="${id}">
        <h4 class="board-card-title">${working}<span>${esc(t.name)}</span></h4>
        <p class="board-card-meta">
          <span>${esc(agent ? agent.name : 'Unassigned')}</span>
          <span><span class="visually-hidden">due </span><time class="mono" datetime="${esc(t.dueDate)}">${dueText(t.dueDate)}</time></span>
          <span><span class="prio"><span class="prio-dot is-${key}" aria-hidden="true"></span>${PRIORITY_WORD[key]}<span class="visually-hidden"> priority</span></span></span>
        </p>
        ${moveSelectHtml(t, id)}
      </article>`;
  }

  // Three columns. Each column is also the drop target (data-status says which status it means).
  function renderBoard() {
    const tasks = store.getTasks();
    board.innerHTML = COLUMNS.map(([status, label]) => {
      const cards = tasks.filter(t => t.status === status);
      return `<section class="board-col" data-status="${status}" aria-label="${label} column">
          <h3 class="board-head"><span>${label}</span><span class="mono text-body-secondary">${cards.length}</span></h3>
          ${cards.map(cardHtml).join('') || '<p class="board-empty">Nothing here.</p>'}
        </section>`;
    }).join('');
  }

  // All drag-and-drop listeners sit on the board itself, so re-rendering the cards never loses them.
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.board-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  board.addEventListener('dragend', e => {
    const card = e.target.closest('.board-card');
    if (card) card.classList.remove('dragging');
  });
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.board-col');
    if (!col) return;
    e.preventDefault(); // allows the drop
    col.classList.add('drag-over');
  });
  board.addEventListener('dragleave', e => {
    const col = e.target.closest('.board-col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.board-col');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    store.setStatus(e.dataTransfer.getData('text/plain'), col.dataset.status);
  });

  // Keyboard and touch alternative to dragging.
  board.addEventListener('change', e => {
    const id = e.target.dataset.move;
    if (!id) return;
    store.setStatus(id, e.target.value);
    const moved = document.getElementById('move-' + id); // the board re-rendered: put focus back on the same card
    if (moved) moved.focus();
  });

  function render() {
    const c = store.counts();
    renderCounts(c);
    renderBars(c);
    renderPriority(c);
    renderBoard();
  }

  document.addEventListener('taskit:change', render);
  render();
})(window.Taskit);
