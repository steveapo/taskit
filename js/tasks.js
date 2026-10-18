/*
 * tasks.js — Tasks page: the composer (add/edit form), the task table, the summary counts,
 * the search/filter/sort toolbar, the N and / keyboard shortcuts, and the "Latest activity"
 * feed under the table (drawn by js/activity.js).
 * The table is never edited directly: every action goes through Taskit.store, whose
 * `taskit:change` event triggers render(), so the table and counts always match the data.
 */
(function (Taskit) {
  'use strict';

  const { store, layout, sim, icon, ui } = Taskit;
  const esc = store.escapeHtml;
  const $ = id => document.getElementById(id);

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

  /* ---------- table (the date, priority and status cells come from js/ui.js) ---------- */

  // A small ghost icon button. `label` is already escaped by the caller.
  function actionButton(action, id, iconName, label, disabled, extraClass = '') {
    return `<button type="button" class="btn btn-icon ${extraClass}" data-action="${action}" data-id="${id}"
              aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}>${icon(iconName)}</button>`;
  }

  function rowHtml(t) {
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
        <td class="text-nowrap">${esc(ui.agentName(t.agentId, 'Unassigned'))}</td>
        <td class="text-nowrap">${ui.dueHtml(t.dueDate)}</td>
        <td class="text-nowrap">${ui.priorityHtml(t.priority)}</td>
        <td class="text-nowrap">${ui.statusHtml(t.status, justDone)}</td>
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
    ui.renderCounts(store.counts());
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

  // Each field and the error message under the composer that belongs to it. layout.js links
  // them (aria-invalid + aria-describedby) only while the field is invalid.
  layout.linkErrors(form, { 'task-name': 'name-error', 'task-description': 'detail-error', 'task-due': 'due-error' });

  function resetForm() {
    form.reset();
    layout.clearValidation(form);
    $('task-id').value = ''; // hidden inputs aren't cleared by form.reset()
    $('form-heading').textContent = 'Add a task';
    setSubmitLabel('Add task');
    $('task-cancel').classList.add('d-none');
  }

  function startEdit(id) {
    const t = store.getTask(id);
    if (!t) return;
    layout.clearValidation(form); // a failed add before this must not leave its errors on the edit
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
    if (!layout.validateForm(form)) return;
    const id = $('task-id').value;
    if (id) store.updateTask(id, readForm());
    else store.addTask(readForm());
    resetForm();
  });

  $('task-cancel').addEventListener('click', resetForm);

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
