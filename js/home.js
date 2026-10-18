/*
 * home.js — Home page. Everything here is drawn from Taskit.store, so it is always live:
 *   - the product-shot window ("Agent run" + "This week") and its "Run an agent" button,
 *   - the three feature panels (agent picker, task rows, mini board),
 *   - the agents strip and the latest-activity feed,
 *   - "Agent thought of the day", from a public quotes API (dummyjson.com, no key needed).
 * Every store change fires `taskit:change`, and we simply redraw.
 */
(function (Taskit) {
  'use strict';

  const { store, sim } = Taskit;
  const esc = store.escapeHtml;
  const QUOTE_URL = 'https://dummyjson.com/quotes/random';
  const FALLBACK = { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' };

  // How each activity type reads in the feed: [icon, sentence builder]
  const ACTIVITY = {
    added: ['bi-plus', (agent, task) => `New task for ${agent}: ${task}`],
    edited: ['bi-pencil', (agent, task) => `${task} was updated`],
    deleted: ['bi-trash', (agent, task) => `${task} was removed`],
    started: ['bi-play', (agent, task) => `${agent} started working on ${task}`],
    completed: ['bi-check2', (agent, task) => `${agent} completed ${task}`],
    moved: ['bi-arrow-left-right', (agent, task) => `${task} was moved on the board`],
  };
  // How a step reads in the window's "Agent run" log. Other types aren't shown there.
  const STEPS = { started: 'Started', completed: 'Completed', edited: 'Edited', moved: 'Moved' };
  // The word in front of the agent's name in a task row ("Working · Athena").
  const STATUS_WORD = { todo: 'Queued', 'in-progress': 'Working', done: 'Done' };
  const COLUMNS = [['todo', 'To do'], ['in-progress', 'In progress'], ['done', 'Done']];

  let focusId = null;      // the task the "Agent run" pane follows once the visitor runs one
  let running = false;     // true while the simulated agent is working
  let drawnDone = null;    // ids of Done tasks whose check has already drawn (null = first render)

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const UNITS = [['day', 86400], ['hour', 3600], ['minute', 60]];

  function timeAgo(ms) {
    const seconds = Math.round((ms - Date.now()) / 1000);
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  function agentName(id) {
    const agent = store.agentById(id);
    return agent ? agent.name : 'An agent';
  }

  // All tasks, soonest due first. The window and "Run an agent" share this order.
  function tasksByDue() {
    return store.applyView(store.getTasks(), { sort: 'due-asc' });
  }

  /* ---------- small HTML builders ---------- */

  // The 14px status icon: hollow circle (To do), pulsing dot (In progress), check (Done).
  // `isNew` makes the check draw itself; only used the first time a task shows as Done.
  function statusIcon(status, isNew) {
    if (status === 'in-progress') return '<span class="row-icon is-working" aria-hidden="true"><span class="dot-working"></span></span>';
    if (status === 'done') {
      return `<span class="row-icon" aria-hidden="true"><svg class="check-draw${isNew ? ' is-new' : ''}" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8"/><path d="M4.75 8.25l2.25 2.25 4.25-4.5" pathLength="1"/></svg></span>`;
    }
    return '<span class="row-icon is-todo" aria-hidden="true"></span>';
  }

  // One task row: icon, name, then "Working · Athena". The words carry the status,
  // so the icon is decoration for screen readers.
  function taskRow(task, isNew) {
    return `<li class="${task.status === 'done' ? 'row-done' : ''}">
        ${statusIcon(task.status, isNew)}
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
      .map(a => `<li><i class="bi bi-dot" aria-hidden="true"></i>${STEPS[a.type]} · ${timeAgo(a.at)}</li>`)
      .join('');
    const live = task.status === 'in-progress' ? '<li><span class="dot-working"></span>Working…</li>' : '';
    pane.innerHTML = `
      <div class="prompt">
        <p class="prompt-text">${esc(task.name)}<span class="prompt-detail">${esc(task.description)}</span></p>
        <div class="prompt-foot">
          <span>@${esc(agentName(task.agentId))}</span>
          <span class="prompt-send" aria-hidden="true"><i class="bi bi-arrow-up"></i></span>
        </div>
      </div>
      <ol class="steps">
        <li><i class="bi bi-dot" aria-hidden="true"></i>Assigned · ${esc(agentName(task.agentId))}</li>
        ${steps}${live}
      </ol>
      <span class="chip"><i class="bi bi-calendar3" aria-hidden="true"></i>due ${esc(task.dueDate)}</span>`;
  }

  // The (up to) five rows in "This week": open work first (In progress and To do, by due
  // date), then Done. The task just run always stays in view, even once it's Done and
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
      `<span class="mono">${c.pending}</span> open · <span class="mono">${c.done}</span> done`;
    if (!tasks.length) {
      list.innerHTML = '<li><a class="link-arrow" href="tasks.html">No tasks yet. Add one</a></li>';
      return;
    }
    // A check draws only for tasks that weren't Done last time we drew (and on first load).
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
    else if (hasTodo) button.innerHTML = 'Run an agent <span aria-hidden="true">▶</span>';
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
          ${a.id === chosen ? '<i class="bi bi-check2" aria-hidden="true"></i><span class="visually-hidden">(selected)</span>' : ''}
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

  /* ---------- latest activity ---------- */

  function renderActivity() {
    const list = document.getElementById('activity-list');
    const items = store.getActivity(8);
    if (!items.length) {
      list.innerHTML = '<li class="text-body-secondary">No activity yet. Add a task to get your agents going.</li>';
      return;
    }
    list.innerHTML = items.map(item => {
      const [icon, sentence] = ACTIVITY[item.type] || ACTIVITY.edited;
      const text = sentence(`<strong>${esc(agentName(item.agentId))}</strong>`, `“${esc(item.taskName)}”`);
      return `<li>
          <span class="row-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
          <span class="row-main">${text}<span class="row-meta">${timeAgo(item.at)}</span></span>
        </li>`;
    }).join('');
  }

  function renderAll() {
    const tasks = tasksByDue();
    renderRunPane(tasks);
    renderWeek(tasks);
    renderRunButton(tasks);
    renderPicker(tasks);
    renderWorkList(tasks);
    renderMiniBoard();
    renderActivity();
  }

  /* ---------- thought of the day ---------- */

  async function loadQuote() {
    const box = document.getElementById('quote');
    const button = document.getElementById('new-quote');
    button.disabled = true;
    box.innerHTML = '<div class="spinner-border spinner-border-sm text-body-secondary" role="status"><span class="visually-hidden">Loading…</span></div>';
    let data;
    try {
      const res = await fetch(QUOTE_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      // Never trust the shape of someone else's API.
      if (typeof data.quote !== 'string' || typeof data.author !== 'string') throw new Error('Unexpected response');
    } catch (err) {
      console.warn('Quote API failed, showing a fallback quote.', err);
      data = FALLBACK;
    }
    box.innerHTML = `<figure class="mb-0">
        <blockquote class="mb-1"><p class="mb-0">${esc(data.quote)}</p></blockquote>
        <figcaption class="small text-body-secondary">${esc(data.author)}</figcaption>
      </figure>`;
    button.disabled = false;
  }

  document.getElementById('run-agent').addEventListener('click', runAgent);
  document.getElementById('new-quote').addEventListener('click', loadQuote);
  document.addEventListener('taskit:change', renderAll);
  setInterval(renderAll, 60000); // keep "5 minutes ago" labels fresh

  renderAgentTiles(); // the agents never change, so this draws once
  renderAll();
  loadQuote();
})(window.Taskit);
