/*
 * analytics.js — Analytics page: two CSS-only charts and the Kanban board.
 * Charts need no library: bar heights are percentages, and the pie is one
 * conic-gradient. Moving a card (drag-and-drop or the "Move to" menu) just calls
 * store.setStatus(), and the change event redraws everything.
 */
(function (Taskit) {
  'use strict';

  const { store } = Taskit;
  const esc = store.escapeHtml;
  const COLUMNS = [['todo', 'To do'], ['in-progress', 'In progress'], ['done', 'Done']];
  const PRIORITIES = [['high', 'High', 'var(--bs-danger)'], ['medium', 'Medium', 'var(--bs-warning)'], ['low', 'Low', 'var(--bs-success)']];
  const board = document.getElementById('board');

  /* ---------- charts ---------- */

  function renderBars(c) {
    const bars = [['Completed', c.done, 'bg-success'], ['Pending', c.pending, 'bg-warning']];
    const max = Math.max(c.done, c.pending, 1);
    const chart = document.getElementById('bar-chart');
    chart.innerHTML = bars
      .map(([label, n, cls]) => `<div class="bar ${cls}" style="height: ${(n / max) * 100}%" title="${label}: ${n}"></div>`)
      .join('');
    chart.setAttribute('aria-label', `Bar chart: ${c.done} completed and ${c.pending} pending tasks`);
    document.getElementById('bar-labels').innerHTML = bars
      .map(([label, n]) => `<span>${label}<br><strong>${n}</strong></span>`).join('');
  }

  function renderPie(c) {
    let start = 0;
    const stops = PRIORITIES.map(([key, , color]) => {
      const end = start + (c.total ? (c[key] / c.total) * 100 : 0);
      const stop = `${color} ${start}% ${end}%`;
      start = end;
      return stop;
    });
    const pie = document.getElementById('pie-chart');
    pie.style.background = c.total ? `conic-gradient(${stops.join(', ')})` : '';
    pie.setAttribute('aria-label', 'Pie chart of tasks by priority: ' + PRIORITIES.map(([key, label]) => `${label} ${c[key]}`).join(', '));
    document.getElementById('pie-legend').innerHTML = PRIORITIES.map(([key, label, color]) =>
      `<li class="d-flex align-items-center gap-2 mb-1">
         <span class="d-inline-block rounded-circle" style="width: .9rem; height: .9rem; background: ${color}"></span>
         ${label}: <strong>${c[key]}</strong>
       </li>`).join('');
  }

  /* ---------- Kanban ---------- */

  function cardHtml(t) {
    const agent = store.agentById(t.agentId);
    const id = esc(t.id);
    const options = COLUMNS
      .map(([status, label]) => `<option value="${status}"${status === t.status ? ' selected' : ''}>${label}</option>`).join('');
    return `<article class="card kanban-card priority-${esc(t.priority)} shadow-sm" draggable="true" data-id="${id}">
        <div class="card-body p-2">
          <h4 class="h6 mb-1">${esc(t.name)}</h4>
          <p class="small text-body-secondary mb-2">${esc(agent ? agent.name : 'Unassigned')} · due ${esc(t.dueDate)}</p>
          <label class="visually-hidden" for="move-${id}">Move “${esc(t.name)}” to</label>
          <select class="form-select form-select-sm" id="move-${id}" data-move="${id}">${options}</select>
        </div>
      </article>`;
  }

  function renderBoard() {
    const tasks = store.getTasks();
    board.innerHTML = COLUMNS.map(([status, label]) => {
      const cards = tasks.filter(t => t.status === status);
      return `<div class="col-md-4">
          <section class="card bg-body-tertiary h-100" aria-label="${label} column">
            <h3 class="card-header h6 mb-0 d-flex justify-content-between align-items-center">
              ${label} <span class="badge text-bg-secondary">${cards.length}</span>
            </h3>
            <div class="card-body kanban-col d-flex flex-column gap-2" data-status="${status}">
              ${cards.map(cardHtml).join('') || '<p class="small text-body-secondary mb-0">Nothing here.</p>'}
            </div>
          </section>
        </div>`;
    }).join('');
  }

  // All drag-and-drop listeners sit on the board itself, so re-rendering the cards never loses them.
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.kanban-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  board.addEventListener('dragend', e => {
    const card = e.target.closest('.kanban-card');
    if (card) card.classList.remove('dragging');
  });
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault(); // allows the drop
    col.classList.add('drag-over');
  });
  board.addEventListener('dragleave', e => {
    const col = e.target.closest('.kanban-col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.kanban-col');
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
    renderBars(c);
    renderPie(c);
    renderBoard();
  }

  document.addEventListener('taskit:change', render);
  render();
})(window.Taskit);
