/*
 * analytics.js — Analytics page: the summary counts, two charts and the simulated usage
 * (tokens, cost, tool calls). The Kanban board lives on the Tasks page (js/kanban.js).
 * The charts need no library: each bar is a <span> whose width is a percentage, and the
 * priority bar is a row of segments whose flex-grow is their count. The
 * `taskit:change` event redraws everything.
 */
(function (Taskit) {
  'use strict';

  const { store, icon, ui } = Taskit;
  const { PRIORITIES } = ui; // [value, word] pairs, e.g. ['high', 'High']
  const esc = store.escapeHtml;
  const $ = id => document.getElementById(id);

  const { percent } = ui; // whole-number share of a total, e.g. 2 of 6 → 33

  /* ---------- charts (the counts above them come from ui.renderCounts) ---------- */

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
      ? PRIORITIES.map(([key]) => `
          <li>
            ${ui.priorityHtml(key)}
            <span class="mono">${c[key]}</span>
            <span class="mono text-body-secondary">${percent(c[key], c.total)}%</span>
          </li>`).join('')
      : '<li class="legend-empty">No tasks yet. <a class="link-arrow" href="tasks.html">Add one ' + icon('arrow-right') + '</a></li>';
  }

  /* ---------- usage (simulated, from store.usage) ---------- */

  // The three totals, then two bar charts: tokens per agent (with the cost next to it) and
  // calls per tool, most used first. Each bar is a share of the total it belongs to.
  function renderUsage() {
    const { total, byAgent, byTool } = store.usage();
    $('usage-tokens').textContent = ui.formatTokens(total.tokens);
    $('usage-cost').textContent = ui.formatCost(total.cost);
    $('usage-calls').textContent = total.calls;

    const agents = $('usage-agents');
    agents.innerHTML = ui.hbarRowsHtml(store.AGENTS.map(a => ({
      label: `<span class="label">${esc(a.name)}</span>`,
      pct: percent(byAgent[a.id].tokens, total.tokens),
      value: `<span class="mono">${ui.formatTokens(byAgent[a.id].tokens)}</span>` +
             `<span class="mono text-body-secondary">${ui.formatCost(byAgent[a.id].cost)}</span>`,
    })));
    agents.setAttribute('aria-label', 'Tokens by agent: ' + store.AGENTS.map(a =>
      `${a.name} ${ui.formatTokens(byAgent[a.id].tokens)} tokens, ${ui.formatCost(byAgent[a.id].cost)}`).join('; '));

    const tools = Object.entries(byTool).sort((a, b) => b[1] - a[1]);
    const toolChart = $('usage-tools');
    toolChart.innerHTML = ui.hbarRowsHtml(tools.map(([name, n]) => ({
      label: `<span class="mono">${esc(name)}</span>`,
      pct: percent(n, total.calls),
      value: `<span class="mono">${n}</span>`,
    })));
    toolChart.setAttribute('aria-label', 'Calls per tool: ' + tools.map(([name, n]) => `${name} ${n}`).join(', '));
  }

  function render() {
    const c = store.counts();
    ui.renderCounts(c);
    renderBars(c);
    renderPriority(c);
    renderUsage();
  }

  document.addEventListener('taskit:change', render);
  render();
})(window.Taskit);
