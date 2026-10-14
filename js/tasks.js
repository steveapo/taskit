/*
 * tasks.js — Tasks page: add/edit form, the task table, summary counts, and the
 * search/filter/sort toolbar.
 * The table is never edited directly: every action goes through Taskit.store, whose
 * `taskit:change` event triggers render(), so the table and counts always match the data.
 */
(function (Taskit) {
  'use strict';

  const { store, layout } = Taskit;
  const esc = store.escapeHtml;
  const $ = id => document.getElementById(id);

  const PRIORITY_BADGE = { high: 'text-bg-danger', medium: 'text-bg-warning', low: 'text-bg-success' };
  const STATUS_BADGE = {
    todo: ['To do', 'text-bg-secondary'],
    'in-progress': ['In progress', 'text-bg-info'],
    done: ['Done', 'text-bg-success'],
  };
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const form = $('task-form');
  // Current toolbar state, passed straight to store.applyView().
  const view = { search: '', status: 'all', priority: 'all', agentId: 'all', sort: 'due-asc' };

  function fillAgentSelects() {
    $('task-agent').innerHTML = store.AGENTS
      .map(a => `<option value="${a.id}">${esc(a.name)} (${esc(a.role)})</option>`).join('');
    $('filter-agent').insertAdjacentHTML('beforeend', store.AGENTS
      .map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join(''));
  }

  // "T00:00" makes the date parse in local time, not UTC.
  const formatDate = iso => dateFormat.format(new Date(iso + 'T00:00'));

  function actionButton(action, id, icon, style, label, disabled) {
    return `<button type="button" class="btn btn-sm ${style}" data-action="${action}" data-id="${id}"
              aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}>
              <i class="bi ${icon}" aria-hidden="true"></i></button>`;
  }

  function rowHtml(t) {
    const agent = store.agentById(t.agentId);
    const [statusText, statusClass] = STATUS_BADGE[t.status] || STATUS_BADGE.todo;
    const done = t.status === 'done';
    const id = esc(t.id);
    const name = esc(t.name);
    return `<tr class="${done ? 'text-body-secondary' : ''}">
        <td class="fw-semibold">${done ? `<s>${name}</s>` : name}</td>
        <td class="small" style="min-width: 12rem">${esc(t.description)}</td>
        <td class="text-nowrap">${esc(agent ? agent.name : 'Unassigned')}</td>
        <td class="text-nowrap">${formatDate(t.dueDate)}</td>
        <td><span class="badge ${PRIORITY_BADGE[t.priority] || ''} text-capitalize">${esc(t.priority)}</span></td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td class="text-nowrap text-end">
          ${actionButton('complete', id, 'bi-check-lg', 'btn-outline-success', `Mark ${name} as completed`, done)}
          ${actionButton('edit', id, 'bi-pencil', 'btn-outline-secondary', `Edit ${name}`, false)}
          ${actionButton('delete', id, 'bi-trash', 'btn-outline-danger', `Delete ${name}`, false)}
        </td>
      </tr>`;
  }

  function render() {
    const all = store.getTasks();
    const shown = store.applyView(all, view);
    const c = store.counts();
    $('count-total').textContent = c.total;
    $('count-pending').textContent = c.pending;
    $('count-done').textContent = c.done;
    $('table-caption').textContent = `Showing ${shown.length} of ${all.length} tasks`;
    $('task-rows').innerHTML = shown.length
      ? shown.map(rowHtml).join('')
      : `<tr><td colspan="7" class="text-center text-body-secondary py-4">${
          all.length ? 'No tasks match your search or filters.' : 'No tasks yet. Add your first one above.'}</td></tr>`;
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

  function resetForm() {
    form.reset();
    form.classList.remove('was-validated');
    $('task-id').value = ''; // hidden inputs aren't cleared by form.reset()
    $('form-heading').textContent = 'Add a task';
    $('task-submit').textContent = 'Add task';
    $('task-cancel').classList.add('d-none');
  }

  function startEdit(id) {
    const t = store.getTask(id);
    if (!t) return;
    $('task-id').value = t.id;
    $('task-name').value = t.name;
    $('task-description').value = t.description;
    $('task-due').value = t.dueDate;
    $('task-priority').value = t.priority;
    $('task-agent').value = t.agentId;
    $('form-heading').textContent = 'Edit task';
    $('task-submit').textContent = 'Save changes';
    $('task-cancel').classList.remove('d-none');
    form.scrollIntoView({ block: 'start' });
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

  /* ---------- row actions (one delegated listener for the whole table) ---------- */

  const actions = {
    complete: id => store.setStatus(id, 'done', 'completed'),
    edit: id => startEdit(id),
    delete: id => {
      const t = store.getTask(id);
      if (!t || !confirm(`Delete "${t.name}"? This can't be undone.`)) return;
      if ($('task-id').value === id) resetForm();
      store.deleteTask(id);
    },
  };

  $('task-rows').addEventListener('click', e => {
    const button = e.target.closest('button[data-action]');
    if (button) actions[button.dataset.action](button.dataset.id);
  });

  /* ---------- start ---------- */

  fillAgentSelects();
  document.addEventListener('taskit:change', render);
  render();
})(window.Taskit);
