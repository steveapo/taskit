/*
 * agents.js — Agents page (the "page of choice").
 * Shows a card for each simulated agent with live stats from the task store:
 * a Working/Idle badge, a progress bar of completed vs assigned tasks, and a
 * skills list group with Bootstrap tooltips.
 */
(function (Taskit) {
  'use strict';

  const { store } = Taskit;
  const esc = store.escapeHtml;
  const grid = document.getElementById('agent-grid');

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

  function cardHtml(agent, s) {
    const skills = agent.skills.map(skill =>
      `<li class="list-group-item px-0">
         <span tabindex="0" data-bs-toggle="tooltip" data-bs-title="${esc(skill.tip)}">
           ${esc(skill.name)} <i class="bi bi-info-circle small text-body-secondary" aria-hidden="true"></i>
         </span>
       </li>`).join('');
    return `<div class="col">
        <article class="card h-100 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center gap-3 mb-3">
              <span class="agent-avatar text-bg-${agent.color}"><i class="bi ${agent.icon}" aria-hidden="true"></i></span>
              <div class="flex-grow-1">
                <h2 class="h5 mb-0">${esc(agent.name)}</h2>
                <p class="small text-body-secondary mb-0">${esc(agent.role)}</p>
              </div>
              <span class="badge ${s.working ? 'text-bg-warning' : 'text-bg-secondary'}">${s.working ? 'Working' : 'Idle'}</span>
            </div>
            <p class="small mb-1">${s.done} of ${s.total} tasks completed</p>
            <div class="progress mb-3" role="progressbar" aria-label="${esc(agent.name)} task completion"
                 aria-valuenow="${s.percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar text-bg-${agent.color}" style="width: ${s.percent}%">${s.percent}%</div>
            </div>
            <h3 class="h6">Skills</h3>
            <ul class="list-group list-group-flush">${skills}</ul>
          </div>
          <div class="card-footer bg-transparent">
            <a class="btn btn-sm btn-outline-secondary" href="tasks.html">Assign a task</a>
          </div>
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
    grid.innerHTML = store.AGENTS.map(agent => cardHtml(agent, statsFor(agent.id, tasks))).join('');
    // Bootstrap tooltips are opt-in, so each one has to be created in JS.
    grid.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
  }

  document.addEventListener('taskit:change', render);
  render();
})(window.Taskit);
