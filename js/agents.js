/*
 * agents.js — Agents page (the "page of choice").
 * Draws one panel per simulated agent with live stats from the task store:
 * Working or Idle, a Bootstrap progress bar of completed vs assigned tasks, and the
 * skills as a Bootstrap list group, each with a Bootstrap tooltip that explains it.
 * Those three components (progress, list group, tooltip) are used on this page only.
 */
(function (Taskit) {
  'use strict';

  const { store, icon } = Taskit;
  const esc = store.escapeHtml;
  const grid = document.getElementById('agent-grid');

  // How much of an agent's work is done: counts, a whole percentage, and whether
  // any of its tasks is in progress right now.
  function statsFor(agentId, tasks) {
    const mine = tasks.filter(t => t.agentId === agentId);
    const done = mine.filter(t => t.status === 'done').length;
    return {
      total: mine.length,
      done,
      working: mine.some(t => t.status === 'in-progress'),
      percent: mine.length ? Math.round((done / mine.length) * 100) : 0,
    };
  }

  // Working: the pulsing accent dot plus the word. Idle: just the word, muted.
  // The word is always there, so the colour is never the only signal.
  function stateHtml(working) {
    return working
      ? '<span class="status agent-state"><span class="dot-working" aria-hidden="true"></span>Working</span>'
      : '<span class="status agent-state is-idle">Idle</span>';
  }

  // One skill row: the name, then a small info button. The button is the tooltip's
  // trigger, so it can be reached with Tab (Bootstrap shows tooltips on hover and focus).
  // Its aria-label names it; Bootstrap links the tip text to it with aria-describedby.
  function skillHtml(skill) {
    const name = esc(skill.name);
    return `<li class="list-group-item">
        <span>${name}</span>
        <button type="button" class="btn btn-icon" data-bs-toggle="tooltip" data-bs-title="${esc(skill.tip)}"
                aria-label="What ${name} covers">${icon('information-circle')}</button>
      </li>`;
  }

  function panelHtml(agent, s) {
    const id = esc(agent.id);
    const name = esc(agent.name);
    // "2 of 3 completed · 67%" above the bar; the same facts in words for screen readers.
    const count = s.total ? `${s.done} of ${s.total} completed · ${s.percent}%` : 'No tasks yet · 0%';
    const spoken = s.total ? `${s.done} of ${s.total} tasks completed` : 'No tasks assigned yet';
    return `<div class="col-md-6">
        <article class="panel" aria-labelledby="agent-${id}">
          <div class="agent-head">
            <span class="agent-avatar" aria-hidden="true">${icon(agent.icon)}</span>
            <div class="agent-name">
              <h2 id="agent-${id}" class="panel-title mb-0">${name}</h2>
              <p class="agent-role">${esc(agent.role)}</p>
            </div>
            ${stateHtml(s.working)}
          </div>
          <p class="agent-count mono">${count}</p>
          <div class="progress agent-progress" role="progressbar" aria-label="${name}: tasks completed"
               aria-valuenow="${s.percent}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${spoken}">
            <div class="progress-bar" style="width: ${s.percent}%"></div>
          </div>
          <div class="stage stage-compact">
            <div class="fragment">
              <p class="picker-head mb-0">Skills</p>
              <ul class="list-group list-group-flush skill-list">${agent.skills.map(skillHtml).join('')}</ul>
            </div>
          </div>
          <a class="link-arrow agent-link" href="tasks.html">Assign a task ${icon('arrow-right')}</a>
        </article>
      </div>`;
  }

  function render() {
    // Dispose old tooltips before their elements are replaced, so none are left floating.
    grid.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      const tip = bootstrap.Tooltip.getInstance(el);
      if (tip) tip.dispose();
    });
    const tasks = store.getTasks();
    grid.innerHTML = store.AGENTS.map(agent => panelHtml(agent, statsFor(agent.id, tasks))).join('');
    // Bootstrap tooltips are opt-in, so each one has to be created in JS.
    grid.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
  }

  // Escape closes an open tooltip without moving the mouse or the focus (WCAG 1.4.13).
  // Bootstrap's tooltips don't do this on their own.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    grid.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      const tip = bootstrap.Tooltip.getInstance(el);
      if (tip) tip.hide();
    });
  });

  document.addEventListener('taskit:change', render);
  render();
})(window.Taskit);
