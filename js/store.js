/*
 * store.js — Taskit's single source of truth.
 * Holds the tasks and the activity log, saves them in localStorage, and fires a
 * `taskit:change` event after every change so each page can re-render itself.
 * Also exposes two pure helpers (applyView, escapeHtml) so they can be unit-tested.
 */
(function (Taskit) {
  'use strict';

  const KEYS = { tasks: 'taskit.tasks', activity: 'taskit.activity' };
  const ACTIVITY_CAP = 50;
  const STATUSES = ['todo', 'in-progress', 'done'];
  const PRIORITIES = ['high', 'medium', 'low'];

  // The four simulated agents. Fixed in code: users assign tasks to them but can't edit them.
  // `skills` are what an agent is good at (for people); `tools` are what it calls while it
  // works, which the simulated usage below counts.
  const AGENTS = [
    {
      id: 'athena', name: 'Athena', role: 'Research & planning', icon: 'light-bulb',
      tools: ['web_search', 'read_page', 'take_notes'],
      skills: [
        { name: 'Web research', tip: 'Finds, reads and cites reliable sources' },
        { name: 'Planning', tip: 'Breaks big goals into clear steps' },
        { name: 'Summaries', tip: 'Condenses long documents into key points' },
      ],
    },
    {
      id: 'hermes', name: 'Hermes', role: 'Writing & communication', icon: 'envelope',
      tools: ['draft_text', 'check_grammar', 'translate'],
      skills: [
        { name: 'Copywriting', tip: 'Drafts emails, posts and documentation' },
        { name: 'Editing', tip: 'Fixes tone, grammar and clarity' },
        { name: 'Translation', tip: 'Writes in both Greek and English' },
      ],
    },
    {
      id: 'pythagoras', name: 'Pythagoras', role: 'Data & analysis', icon: 'calculator',
      tools: ['run_query', 'run_python', 'make_chart'],
      skills: [
        { name: 'Data cleaning', tip: 'Tidies messy spreadsheets' },
        { name: 'Statistics', tip: 'Spots trends and outliers' },
        { name: 'Reporting', tip: 'Turns numbers into charts and insights' },
      ],
    },
    {
      id: 'hephaestus', name: 'Hephaestus', role: 'Code & building', icon: 'wrench-screwdriver',
      tools: ['read_file', 'edit_file', 'run_tests'],
      skills: [
        { name: 'Coding', tip: 'Writes HTML, CSS and JavaScript' },
        { name: 'Debugging', tip: 'Tracks down and fixes bugs' },
        { name: 'Testing', tip: 'Checks that features really work' },
      ],
    },
  ];

  // Sample data for a first visit, so every page has something to show. `days` is relative to today.
  const SEED = [
    { name: 'Research competitor pricing', description: 'Compare the pricing pages of the top five task-management tools and summarise their tiers.', agentId: 'athena', priority: 'high', status: 'in-progress', days: 2 },
    { name: 'Draft launch newsletter', description: 'Write a friendly 200-word email announcing the new Kanban board.', agentId: 'hermes', priority: 'medium', status: 'todo', days: 5 },
    { name: 'Analyse Q3 sign-up data', description: 'Find which week had the most sign-ups and explain why.', agentId: 'pythagoras', priority: 'high', status: 'done', days: -1 },
    { name: 'Fix login page bug', description: 'The login button does nothing on small screens. Find and fix the cause.', agentId: 'hephaestus', priority: 'high', status: 'todo', days: 1 },
    { name: 'Summarise customer interviews', description: 'Turn eight interview transcripts into the top five user needs.', agentId: 'athena', priority: 'low', status: 'done', days: -3 },
    { name: 'Build pricing page prototype', description: 'Create a responsive HTML prototype of the new pricing page.', agentId: 'hephaestus', priority: 'medium', status: 'todo', days: 7 },
  ];

  let storage = defaultStorage();
  let tasks = [];
  let activity = [];
  let persistent = true;

  /* ---------- helpers ---------- */

  // Some browsers throw just for touching localStorage when it's blocked (e.g. strict privacy modes).
  function defaultStorage() {
    try { return window.localStorage; } catch (err) { return null; }
  }

  function newId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // 'en-CA' formats as YYYY-MM-DD in local time (toISOString would use UTC and can be a day off).
  function isoDaysFromNow(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
  }

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ESCAPES[ch]);
  }

  function agentById(id) {
    return AGENTS.find(a => a.id === id);
  }

  /* ---------- persistence ---------- */

  function seed() {
    const now = Date.now();
    tasks = SEED.map((s, i) => ({
      id: newId(), name: s.name, description: s.description, dueDate: isoDaysFromNow(s.days),
      priority: s.priority, status: s.status, agentId: s.agentId, createdAt: now - (i + 1) * 3600e3,
    }));
    activity = tasks
      .filter(t => t.status !== 'todo')
      .map((t, i) => ({
        id: newId(), type: t.status === 'done' ? 'completed' : 'started',
        taskName: t.name, agentId: t.agentId, at: now - (i + 1) * 7 * 60e3,
      }));
  }

  function read(key) {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }

  function load() {
    try {
      if (!storage) throw new Error('localStorage unavailable');
      persistent = true;
      const saved = read(KEYS.tasks);
      if (Array.isArray(saved)) {
        tasks = saved;
        activity = read(KEYS.activity) || [];
      } else {
        seed();
        save();
      }
    } catch (err) {
      // Corrupt JSON or blocked storage: keep the site usable with in-memory sample data.
      console.warn('Taskit: storage unavailable, changes will not be saved.', err);
      seed();
      persistent = false;
    }
  }

  function save() {
    if (!persistent) return;
    try {
      storage.setItem(KEYS.tasks, JSON.stringify(tasks));
      storage.setItem(KEYS.activity, JSON.stringify(activity));
    } catch (err) {
      console.warn('Taskit: could not save.', err);
      persistent = false;
    }
  }

  // Every mutation ends here: log it, save, and tell the page to re-render.
  function commit(type, task) {
    activity.unshift({ id: newId(), type, taskName: task.name, agentId: task.agentId, at: Date.now() });
    activity.length = Math.min(activity.length, ACTIVITY_CAP);
    save();
    document.dispatchEvent(new CustomEvent('taskit:change', { detail: { type, id: task.id } }));
  }

  /* ---------- tasks ---------- */

  // Validates and normalises user input. `base` supplies current values when editing.
  function clean(fields, base) {
    const name = String(fields.name ?? base.name ?? '').trim();
    const description = String(fields.description ?? base.description ?? '').trim();
    const dueDate = String(fields.dueDate ?? base.dueDate ?? '');
    if (!name || !description || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error('A task needs a name, a description and a due date.');
    }
    return {
      name: name.slice(0, 80),
      description: description.slice(0, 300),
      dueDate,
      priority: PRIORITIES.includes(fields.priority) ? fields.priority : (base.priority || 'medium'),
      agentId: agentById(fields.agentId) ? fields.agentId : (base.agentId || AGENTS[0].id),
    };
  }

  const find = id => tasks.find(t => t.id === id);

  function getTasks() { return tasks.map(t => ({ ...t })); }

  function getTask(id) {
    const t = find(id);
    return t ? { ...t } : null;
  }

  function addTask(fields) {
    const task = { id: newId(), ...clean(fields, {}), status: 'todo', createdAt: Date.now() };
    tasks.push(task);
    commit('added', task);
    return { ...task };
  }

  function updateTask(id, fields) {
    const task = find(id);
    if (!task) return null;
    Object.assign(task, clean(fields, task));
    commit('edited', task);
    return { ...task };
  }

  function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    const [removed] = tasks.splice(index, 1);
    commit('deleted', removed);
    return true;
  }

  function setStatus(id, status, logType = 'moved') {
    const task = find(id);
    if (!task || !STATUSES.includes(status)) return null;
    if (task.status !== status) {
      task.status = status;
      commit(logType, task);
    }
    return { ...task };
  }

  function getActivity(limit = ACTIVITY_CAP) {
    return activity.slice(0, limit).map(a => ({ ...a }));
  }

  function counts() {
    const c = { total: tasks.length, todo: 0, 'in-progress': 0, done: 0, pending: 0, high: 0, medium: 0, low: 0 };
    tasks.forEach(t => { c[t.status]++; c[t.priority]++; });
    c.pending = c.todo + c['in-progress'];
    return c;
  }

  /* ---------- simulated usage (pure) ---------- */

  // The agents are a simulation, so their usage is too. Every number below is worked out
  // from the task itself each time it's needed, so nothing extra is saved. The same task
  // always gives the same numbers, and they grow as the task moves: To do uses nothing,
  // In progress half, Completed all of it.
  // Known limit: usage lives on the tasks, so deleting a task removes its usage; store a usage
  // log if spent tokens should outlive deleted tasks.

  // Demo prices in US dollars per million tokens. Input is what the agent reads, output
  // what it writes, and writing costs more.
  const RATES = { input: 3, output: 15 };
  const SHARE = { todo: 0, 'in-progress': 0.5, done: 1 };
  const USAGE_KEYS = ['input', 'output', 'tokens', 'cost', 'calls'];

  // FNV-1a: turns a string into a 32-bit number. A small change in the string gives a very
  // different number, so it works as a repeatable "random" number for a task.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0; // >>> 0 reads it as a positive number
  }

  // One task's usage: tokens in and out, the cost, and the calls to each of its agent's tools.
  function taskUsage(task) {
    const share = SHARE[task.status] || 0;
    // A whole number from min to max, fixed for this task and this `key`, then scaled by share.
    const pick = (key, min, max) => Math.round(share * (min + hash(task.id + key) % (max - min + 1)));
    const agent = agentById(task.agentId);
    const tools = {};
    (agent ? agent.tools : []).forEach(name => { tools[name] = pick(name, 1, 12); });
    const input = pick('input', 8000, 40000);
    const output = pick('output', 1500, 8000);
    return {
      input, output, tokens: input + output,
      cost: (input * RATES.input + output * RATES.output) / 1e6,
      calls: Object.values(tools).reduce((sum, n) => sum + n, 0),
      tools,
    };
  }

  // Usage added up three ways: in total, per agent (with its tools), and per tool.
  function usage(list = tasks) {
    const empty = () => ({ input: 0, output: 0, tokens: 0, cost: 0, calls: 0 });
    const add = (into, u) => USAGE_KEYS.forEach(k => { into[k] += u[k]; });
    const total = empty();
    const byAgent = {};
    const byTool = {};
    AGENTS.forEach(a => {
      byAgent[a.id] = { ...empty(), tools: {} };
      a.tools.forEach(name => { byAgent[a.id].tools[name] = 0; byTool[name] = 0; });
    });
    list.forEach(t => {
      const u = taskUsage(t);
      add(total, u);
      if (!byAgent[t.agentId]) return; // a task saved with an unknown agent counts only in the total
      add(byAgent[t.agentId], u);
      Object.entries(u.tools).forEach(([name, n]) => { byAgent[t.agentId].tools[name] += n; byTool[name] += n; });
    });
    return { total, byAgent, byTool };
  }

  /* ---------- search / filter / sort (pure) ---------- */

  const SORTS = {
    'due-asc': (a, b) => a.dueDate.localeCompare(b.dueDate),
    'due-desc': (a, b) => b.dueDate.localeCompare(a.dueDate),
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  };

  function applyView(list, view) {
    const q = (view.search || '').trim().toLowerCase();
    const matches = t =>
      (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) &&
      (view.status === 'pending' ? t.status !== 'done' : view.status === 'completed' ? t.status === 'done' : true) &&
      (!view.priority || view.priority === 'all' || t.priority === view.priority) &&
      (!view.agentId || view.agentId === 'all' || t.agentId === view.agentId);
    const out = list.filter(matches); // filter() returns a new array, so sorting it can't reorder `list`
    return SORTS[view.sort] ? out.sort(SORTS[view.sort]) : out;
  }

  function useStorage(s) {
    storage = s;
    load();
  }

  Taskit.store = {
    AGENTS, STATUSES, PRIORITIES, agentById,
    getTasks, getTask, addTask, updateTask, deleteTask, setStatus,
    getActivity, counts, applyView, escapeHtml, taskUsage, usage,
    get persistent() { return persistent; },
    _useStorage: useStorage,
  };

  load();
})(window.Taskit = window.Taskit || {});
