/*
 * home.js — Home page. Everything here is drawn from Taskit.store, so it is always live:
 *   - the product-shot window ("Agent run" + "This week") and its "Run an agent" button,
 *   - the three feature panels (agent picker, task rows, mini board),
 *   - the agents strip.
 * Every store change fires `taskit:change`, and we simply redraw.
 * (The activity feed lives on the Tasks page.)
 */
(function (Taskit) {
  'use strict';

  const { store, sim } = Taskit;
  const { icon, activity, ui } = Taskit;
  const { agentName, COLUMNS } = ui; // shared with the Tasks and Analytics pages
  const esc = store.escapeHtml;
  const timeAgo = activity.timeAgo; // "5 minutes ago", shared with the Tasks page feed

  // How a step reads in the window's "Agent run" log. Other types aren't shown there.
  const STEPS = { started: 'Started', completed: 'Completed', edited: 'Edited', moved: 'Moved' };
  // The word in front of the agent's name in a task row ("Working · Athena").
  const STATUS_WORD = { todo: 'Queued', 'in-progress': 'Working', done: 'Completed' };

  let focusId = null;      // the task the "Agent run" pane follows once the visitor runs one
  let running = false;     // true while the simulated agent is working
  let drawnDone = null;    // ids of Completed tasks whose check has already drawn (null = first render)

  // All tasks, soonest due first. The window and "Run an agent" share this order.
  function tasksByDue() {
    return store.applyView(store.getTasks(), { sort: 'due-asc' });
  }

  /* ---------- small HTML builders ---------- */

  // One task row: icon (from js/ui.js), name, then "Working · Athena". The words carry the
  // status, so the icon is decoration for screen readers. `isNew` makes a check draw itself.
  function taskRow(task, isNew) {
    return `<li class="${task.status === 'done' ? 'row-done' : ''}">
        ${ui.statusIcon(task.status, isNew)}
        <span class="row-main">${esc(task.name)}
          <span class="row-meta">${STATUS_WORD[task.status]} · ${esc(agentName(task.agentId))}</span></span>
      </li>`;
  }

  /* ---------- the product-shot window ---------- */

  // The task the left pane shows: the one just run, otherwise the newest task.
  function focusTask(tasks) {
    const chosen = tasks.find(t => t.id === focusId);
    if (chosen) return chosen;
    return tasks.reduce((newest, t) => (!newest || t.createdAt > newest.createdAt ? t : newest), null);
  }

  function renderRunPane(tasks) {
    const pane = document.getElementById('run-pane');
    const task = focusTask(tasks);
    if (!task) {
      pane.innerHTML = '<div class="prompt"><p class="prompt-text text-body-secondary mb-0">Add a task to see an agent pick it up.</p></div>';
      return;
    }
    // The activity log only stores the task's name, so we match on that, oldest first.
    const steps = store.getActivity()
      .filter(a => a.taskName === task.name && STEPS[a.type])
      .reverse()
      .slice(-3)
      .map(a => `<li><span class="step-dot" aria-hidden="true"></span>${STEPS[a.type]} · ${timeAgo(a.at)}</li>`)
      .join('');
    const live = task.status === 'in-progress' ? '<li><span class="dot-working"></span>Working…</li>' : '';
    pane.innerHTML = `
      <div class="prompt">
        <p class="prompt-text">${esc(task.name)}<span class="prompt-detail">${esc(task.description)}</span></p>
        <div class="prompt-foot">
          <span>@${esc(agentName(task.agentId))}</span>
          <span class="prompt-send" aria-hidden="true">${icon('arrow-up')}</span>
        </div>
      </div>
      <ol class="steps">
        <li><span class="step-dot" aria-hidden="true"></span>Assigned · ${esc(agentName(task.agentId))}</li>
        ${steps}${live}
      </ol>
      <span class="chip">${icon('calendar-days')}due ${ui.shortDate(task.dueDate)}</span>`;
  }

  // The (up to) five rows in "This week": open work first (In progress and To do, by due
  // date), then Completed. The task just run always stays in view, even once it's Completed and
  // would otherwise fall below the cut, so the visitor sees its check draw.
  function visibleTasks(tasks) {
    const ordered = tasks.filter(t => t.status !== 'done').concat(tasks.filter(t => t.status === 'done'));
    const shown = ordered.slice(0, 5);
    const focus = ordered.find(t => t.id === focusId);
    if (focus && !shown.includes(focus)) {
      shown.pop();       // make room by dropping the last row...
      shown.push(focus); // ...and put the run task there
    }
    return shown;
  }

  function renderWeek(tasks) {
    const list = document.getElementById('week-list');
    const c = store.counts();
    document.getElementById('week-summary').innerHTML =
      `<span class="mono">${c.pending}</span> open · <span class="mono">${c.done}</span> completed`;
    if (!tasks.length) {
      list.innerHTML = `<li><a class="link-arrow" href="tasks.html">No tasks yet. Add one ${icon('arrow-right')}</a></li>`;
      return;
    }
    // A check draws only for tasks that weren't Completed last time we drew (and on first load).
    const doneNow = new Set(tasks.filter(t => t.status === 'done').map(t => t.id));
    // The key cap is aria-hidden so the link's name is just "Add a task…".
    list.innerHTML = visibleTasks(tasks).map(t => taskRow(t, !drawnDone || !drawnDone.has(t.id))).join('') +
      '<li><a class="row-add" href="tasks.html">Add a task… <kbd class="kbd" aria-hidden="true">N</kbd></a></li>';
    drawnDone = doneNow;
  }

  // The window-bar button: ready, working, or nothing left to run.
  function renderRunButton(tasks) {
    const button = document.getElementById('run-agent');
    const hasTodo = tasks.some(t => t.status === 'todo');
    button.disabled = running || !hasTodo;
    if (running) button.textContent = 'Working…';
    else if (hasTodo) button.innerHTML = 'Run an agent ' + icon('play');
    else button.textContent = 'All caught up';
  }

  // Runs the simulated agent on the first To do task in the "This week" list, so the
  // run always happens in view: the row's dot starts pulsing, then its check draws and
  // the step log fills in. (If no To do is in view, any To do will do; it then stays shown.)
  async function runAgent() {
    const tasks = tasksByDue();
    const isTodo = t => t.status === 'todo';
    const task = visibleTasks(tasks).find(isTodo) || tasks.find(isTodo);
    if (!task || running) return;
    const status = document.getElementById('run-status');
    const who = agentName(task.agentId);
    running = true;
    focusId = task.id;
    status.textContent = `${who} started “${task.name}”.`;
    let finished = false;
    try {
      finished = await sim.run(task.id); // fires taskit:change at the start and at the end
    } finally {
      // Runs even if the simulation throws, so the button can never stay stuck on "Working…".
      running = false;
      status.textContent = finished ? `${who} completed “${task.name}”.` : `“${task.name}” was stopped.`;
      // Only the button needs updating: the store's change event already redrew the rest,
      // and redrawing the rows again now would cut the check's drawing short.
      renderRunButton(tasksByDue());
    }
  }

  /* ---------- feature panels and agents strip ---------- */

  // Agent picker: the four agents, with a check on the one running the focus task.
  function renderPicker(tasks) {
    const focus = focusTask(tasks);
    const chosen = focus ? focus.agentId : store.AGENTS[0].id;
    document.getElementById('agent-picker').innerHTML = `
      <p class="picker-head mb-0">Assign to</p>
      <ul class="picker-list">${store.AGENTS.map(a => `
        <li class="${a.id === chosen ? 'is-selected' : ''}">
          <span>${esc(a.name)}</span><span class="picker-role">${esc(a.role)}</span>
          ${a.id === chosen ? icon('check') + '<span class="visually-hidden">(selected)</span>' : ''}
        </li>`).join('')}
      </ul>`;
  }

  // Three rows with live statuses: one of each status when we have them.
  function renderWorkList(tasks) {
    const picks = COLUMNS.map(([status]) => tasks.find(t => t.status === status)).filter(Boolean);
    tasks.forEach(t => { if (picks.length < 3 && !picks.includes(t)) picks.push(t); });
    document.getElementById('work-list').innerHTML = picks.length
      ? picks.map(t => taskRow(t, false)).join('')
      : '<li class="text-body-secondary">No tasks yet.</li>';
  }

  // Mini board: a count per column and up to four placeholder cards.
  function renderMiniBoard() {
    const c = store.counts();
    document.getElementById('mini-board').innerHTML = COLUMNS.map(([status, label]) => {
      const cards = '<span class="mini-card"></span>'.repeat(Math.min(c[status], 4));
      const more = c[status] > 4 ? `<span class="mini-more mono">+${c[status] - 4}</span>` : '';
      return `<div class="mini-col">
          <p class="mini-head"><span class="mini-count mono">${c[status]}</span><span>${label}</span></p>
          ${cards}${more}
        </div>`;
    }).join('');
  }

  function renderAgentTiles() {
    document.getElementById('agent-tiles').innerHTML = store.AGENTS.map(a =>
      `<li class="tile"><span>${esc(a.name)}</span><span class="small text-body-secondary">${esc(a.role)}</span></li>`
    ).join('');
  }

  function renderAll() {
    const tasks = tasksByDue();
    renderRunPane(tasks);
    renderWeek(tasks);
    renderRunButton(tasks);
    renderPicker(tasks);
    renderWorkList(tasks);
    renderMiniBoard();
  }

  document.getElementById('run-agent').addEventListener('click', runAgent);
  document.addEventListener('taskit:change', renderAll);
  setInterval(renderAll, 60000); // keep "5 minutes ago" labels fresh

  renderAgentTiles(); // the agents never change, so this draws once
  renderAll();
})(window.Taskit);
