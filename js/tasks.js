/*
 * tasks.js — Tasks page: the composer (add/edit form), the task table, the summary counts,
 * the search/filter/sort toolbar, the N and / keyboard shortcuts, and the "Latest activity"
 * feed under the table (drawn by js/activity.js).
 * The table is never edited directly: every action goes through Taskit.store, whose
 * `taskit:change` event triggers render(), so the table and counts always match the data.
 */
(function (Taskit) {
  'use strict';

  const { store, layout, sim, icon } = Taskit;
  const esc = store.escapeHtml;
  const $ = id => document.getElementById(id);

  // How each status and priority reads in the table. The word is always shown, so the
  // icon or dot next to it is only a visual aid (colour is never the only signal).
  const STATUS_WORD = { todo: 'To do', 'in-progress': 'In progress', done: 'Completed' };
  const PRIORITY_WORD = { high: 'High', medium: 'Medium', low: 'Low' };

  // "20 Oct" for the table, and "20 October 2026" for the tooltip, which also shows the year.
  const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const form = $('task-form');
  // The toolbar's starting state. "Clear the filters" puts every control back to this.
  const DEFAULT_VIEW = { search: '', status: 'all', priority: 'all', agentId: 'all', sort: 'due-asc' };
  // Current toolbar state, passed straight to store.applyView().
  const view = { ...DEFAULT_VIEW };

  let newTaskId = null;  // the task just added: its row flashes once
  let doneBefore = null; // ids that were Completed at the last render (null before the first one)

  function fillAgentSelects() {
    $('task-agent').innerHTML = store.AGENTS
      .map(a => `<option value="${a.id}">${esc(a.name)} (${esc(a.role)})</option>`).join('');
    $('filter-agent').insertAdjacentHTML('beforeend', store.AGENTS
      .map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join(''));
  }

  /* ---------- table ---------- */

  // A <time> element: short text, full date as a tooltip. "T00:00" makes the date parse
  // in local time, not UTC (which could be a day off).
  function dueHtml(iso) {
    const date = new Date(iso + 'T00:00');
    // A broken saved date (e.g. "2026-13-45") would make format() throw: show it as it is.
    if (isNaN(date)) return `<span class="mono">${esc(iso)}</span>`;
    return `<time class="mono" datetime="${esc(iso)}" title="${longDate.format(date)}">${shortDate.format(date)}</time>`;
  }

  // Priority as shape plus word: coral dot (High), amber dot (Medium), hollow grey ring (Low).
  function priorityHtml(priority) {
    const key = PRIORITY_WORD[priority] ? priority : 'medium';
    return `<span class="prio"><span class="prio-dot is-${key}" aria-hidden="true"></span>${PRIORITY_WORD[key]}</span>`;
  }

  // Status as icon plus word, with the same icons as the Home page: a hollow circle (To do),
  // the pulsing dot (In progress) and the check (Completed). `drawCheck` makes the check
  // draw itself; it is only true on the render where the task has just become Completed.
  function statusHtml(status, drawCheck) {
    let iconHtml = '<span class="row-icon is-todo" aria-hidden="true"></span>';
    if (status === 'in-progress') {
      iconHtml = '<span class="row-icon is-working" aria-hidden="true"><span class="dot-working"></span></span>';
    } else if (status === 'done') {
      iconHtml = `<span class="row-icon" aria-hidden="true"><svg class="check-draw${drawCheck ? ' is-new' : ''}" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8"/><path d="M4.75 8.25l2.25 2.25 4.25-4.5" pathLength="1"/></svg></span>`;
    }
    return `<span class="status">${iconHtml}${STATUS_WORD[status] || STATUS_WORD.todo}</span>`;
  }

  // A small ghost icon button. `label` is already escaped by the caller.
  function actionButton(action, id, iconName, label, disabled, extraClass = '') {
    return `<button type="button" class="btn btn-icon ${extraClass}" data-action="${action}" data-id="${id}"
              aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}>${icon(iconName)}</button>`;
  }

  function rowHtml(t) {
    const agent = store.agentById(t.agentId);
    const done = t.status === 'done';
    const justDone = done && doneBefore !== null && !doneBefore.has(t.id); // was it Completed last time?
    const classes = ['task-row'];
    if (done) classes.push('is-done');
    if (t.id === newTaskId) classes.push('is-new');
    const id = esc(t.id);
    const name = esc(t.name);
    return `<tr class="${classes.join(' ')}">
        <td class="task-cell">
          <span class="task-name">${name}</span>
          <span class="task-detail">${esc(t.description)}</span>
        </td>
        <td class="text-nowrap">${esc(agent ? agent.name : 'Unassigned')}</td>
        <td class="text-nowrap">${dueHtml(t.dueDate)}</td>
        <td class="text-nowrap">${priorityHtml(t.priority)}</td>
        <td class="text-nowrap">${statusHtml(t.status, justDone)}</td>
        <td class="text-nowrap text-end">
          ${actionButton('run', id, 'play', `Run agent on ${name}`, t.status !== 'todo')}
          ${actionButton('complete', id, 'check', `Mark ${name} as completed`, done)}
          ${actionButton('edit', id, 'pencil-square', `Edit ${name}`, false)}
          ${actionButton('delete', id, 'trash', `Delete ${name}`, false, 'btn-icon-danger')}
        </td>
      </tr>`;
  }

  // The single row shown when the table is empty. If tasks exist but none match, it
  // offers a button that resets the toolbar.
  function emptyRowHtml(hasTasks) {
    const message = hasTasks
      ? 'No tasks match. <button type="button" class="link-arrow" data-action="clear">Clear the filters</button>'
      : 'No tasks yet. Add your first one above.';
    return `<tr><td colspan="6" class="task-empty">${message}</td></tr>`;
  }

  function render() {
    const all = store.getTasks();
    const shown = store.applyView(all, view);
    const c = store.counts();
    $('count-total').textContent = c.total;
    $('count-pending').textContent = c.pending;
    $('count-done').textContent = c.done;
    $('table-caption').textContent = `Showing ${shown.length} of ${all.length} tasks`;
    $('task-rows').innerHTML = shown.length ? shown.map(rowHtml).join('') : emptyRowHtml(all.length > 0);
    // Remember which tasks are Completed now, so a check only draws once, when it changes.
    // (All tasks, not just the shown ones, so clearing a filter doesn't redraw old checks.)
    doneBefore = new Set(all.filter(t => t.status === 'done').map(t => t.id));
  }

  /* ---------- form: add + edit ---------- */

  function readForm() {
    return {
      name: $('task-name').value,
      description: $('task-description').value,
      dueDate: $('task-due').value,
      priority: $('task-priority').value,
      agentId: $('task-agent').value,
    };
  }

  // The round send button has no visible text, so its aria-label (and tooltip) says what it does.
  function setSubmitLabel(text) {
    $('task-submit').setAttribute('aria-label', text);
    $('task-submit').title = text;
  }

  // Each field and the error message under the composer that belongs to it.
  const ERRORS = { 'task-name': 'name-error', 'task-description': 'detail-error', 'task-due': 'due-error' };

  // Links a field to its error only while the field is invalid, so screen readers hear
  // "invalid, Give the task a name." on a bad field and nothing extra on a good one.
  // Only after a submit attempt (.was-validated), like the red borders.
  function updateErrorAttributes() {
    const checked = form.classList.contains('was-validated');
    Object.entries(ERRORS).forEach(([fieldId, errorId]) => {
      const field = $(fieldId);
      if (checked && !field.validity.valid) {
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', errorId);
      } else {
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
    });
  }

  // Wipes every trace of an earlier failed submit: the red state, the "spaces only" errors
  // that layout.js stored on the text fields, and the error links above.
  function clearValidation() {
    form.classList.remove('was-validated');
    $('task-name').setCustomValidity('');
    $('task-description').setCustomValidity('');
    updateErrorAttributes();
  }

  function resetForm() {
    form.reset();
    clearValidation();
    $('task-id').value = ''; // hidden inputs aren't cleared by form.reset()
    $('form-heading').textContent = 'Add a task';
    setSubmitLabel('Add task');
    $('task-cancel').classList.add('d-none');
  }

  function startEdit(id) {
    const t = store.getTask(id);
    if (!t) return;
    clearValidation(); // a failed add before this must not leave its errors on the edit
    $('task-id').value = t.id;
    $('task-name').value = t.name;
    $('task-description').value = t.description;
    $('task-due').value = t.dueDate;
    $('task-priority').value = t.priority;
    $('task-agent').value = t.agentId;
    $('form-heading').textContent = 'Edit task';
    setSubmitLabel('Save changes');
    $('task-cancel').classList.remove('d-none');
    form.scrollIntoView({ block: 'center' });
    $('task-name').focus();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const valid = layout.validateForm(form);
    updateErrorAttributes();
    if (!valid) return;
    const id = $('task-id').value;
    if (id) store.updateTask(id, readForm());
    else store.addTask(readForm());
    resetForm();
  });

  $('task-cancel').addEventListener('click', resetForm);

  // Keep the error links up to date while the user fixes a field. This listener is on the
  // document and added after layout.js's one, so it runs after layout.js re-checks the text.
  document.addEventListener('input', e => {
    if (form.contains(e.target)) updateErrorAttributes();
  });

  /* ---------- toolbar: each control updates one key of `view`, then re-renders ---------- */

  const CONTROLS = { search: 'search', status: 'filter-status', priority: 'filter-priority', agentId: 'filter-agent', sort: 'sort' };
  Object.entries(CONTROLS).forEach(([key, id]) => {
    // 'input' fires on every keystroke in the search box and on every change in the selects.
    $(id).addEventListener('input', e => {
      view[key] = e.target.value;
      render();
    });
  });

  // Puts every toolbar control (and `view`) back to its starting value. The button that
  // called this disappears with the empty row, so focus moves to the search box.
  function clearFilters() {
    Object.entries(CONTROLS).forEach(([key, id]) => {
      view[key] = DEFAULT_VIEW[key];
      $(id).value = DEFAULT_VIEW[key];
    });
    render();
    $('search').focus();
  }

  /* ---------- row actions (one delegated listener for the whole table) ---------- */

  const actions = {
    run: id => sim.run(id),
    complete: id => store.setStatus(id, 'done', 'completed'),
    edit: id => startEdit(id),
    delete: id => {
      const t = store.getTask(id);
      if (!t || !confirm(`Delete "${t.name}"? This can't be undone.`)) return;
      if ($('task-id').value === id) resetForm();
      store.deleteTask(id);
    },
    clear: () => clearFilters(),
  };

  $('task-rows').addEventListener('click', e => {
    const button = e.target.closest('button[data-action]');
    if (button) actions[button.dataset.action](button.dataset.id);
  });

  /* ---------- keyboard shortcuts: N = new task, / = search ---------- */

  // True when the key press belongs to a field the user is typing in.
  const isTyping = el => el.closest('input, textarea, select, [contenteditable]') !== null;

  document.addEventListener('keydown', e => {
    // Leave the browser's own shortcuts alone (Ctrl+N, Cmd+N...) and never steal typed letters.
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'n' || e.key === 'N') {
      if (e.shiftKey) return;
      e.preventDefault(); // otherwise the "n" would be typed into the field we focus
      $('task-name').focus();
    } else if (e.key === '/') {
      e.preventDefault(); // stops Firefox opening its quick-find bar
      $('search').focus();
    }
  });

  /* ---------- latest activity (drawn by js/activity.js) ---------- */

  // Redraws the feed. `announce` is false for the 60-second refresh, which only keeps
  // "5 minutes ago" fresh: the status line must stay quiet then, so screen readers
  // only hear about real changes.
  function renderActivity(announce) {
    const newest = Taskit.activity.render($('activity-list'), 8);
    if (announce) $('activity-status').textContent = newest ? 'Latest: ' + newest : '';
  }

  /* ---------- start ---------- */

  fillAgentSelects();
  document.addEventListener('taskit:change', e => {
    // A new task's row flashes once: mark it for this render only.
    newTaskId = e.detail && e.detail.type === 'added' ? e.detail.id : null;
    render();
    newTaskId = null;
    renderActivity(true);
  });
  setInterval(() => renderActivity(false), 60000);
  render();
  renderActivity(false);
})(window.Taskit);
