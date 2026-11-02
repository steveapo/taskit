/*
 * kanban.js — the Kanban board behind the Tasks page's "Board" view: three columns
 * (To do, In progress, Completed) of task cards.
 * Moving a card (drag-and-drop or the "Move to" menu) just calls store.setStatus(), and
 * the page's `taskit:change` listener redraws the board, so it never edits itself.
 */
(function (Taskit) {
  'use strict';

  const { store, icon, ui } = Taskit;
  const { COLUMNS } = ui; // [value, word] pairs, e.g. ['done', 'Completed']
  const esc = store.escapeHtml;

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
    const id = esc(t.id);
    const working = t.status === 'in-progress' ? '<span class="dot-working" aria-hidden="true"></span>' : '';
    return `<article class="board-card${t.status === 'done' ? ' is-done' : ''}" draggable="true" data-id="${id}">
        <h4 class="board-card-title">${working}<span>${esc(t.name)}</span></h4>
        <p class="board-card-meta">
          <span>${esc(ui.agentName(t.agentId, 'Unassigned'))}</span>
          <span><span class="visually-hidden">due </span>${ui.dueHtml(t.dueDate)}</span>
          <span>${ui.priorityHtml(t.priority)}<span class="visually-hidden"> priority</span></span>
        </p>
        ${moveSelectHtml(t, id)}
      </article>`;
  }

  // Three columns from `tasks`, which the page has already searched, filtered and sorted,
  // so the toolbar works on the board too. Each column is also the drop target
  // (data-status says which status it means).
  function render(board, tasks) {
    board.innerHTML = COLUMNS.map(([status, label]) => {
      const cards = tasks.filter(t => t.status === status);
      return `<section class="board-col" data-status="${status}" aria-label="${label} column">
          <h3 class="board-head"><span>${label}</span><span class="mono text-body-secondary">${cards.length}</span></h3>
          ${cards.map(cardHtml).join('') || '<p class="board-empty">Nothing here.</p>'}
        </section>`;
    }).join('');
  }

  // All listeners sit on the board itself, so re-rendering the cards never loses them.
  // Called once per page.
  function init(board) {
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
  }

  Taskit.kanban = { render, init };
})(window.Taskit);
