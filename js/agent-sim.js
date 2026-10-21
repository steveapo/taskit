/*
 * agent-sim.js — the "AI" in Taskit is a simulation.
 * run() walks a task To do → In progress → Completed on a timer, logging each step.
 * It only talks to Taskit.store, so every open view (table, Kanban, activity feed)
 * updates itself through the usual `taskit:change` event.
 * Ceiling: timers stop if the user leaves the page, so the task stays "In progress";
 * the user can finish it by hand.
 */
(function (Taskit) {
  'use strict';

  const RUN_MS = 4000;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function run(taskId, ms = RUN_MS) {
    const { store } = Taskit;
    const task = store.getTask(taskId);
    if (!task || task.status !== 'todo') return false;

    store.setStatus(taskId, 'in-progress', 'started');
    await wait(ms);

    // The user may have deleted the task or moved it on the board while the agent "worked".
    const latest = store.getTask(taskId);
    if (!latest || latest.status !== 'in-progress') return false;

    store.setStatus(taskId, 'done', 'completed');
    return true;
  }

  Taskit.sim = { run };
})(window.Taskit = window.Taskit || {});
