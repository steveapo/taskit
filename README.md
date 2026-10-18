# Taskit

Taskit is a small task manager for teams that hand routine work to AI agents. You add a task, give it to one of four specialist agents, and watch it move from To do to Completed. Tasks can be searched, filtered, sorted, charted and moved on a Kanban board. **The agents are simulated**: a timer in the browser stands in for the agent doing the work. There is no server and no real AI. The site is plain HTML, CSS and JavaScript on top of Bootstrap 5.3.3, and every task stays in the visitor's own browser (`localStorage`).

## Contents

1. [Links](#links)
2. [How to run](#how-to-run)
3. [The task allocation system](#the-task-allocation-system)
4. [Architecture](#architecture)
5. [Coding decisions: Tasks page](#coding-decisions-tasks-page)
6. [Coding decisions: Latest Activity](#coding-decisions-latest-activity)
7. [Coding decisions: Agents page (page of choice)](#coding-decisions-agents-page-page-of-choice)
8. [Other notable decisions](#other-notable-decisions)
9. [Testing](#testing)
10. [Lighthouse audit](#lighthouse-audit-to-be-completed-by-the-student)
11. [Personal reflections](#personal-reflections-to-be-written-by-the-student)
12. [Credits](#credits)

## Links

- GitHub repository: _add after publishing_
- Live site (optional, GitHub Pages): _add if enabled_

Once the repository is public, also change `REPO` at the top of `js/github.js` (it is `'twbs/bootstrap'` for now) to `"username/repository"`, so the About page shows this project's own commits.

## How to run

- Open `index.html` in a browser. No build step and no server are needed: the site works straight from disk (`file://`). An internet connection is needed for Bootstrap, the fonts, the GitHub feed and the map, which all load from the web.
- To run the automated tests, open `tests/tests.html`. The tab title shows `PASS 23/23` when every test passes, and the page lists each test by name.

## The task allocation system

### Data

Every task is a plain object kept by `js/store.js`:

| Field | Meaning |
|---|---|
| `id` | `crypto.randomUUID()`, with a time-plus-random fallback for older browsers |
| `name` | required, trimmed, at most 80 characters |
| `description` | required, trimmed, at most 300 characters |
| `dueDate` | `YYYY-MM-DD` string |
| `priority` | `high`, `medium` or `low` |
| `status` | `todo`, `in-progress` or `done` (shown as To do, In progress, Completed) |
| `agentId` | one of the four agents below |
| `createdAt` | timestamp in milliseconds |

The four agents are fixed in code (`AGENTS` in `store.js`). Users assign tasks to them but can't edit them. Each one has a role, an icon and three skills:

| Agent | Role | Skills |
|---|---|---|
| Athena | Research & planning | Web research, Planning, Summaries |
| Hermes | Writing & communication | Copywriting, Editing, Translation |
| Pythagoras | Data & analysis | Data cleaning, Statistics, Reporting |
| Hephaestus | Code & building | Coding, Debugging, Testing |

### Assigning

The Agent menu in the Tasks page form is filled from `store.AGENTS`, so a task is assigned when it is created, and it can be reassigned through Edit. The store never trusts the form: `clean()` checks every field again, and an unknown agent id falls back to the first agent (Athena), as an unknown priority falls back to Medium. New tasks always start as To do.

### The simulation

The "Run agent" button on a task row, and "Run an agent" on the Home page, both call `Taskit.sim.run(taskId)` in `js/agent-sim.js`:

```js
async function run(taskId, ms = RUN_MS) {           // RUN_MS = 4000
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
```

1. Only a To do task can be run, which is why the row's Run button is disabled for any other status.
2. The task moves to In progress, and the log records "started".
3. After 4 seconds the simulation reads the task **again** rather than trusting its old copy.
4. If the task was deleted, or moved to another column in the meantime, the run is abandoned quietly. The simulation never brings back a deleted task or overrides a decision the user made.
5. Otherwise the task becomes Completed, and the log records "completed".

There is one known limit: the timer only lives as long as the page. If the user leaves during a run, the task stays In progress, and they can finish it by hand.

### Status changes

All status changes go through `store.setStatus(id, status, logType)`, which rejects unknown statuses and ignores a move to the status the task already has, so nothing is logged twice.

- **Complete** (the check button on a row) calls `setStatus(id, 'done', 'completed')`.
- **The Kanban board** on the Analytics page calls `setStatus(id, column)`, both for drag-and-drop and for the "Move to" menu on each card. These moves are logged as "moved". The board is also the way to move a task back, for example from Completed to To do.

### The activity log

Every change (added, edited, deleted, started, completed, moved) adds one entry to the activity log: `{ id, type, taskName, agentId, at }`. Entries are stored newest first and capped at **50** (`ACTIVITY_CAP`). The Tasks page shows only the newest 8, and the Home page's step log only needs the last few steps of one task. Without the cap, the log would grow forever, inside a `localStorage` quota of a few megabytes, and would be re-saved in full on every change. Fifty entries is far more than any screen shows.

### Storage

| Key | Where | Holds |
|---|---|---|
| `taskit.tasks` | `localStorage` | the task array (JSON) |
| `taskit.activity` | `localStorage` | the activity log (JSON) |
| `taskit.theme` | `localStorage` | `light` or `dark`, once the user has used the toggle |
| `taskit.github.<owner/repo>` | `sessionStorage` | the 5-minute cache of the GitHub feed |

**Seed data.** On a first visit (no saved tasks), the store creates six sample tasks spread across the four agents, the three priorities and the three statuses. Their due dates run from 3 days ago to 7 days ahead, counted from today. The store also adds three matching log entries and saves everything, so every page has something to show.

**When storage is blocked** (some privacy modes throw just for touching `localStorage`) or the saved JSON is corrupt, `load()` catches the error, seeds the same sample data in memory and sets `store.persistent` to `false`. The site keeps working, and `layout.js` shows a dismissible Bootstrap alert at the top of the page: "Taskit can't use your browser's storage right now, so changes won't be kept after you leave this page." If a later save fails (for example, the quota is full), saving stops in the same way instead of throwing on every change.

## Architecture

### Files

| File | Purpose |
|---|---|
| `index.html` | Home: hero, the live "product shot" window, feature panels, agents strip |
| `tasks.html` | Tasks: summary counts, add/edit form, toolbar, task table, Latest activity |
| `analytics.html` | Analytics: counts, two CSS charts, Kanban board |
| `agents.html` | Agents (page of choice): one panel per agent with live workload and skills |
| `about.html` | About: purpose, features, team, testimonial carousel, GitHub activity |
| `contact.html` | Contact: validated form with confirmation modal, office details, map, social links |
| `css/style.css` | the whole look: design tokens, Bootstrap variable mapping, components, motion |
| `js/layout.js` | loaded in `<head>` on every page: theme, header and footer, icons, form helpers, reveal on scroll |
| `js/store.js` | the single source of truth: tasks, activity log, saving, `applyView`, `escapeHtml` |
| `js/agent-sim.js` | the simulated agent run (`Taskit.sim.run`) |
| `js/activity.js` | draws the Latest activity feed; `timeAgo()` relative times |
| `js/tasks.js` | Tasks page behaviour |
| `js/home.js` | Home page window, "Run an agent", feature panels |
| `js/analytics.js` | counts, charts, Kanban drag-and-drop and move menu |
| `js/agents.js` | Agents page panels, progress bars, list groups, tooltips |
| `js/github.js` | About page: latest commits from the GitHub REST API |
| `js/about.js` | About page: pause/play control for the carousel |
| `js/contact.js` | Contact page: validation and confirmation modal |
| `tests/tests.html` | 23 automated tests for the store and the simulation (not linked from the site) |
| `img/` | logo (also the favicon) and the four team avatars, as SVG |
| `docs/` | the design spec and build plan written before coding |

### One-way data flow

No page changes the task data on screen directly. Every action goes to the store, and the store tells the page to redraw:

```
user action (form submit, row button, drag, menu, "Run agent")
        │
        ▼
Taskit.store.addTask / updateTask / deleteTask / setStatus
        │   commit(): add a log entry → save() to localStorage → dispatch "taskit:change"
        ▼
page listener: document.addEventListener('taskit:change', render)
        │
        ▼
render() rebuilds the table, counts, feed, charts, board or agent panels from the store
```

Every mutation ends in the same function:

```js
function commit(type, task) {
  activity.unshift({ id: newId(), type, taskName: task.name, agentId: task.agentId, at: Date.now() });
  activity.length = Math.min(activity.length, ACTIVITY_CAP);
  save();
  document.dispatchEvent(new CustomEvent('taskit:change', { detail: { type, id: task.id } }));
}
```

Because there is one path, the activity log, the saved data and the screen can't drift apart. The simulation needs no special wiring either: it only calls `setStatus`, and every open view updates itself. `getTasks()` and `getTask()` return copies, so no page can change stored data by accident (one of the tests checks this).

### One global, IIFEs and plain scripts

Each file is an immediately invoked function with `'use strict'`. It receives the one shared namespace and adds its part to it:

```js
(function (Taskit) {
  'use strict';
  // private helpers here...
  Taskit.store = { /* public API */ };
})(window.Taskit = window.Taskit || {});
```

As a result, the whole site adds a single global, `window.Taskit`, holding `store`, `sim`, `activity`, `icon`, `layout` and `github`. Everything else stays private to its file. We use ordinary `<script>` tags in a fixed order (Bootstrap, then `store.js`, `agent-sim.js`, `activity.js`, then the page's own script) rather than ES modules, because browsers block `<script type="module">` on `file://` pages, and the site has to open straight from disk.

### Shared layout

`js/layout.js` is the only script in `<head>`. It:

- **injects the header and footer** into the empty `<header id="site-header">` and `<footer id="site-footer">` on every page, so the navigation lives in one array (`PAGES`). The current page's link gets `.active` and `aria-current="page"`. The header also holds a skip link, the theme toggle and an "Open board" button.
- **applies dark mode** before the page is painted (see [Dark mode](#dark-mode)).
- **provides `Taskit.icon(name)`**, which returns an inline Heroicons SVG. Static HTML can't call a function, so the pages write `<span data-icon="arrow-right"></span>`, and `fillStaticIcons()` swaps each one for the SVG once the DOM is ready.
- **provides the form helpers** that both forms (Tasks and Contact) share, as `Taskit.layout`:
  - `validateForm(form)` re-checks required text fields for "spaces only", adds Bootstrap's `.was-validated`, links each invalid field to its message, focuses the first invalid field and returns `true` or `false`.
  - `linkErrors(form, { fieldId: errorId })` is called once per form. From then on, a field gets `aria-invalid="true"` and `aria-describedby` pointing at its message **only while it is invalid after a submit attempt**, and these update as the user types.
  - `clearValidation(form)` removes every trace of a failed submit (the red state, the custom "spaces only" errors and the ARIA links). Both forms call it on reset, and the Tasks form also calls it when an edit starts.

A small detail in `linkErrors`: its `input` listener goes on `document`, not on the form. `layout.js` has already registered its own document listener that re-checks the text, and document listeners run in the order they were added, so the text is always re-checked before the ARIA links are updated.

## Coding decisions: Tasks page

The Tasks page (`tasks.html` and `js/tasks.js`) is where most of the work happens, so most of the decisions are here.

### The composer form and its validation

The add form is styled as one "composer" box, like a chat prompt. The name and description sit at the top, and a row of small pill controls below holds the due date, priority (Medium by default) and agent, with a round send button. All of this is still a normal `<form id="task-form" novalidate>`, and every control has a real `<label>`. Where the design shows no visible label, the label uses `.visually-hidden`.

Validation happens in three layers:

1. **HTML attributes:** `required` on name, description and date, plus `maxlength="80"` and `maxlength="300"`.
2. **Spaces only.** The browser's `required` accepts a name of `"   "`. `layout.js` trims the value and calls `setCustomValidity()` so the field counts as invalid. It runs on submit and again on every keystroke, so the red state clears as soon as the text is fixed.
   ```js
   function checkText(el) {
     const length = el.value.trim().length;
     el.setCustomValidity(length >= Math.max(1, el.minLength) ? '' : 'Please fill in this field.');
   }
   ```
3. **The store.** `clean()` trims again, enforces the length limits, checks the date against `/^\d{4}-\d{2}-\d{2}$/`, and throws if anything is missing. So even a script that skipped the form couldn't save a blank task. Tests cover both the rejection and the fallback values.

The error messages ("Give the task a name.", "Describe what the agent should do.", "Pick a due date.") sit together under the composer rather than under each field. Bootstrap only shows an `.invalid-feedback` placed directly after its field, so `style.css` uses `:has()` to show each message: `.was-validated:has(#task-name:invalid) .error-name { display: block; }`. The composer or pill that holds an invalid field also gets a red border. For screen readers, `linkErrors` gives the invalid field `aria-invalid="true"` and points `aria-describedby` at its message, so a screen reader announces the field as invalid and reads its message.

### Add and edit with one form

There is no separate edit dialog. A hidden `<input id="task-id">` decides the mode:

- `startEdit(id)` copies the task into the fields, changes the heading to "Edit task", sets the send button's label to "Save changes", shows a Cancel button, scrolls the form into view and focuses the name. It also calls `clearValidation()` first, so errors from an earlier failed add don't carry over to the edit.
- On submit, if `task-id` has a value, the form calls `store.updateTask(id, …)`. Otherwise it calls `store.addTask(…)`. Then `resetForm()` puts the form back into add mode and clears the hidden id, because `form.reset()` doesn't empty a hidden input.
- Deleting the task that is being edited also resets the form.

One form means one set of validation rules, one set of labels and less code to keep in step.

### Why the table is redrawn from the store

`render()` rebuilds the whole `<tbody>` from `store.applyView(store.getTasks(), view)` on every change. It also updates the three counts and the caption ("Showing 4 of 6 tasks"). We never patch a single row. Each action would otherwise need its own DOM code (add a row, edit a cell, remove a row, re-sort), and any one of them could leave the table out of step with the data. Redrawing from the store makes that impossible, and for the few dozen tasks a person keeps, it costs nothing noticeable. When the table is empty, a single row says either "No tasks yet. Add your first one above." or, when the filters hide everything, "No tasks match." with a "Clear the filters" button.

### Event delegation for row actions

Since the rows are recreated on every render, listeners attached to them would be lost. Instead there is **one** click listener on `#task-rows`. Each button carries `data-action` and `data-id`:

```js
const actions = {
  run: id => sim.run(id),
  complete: id => store.setStatus(id, 'done', 'completed'),
  edit: id => startEdit(id),
  delete: id => { /* confirm(), reset the form if editing it, store.deleteTask(id) */ },
  clear: () => clearFilters(),
};
$('task-rows').addEventListener('click', e => {
  const button = e.target.closest('button[data-action]');
  if (button) actions[button.dataset.action](button.dataset.id);
});
```

Each row has four icon buttons (Run, Complete, Edit, Delete), and each has an `aria-label` that names the task ("Delete Fix login page bug"). Run is disabled unless the task is To do, and Complete is disabled once it is Completed. Delete asks with `confirm()`, and its icon turns red on hover and on keyboard focus, because red is kept for actions that destroy something.

### `applyView`: search, filter and sort as a pure function

The toolbar has a live search box and four pill menus: Status (All, Pending, Completed), Priority, Agent and Sort (due soonest, due latest, name A to Z). Each control writes one key of a `view` object on every `input` event and calls `render()`. The filtering itself is not in `tasks.js` but in `store.applyView(list, view)`:

```js
function applyView(list, view) {
  const q = (view.search || '').trim().toLowerCase();
  const matches = t =>
    (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) &&
    (view.status === 'pending' ? t.status !== 'done' : view.status === 'completed' ? t.status === 'done' : true) &&
    (!view.priority || view.priority === 'all' || t.priority === view.priority) &&
    (!view.agentId || view.agentId === 'all' || t.agentId === view.agentId);
  const out = list.filter(matches); // a new array, so sorting it can't reorder `list`
  return SORTS[view.sort] ? out.sort(SORTS[view.sort]) : out;
}
```

The function touches no DOM and no storage, so it can be tested with plain arrays. Four tests cover the search (name or description, case and spaces ignored), the status filter (Pending means To do plus In progress), combined priority and agent filters, and the three sorts, including a check that the input array is not reordered. The Home page reuses it to sort tasks by due date.

### Escaping

Task names and descriptions are user input, and they end up inside template-literal HTML. Every store string passes through `store.escapeHtml()`, which replaces `& < > " '` with entities, before it goes into `innerHTML`. That covers names, descriptions, agent names and the ids in `data-id`. Plain numbers and the live-region text are set with `textContent`, which needs no escaping. A test feeds `escapeHtml` an `<img onerror>` payload. The same function protects the activity feed, the Kanban cards, the GitHub commits and the Contact confirmation.

### The N and / shortcuts

Pressing **N** focuses the task name to start a new task, and **/** focuses the search box. Both are hinted in the interface with `<kbd>` key caps. The N hint is hidden below 768px, where there is usually no keyboard, and the "/" cap hides once the search box has focus.

```js
const isTyping = el => el.closest('input, textarea, select, [contenteditable]') !== null;

document.addEventListener('keydown', e => {
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
```

The shortcuts never fire while the user is typing in a field, so you can still write an "n" or a "/" in a task. They also ignore Ctrl, Cmd and Alt combinations, so the browser's own Ctrl+N and Cmd+N keep working.

### The one-off row highlight and the check-draw animation

There are two small animations that confirm an action happened:

- **New row flash.** The `taskit:change` event carries `{ type, id }`. When the type is `added`, `tasks.js` remembers that id for **one** render, and the new row gets `.is-new`. Its cells then fade from the surface colour back to transparent over 1.2 s. The id is cleared straight after, so the next render doesn't flash it again.
- **Self-drawing check.** The Completed icon is an SVG whose tick path has `pathLength="1"`. Animating `stroke-dashoffset` from 1 to 0 makes the tick draw itself. `tasks.js` keeps a `Set` of the ids that were Completed at the last render (`doneBefore`), and only a task that has **just** become Completed gets `.is-new` and the animation. Clearing a filter or reloading the page doesn't replay it.

Both animations only use opacity, colour and stroke offset. In `style.css`, the `@media (prefers-reduced-motion: reduce)` block sets `animation: none` on `.task-row.is-new > td` and `.check-draw.is-new path`. With the animation off, the tick simply appears fully drawn and the row doesn't flash. Nothing is lost except the motion.

### Priority as shape, colour and word

Priority is shown as an 8px dot followed by the word:

| Priority | Shape | Colour token |
|---|---|---|
| High | filled dot | `--tk-prio-high`, a soft coral |
| Medium | filled dot | `--tk-prio-medium`, an amber |
| Low | hollow ring | the muted grey border |

The word always carries the meaning (WCAG 1.4.1: colour is never the only signal), so the dot is `aria-hidden`. The filled-or-hollow shape separates Low from the other two even in greyscale, and the colour lets you scan a long table quickly. The coral is lighter and more orange than the danger red on purpose, because "urgent" is not "destroys something". Each dot colour is at least 3:1 against the backgrounds it sits on, the minimum for graphics, and the contrast ratios are noted beside the tokens in `style.css`. The same three marks are used in the Analytics legend and on the Kanban cards. Status follows the same rule: a hollow circle for To do, a pulsing accent dot for In progress, a check for Completed, always next to the word.

## Coding decisions: Latest Activity

### Where it lives

The Latest activity feed is a section under the task table on the **Tasks page**, which is where the changes happen, so cause and effect are on one screen. The feed is drawn by its own module, `js/activity.js`, which exposes `Taskit.activity.render(listEl, limit)` and `Taskit.activity.timeAgo(ms)`. The module draws nothing by itself, so the page decides when to redraw. The Tasks page asks for the newest 8 entries. `timeAgo` is reused by the Home page (its "Agent run" step log) and by the About page (the commit times).

Each entry type maps to an icon and a sentence:

```js
const ACTIVITY = {
  added:     ['plus',  (agent, task) => `New task for ${agent}: ${task}`],
  deleted:   ['trash', (agent, task) => `${task} was removed`],
  started:   ['play',  (agent, task) => `${agent} started working on ${task}`],
  completed: ['check', (agent, task) => `${agent} completed ${task}`],
  // edited, moved ...
};
```

### Entries store the task name

A log entry stores `taskName` and `agentId`, not just the task id. If an entry only held the id, it would have nothing to show once the task was deleted, which is exactly the moment the log matters ("“Fix login page bug” was removed"). Copying the name in at the moment of the change keeps every entry readable forever, and an unknown agent id reads as "An agent". Both the name and the agent name are escaped before they go into the HTML.

### The 50-entry cap

`commit()` adds the newest entry at the front and then truncates the array to 50 with `activity.length = Math.min(activity.length, ACTIVITY_CAP)`. The feed shows 8, so the cap only costs history that no screen shows, and it keeps the saved JSON small. A test adds 60 tasks and checks that exactly the 50 newest remain, newest first.

### `Intl.RelativeTimeFormat`

Times read "just now", "5 minutes ago", "2 hours ago" or "yesterday". These come from the browser's built-in `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`, which writes "yesterday" instead of "1 day ago". `timeAgo` picks the largest unit that fits (day, hour, minute), and anything under a minute is "just now". No date library is needed.

### The 60-second refresh

Relative times go stale ("just now" is wrong five minutes later), so `tasks.js` redraws the feed every 60 seconds with `setInterval(() => renderActivity(false), 60000)`. The Home page does the same for its window.

### One live status line, not a live list

Screen reader users need to hear about changes too. The obvious choice, `aria-live` on the list, would be wrong here. The list is rebuilt with `innerHTML` on every change, so a live list would read out all 8 entries each time, and the 60-second refresh would announce the whole list every minute with nothing new in it. Instead there is one visually hidden line:

```html
<p id="activity-status" class="visually-hidden" aria-live="polite"></p>
```

```js
function renderActivity(announce) {
  const newest = Taskit.activity.render($('activity-list'), 8);
  if (announce) $('activity-status').textContent = newest ? 'Latest: ' + newest : '';
}
```

`render()` returns the newest entry as plain text. A real store change calls `renderActivity(true)`, so the user hears one short sentence, such as "Latest: Athena completed “Research competitor pricing”". The timed refresh calls `renderActivity(false)` and stays silent.

## Coding decisions: Agents page (page of choice)

The Agents page (`agents.html` and `js/agents.js`) introduces the four agents. Each agent gets a panel with its icon, role, a Working or Idle state, a progress bar of its workload, its skills, and a link to assign it a task. The page uses three Bootstrap components that appear nowhere else on the site, and each one is restyled only through Bootstrap's own CSS variables, never by overriding its internal rules.

### 1. Progress bars

Each panel shows "2 of 3 completed · 67%" in mono above a Bootstrap `.progress` bar. In `style.css`, `.agent-progress` sets `--bs-progress-height: 4px`, `--bs-progress-bg` to the hairline colour and `--bs-progress-bar-bg` to the text colour, so it matches the thin bars on the Analytics page instead of Bootstrap's thick blue default.

**ARIA:** the `role="progressbar"` sits on the outer `.progress` element, as Bootstrap 5.3 recommends, with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` and an `aria-label` such as "Athena: tasks completed". It also has an `aria-valuetext`, because a bare "67%" says nothing about what was counted. A screen reader hears "2 of 3 tasks completed" instead, or "No tasks assigned yet" for an agent with no tasks.

### 2. List group

The skills are a Bootstrap `.list-group.list-group-flush`. The `.skill-list` class sets `--bs-list-group-bg: transparent`, `--bs-list-group-border-color` to the hairline token and tighter item padding, so it looks like the hairline-separated rows used across the site.

### 3. Tooltips

Each skill row ends with a small info button, and its tooltip explains the skill ("Finds, reads and cites reliable sources"). The trigger is a real `<button>` with an `aria-label` ("What Web research covers"), so the tooltip can be reached with Tab: Bootstrap shows tooltips on focus as well as on hover, and links the tip text with `aria-describedby`. `.tooltip` sets `--bs-tooltip-bg` to the text colour and `--bs-tooltip-color` to the page colour, so the tooltip flips with the theme, at full opacity and with no arrow.

### Live stats from the store

Nothing on the page is hard-coded. `statsFor(agentId, tasks)` counts the agent's tasks, its Completed tasks and the whole percentage, and checks whether any of its tasks is In progress, which decides Working (a pulsing dot plus the word) or Idle (the muted word). The page subscribes to `taskit:change` like every other view, so it always shows what the store holds. The page itself has no controls that change tasks, so the numbers are usually computed when the page loads. A run started on another page shows up the next time the Agents page is opened.

### The tooltip lifecycle

Bootstrap tooltips are opt-in: they must be created in JavaScript. They also attach a floating element to `<body>`. Because `render()` replaces the panels' HTML, an old tooltip could otherwise be left floating with no trigger. Each render therefore runs in three steps:

```js
function render() {
  // Dispose old tooltips before their elements are replaced, so none are left floating.
  grid.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    const tip = bootstrap.Tooltip.getInstance(el);
    if (tip) tip.dispose();
  });
  grid.innerHTML = store.AGENTS.map(agent => panelHtml(agent, statsFor(agent.id, tasks))).join('');
  grid.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
}
```

The page also adds what Bootstrap leaves out: pressing **Escape** hides any open tooltip without moving the mouse or the focus, as WCAG 1.4.13 (Content on Hover or Focus) requires.

## Other notable decisions

### The design system

The visual direction was inspired by modern developer-tool websites: hairline borders instead of shadows, near-monochrome surfaces, tight left-aligned headings and a single restrained accent. We took the principles, not anyone's branding. Everything lives in `css/style.css`, in three layers:

1. **Tokens.** A short list of `--tk-*` custom properties holds every colour, radius and easing curve. The colours are defined twice: once for light (`:root, [data-bs-theme="light"]`) and once for dark (`[data-bs-theme="dark"]`). Colours are written in **OKLCH** (lightness, chroma, hue), which makes "the same colour, lighter" a change to one number. The accent is turquoise `oklch(43% 0.076 215)` (#005A6A) in light mode and a lighter, calmer `oklch(78% 0.075 215)` in dark mode. The neutrals carry a trace of the same hue 215, so the greys feel related, and there is no pure black or white.
2. **The Bootstrap mapping.** A single block, written once for both themes, points Bootstrap's own variables at the tokens: `--bs-body-bg: var(--tk-bg)`, `--bs-primary: var(--tk-accent)`, `--bs-border-color: var(--tk-border)`, the fonts, the radii, and so on. Because the tokens change with the theme, so does all of Bootstrap.
3. **Components.** Bootstrap components are restyled through their component variables (`--bs-btn-*`, `--bs-table-*`, `--bs-progress-*`, `--bs-list-group-*`, `--bs-tooltip-*`, `--bs-modal-*`), and a few small classes add patterns Bootstrap doesn't have: `.panel`, `.stage`, the fake app `.window`, `.row-list` and `.pill`.

Bootstrap still provides the grid, the utilities and the JavaScript components. The look comes from changing its variables, not from fighting its classes. The accent is kept for things you can act on (links, the primary button, focus rings) and for the "working" dot, and red only for destructive actions.

### Dark mode

`layout.js` is loaded in `<head>`, before any content, and its first action is `applyTheme(savedTheme())`. This sets `data-bs-theme` on `<html>` while the page is still being parsed, so a dark-mode visitor never sees a white flash. The saved choice (`taskit.theme`) wins. Without one, the site follows the operating system through `matchMedia('(prefers-color-scheme: dark)')`. The toggle in the header is a real button with `aria-pressed`, and its icon shows what a click will switch to (a sun in dark mode, a moon in light mode). If storage is blocked, the toggle still switches the theme, but the choice isn't remembered.

### Heroicons, inlined

All 28 icons are Heroicons v2.1.5 (24px outline). Each icon's path data is copied into the `ICONS` object in `layout.js` and drawn by `Taskit.icon(name)` as inline SVG with `stroke="currentColor"`, so it takes the colour and size (`1em`) of the text around it. The icons are not loaded from an icon font or an external sprite (`<svg><use href="icons.svg#x">`), because Chrome blocks external SVG references on `file://` pages, and the site must work when opened from disk. Every icon is `aria-hidden="true"`, because each one sits next to text or inside a button with its own `aria-label`.

### Analytics: CSS-only charts

The Analytics page draws its charts without a chart library:

- **Completed vs pending** has one row per bar: a label, a 6px track whose fill `<span>` gets an inline `width: N%`, then the count and the percentage.
- **By priority** is one **segmented bar** rather than a pie chart. Each segment is a `<span>` whose `flex-grow` is its count, so flexbox shares the width in proportion without any arithmetic. Segments are drawn only for priorities that have tasks. We chose a bar over a pie because lengths along one line are easier to compare than angles, it matches the thin-bar style of the rest of the site, and a legend underneath gives each priority's mark, word, count and percentage.

Both charts are `role="img"` with an `aria-label` that carries the actual numbers ("Tasks by priority: High 3 (50%), Medium 2 (33%), Low 1 (17%)"), so the information doesn't depend on seeing the shapes.

### The Kanban board

The board has three columns: To do, In progress and Completed. Cards are `draggable="true"`, and every drag listener (`dragstart`, `dragover`, `dragleave`, `drop`, `dragend`) sits on the board container, so redrawing the cards never loses them. A drop reads the card id from `dataTransfer` and calls `store.setStatus(id, column.dataset.status)`. The column under the pointer gets a dashed accent outline.

HTML drag-and-drop doesn't work with a keyboard, and not on most touch screens either. So every card also holds a small "Move to" `<select>`, with a visually hidden label such as "Move “Draft launch newsletter” to". Changing it calls the same `setStatus`. After the board redraws, focus goes back to the same card's menu, so a keyboard user doesn't lose their place.

### The Home live window: "Run an agent"

The Home page shows a fake app window as its product shot, and it is live: `home.js` fills it from the store. The left pane, "Agent run", shows a task as a prompt with its step log ("Assigned · Athena", "Started · just now", "Working…"). The right pane, "This week", lists up to five tasks with open work first. The **Run an agent** button in the window's title bar runs the simulation on the first To do task in view, so the visitor sees the dot start pulsing and the check draw itself. While the agent is working, the button reads "Working…" and is disabled. When nothing is left to run, it reads "All caught up". The button's state is reset in a `finally` block, so it can't get stuck. A visually hidden `aria-live` line (`#run-status`) announces "Athena started …" and "Athena completed …". The window doesn't announce its own redraws.

### About: the carousel and its pause control

The testimonials use Bootstrap's carousel, changing slides every 6 seconds. Content that moves automatically for more than 5 seconds needs a way to stop it (WCAG 2.2.2 Pause, Stop, Hide), so `js/about.js` takes over control, following the WAI-ARIA carousel example:

- It creates the carousel itself with `{ ride: false, pause: false }`, which switches off Bootstrap's own auto-start and hover handling, so this file is the one place that decides when the carousel moves.
- A pause/play button changes its icon and its `aria-label` ("Pause testimonials" or "Play testimonials").
- Keyboard focus arriving on any carousel control pauses it until the user presses play. The check uses `:focus-visible`, so a mouse click on play doesn't immediately pause it again.
- Hovering holds it still only while the pointer stays over it.
- With `prefers-reduced-motion: reduce`, it starts paused.

### API integration: GitHub repository activity

The "Built in the open" section on the About page shows the latest commits of the project's repository, loaded by `js/github.js` from the GitHub REST API:

- **Endpoint:** `GET https://api.github.com/repos/{REPO}/commits?per_page=5`, with `Accept: application/vnd.github+json`. Public repositories need no key. Each row shows the first line of the commit message, the short SHA in mono, the author and a relative time from `timeAgo`.
- **Cache:** a successful answer is saved in `sessionStorage` under `taskit.github.<repo>` with a timestamp and reused for **5 minutes**. Without a key, GitHub allows only 60 requests per hour per IP address, and a visitor clicking between pages would use that up quickly. The **Refresh** button skips the cache. If storage is blocked or the saved text is broken, the cache is treated as empty.
- **Loading and error states:** while loading, a single row with a spinner and `role="status"` says "Loading commits…". Errors map to plain messages: 404 means "This repository isn't public yet.", 403 and 429 mean the hourly limit was reached, a failed `fetch` means "Couldn't reach GitHub", and anything else (5xx, broken JSON, a response that isn't a list) gets a generic message. The Refresh button is disabled during a load, and if it had keyboard focus, the focus goes back to it afterwards.
- **Safety:** data from someone else's API is treated as untrusted. Every value is escaped with `escapeHtml`, the response must be an array, and a row only becomes a link if `html_url` starts with `https://github.com/` (an allow-list), so a crafted `javascript:` URL can't get through. Links open in a new tab with `rel="noopener"`, and a visually hidden "(opens in a new tab)" tells screen reader users.

### Contact: validation, the confirmation modal and the map

- **Validation** uses the shared `Taskit.layout` helpers, exactly as on the Tasks page:
  - name, `required minlength="2"`;
  - email, `type="email"` plus `pattern="[^@\s]+@[^@\s]+\.[^@\s]+"`, because `type="email"` alone accepts `a@b`;
  - subject, required;
  - message, `required minlength="10"`.

  Spaces-only input is caught the same way as on the Tasks page. Each field has its own message below it. Only invalid fields turn red. In `style.css`, Bootstrap's green "valid" border is reset through `--bs-form-valid-border-color`, and its tick and "!" pictures inside the fields are removed.
- **Confirmation modal.** Nothing is sent anywhere, since there is no server. On a valid submit, a Bootstrap modal lists what was typed. The values are escaped and shown with `white-space: pre-wrap`, so line breaks survive. The form is then reset. When the modal closes (Done, ×, Esc or a click outside), focus returns to the Send button.
- **The map** is a Google Maps embed (`maps?q=Athens,Greece&output=embed`) in an `<iframe>` with a `title`, `loading="lazy"` and Bootstrap's `.ratio-4x3`, which changes to 16:9 between 576px and 991px, where a full-width 4:3 map would be too tall. In dark mode the iframe gets a CSS `invert()` and `hue-rotate()` filter, so it isn't a bright white rectangle on a dark page.

### Accessibility checklist

- **Skip link:** the first focusable element on every page is "Skip to main content", targeting `#main`.
- **Landmarks:** `<header>`, `<nav aria-label="Main navigation">`, `<main id="main">` and `<footer>` on every page. Sections are labelled by their headings with `aria-labelledby`, and the toolbar has `role="search"`.
- **Labels:** every input and select has a `<label>`, visually hidden where the design shows none. Icon-only buttons have an `aria-label` that names their target ("Edit Fix login page bug").
- **Focus:** Bootstrap's blurred glow is replaced by a crisp 2px accent outline on `:focus-visible`. Pill controls show the ring around the whole pill (`.pill:has(:focus-visible)`).
- **Contrast:** the token pairs in both themes were chosen to meet WCAG AA for text and 3:1 for graphics and controls.
- **Reduced motion:** the last block of `style.css` turns off every transition and animation under `prefers-reduced-motion: reduce`. `layout.js` doesn't enable reveal on scroll at all, and the carousel starts paused.
- **Colour is never the only signal:** status is an icon plus a word, priority is a shape plus a word, the active nav link is also heavier, and the current carousel indicator is also longer.
- **Live regions:** one polite line each for the activity feed and the Home run, and `role="status"` for the GitHub loading state, rather than whole regions re-read on every redraw.

## Testing

### Automated

`tests/tests.html` is a self-contained test page with a small runner of its own: no framework and no build. It loads only `store.js` and `agent-sim.js`, and runs every test against a **fake in-memory storage** passed in with `store._useStorage()`, so a visitor's real tasks are never touched. Each test is listed as PASS or FAIL with its error message, and the tab title shows the total. **Current result: `PASS 23/23`.**

| Group | Tests | What is checked |
|---|---|---|
| Store: CRUD and activity | 11 | add trims fields and starts as To do; whitespace-only names or descriptions and bad dates are rejected; unknown priority and agent fall back to Medium and Athena; update keeps the status; delete logs the task's name; `setStatus` logs the given type, ignores no-op moves and rejects unknown statuses; the log keeps only the 50 newest entries; `counts()`; `getTasks()` returns copies; data survives a reload; every mutation fires `taskit:change` |
| Store: storage edge cases | 3 | a first visit seeds 6 tasks plus activity and saves them; corrupt JSON falls back to seed data in memory; blocked storage falls back and keeps working |
| `applyView` | 4 | search over name and description ignoring case and spaces; Pending = To do + In progress; priority and agent filters together; all three sorts, without reordering the input |
| `escapeHtml` | 1 | an `<img onerror>` payload is neutralised |
| Agent simulation | 4 | `sim.run` goes To do → In progress → Completed and logs both steps; it abandons if the task is deleted mid-run; it abandons if the user moves the task mid-run; it refuses tasks that aren't To do |

The simulation tests pass a 20 ms duration instead of 4 seconds, so the whole page finishes almost instantly.

### Manual

The manual checklist, run on every page before submitting:

- **Widths:** 375px (phone), 768px (tablet), 1024px and 1440px (desktop). No sideways scrolling, the navigation collapses on phones, and the task table, composer and board stay usable.
- **Themes:** light and dark, both through the toggle and through the operating system setting, including after a reload.
- **Keyboard only:** skip link, every control reachable with Tab, visible focus everywhere, N and / on the Tasks page, the Kanban "Move to" menu, Agents tooltips on focus and Escape, the carousel pause control, and the Contact modal returning focus.
- **`file://`:** opening `index.html` straight from disk, with icons, header, footer, saving and the GitHub feed all working.
- **Storage blocked:** with site data blocked, the warning appears and the site still works with sample data.
- **Reduced motion:** with the system setting on, nothing animates and the carousel starts paused.

## Lighthouse audit (to be completed by the student)

> **To do:** run the audit and fill in this section yourself.

How to run it: open each page in Chrome, open DevTools (F12), go to the **Lighthouse** tab, select the Performance, Accessibility, Best Practices and SEO categories, and click **Analyze page load**. Do this once in **Mobile** mode and once in **Desktop** mode for every page.

| Page | Mode | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| Home (`index.html`) | Mobile | | | | |
| Home (`index.html`) | Desktop | | | | |
| Tasks (`tasks.html`) | Mobile | | | | |
| Tasks (`tasks.html`) | Desktop | | | | |
| Analytics (`analytics.html`) | Mobile | | | | |
| Analytics (`analytics.html`) | Desktop | | | | |
| Agents (`agents.html`) | Mobile | | | | |
| Agents (`agents.html`) | Desktop | | | | |
| About (`about.html`) | Mobile | | | | |
| About (`about.html`) | Desktop | | | | |
| Contact (`contact.html`) | Mobile | | | | |
| Contact (`contact.html`) | Desktop | | | | |

Screenshots: save one per page as `docs/lighthouse/<page>.png` (for example `docs/lighthouse/tasks.png`) and link them here.

_Reflect on the scores and what you changed because of them._

## Personal reflections (to be written by the student)

> **To do:** answer these in your own words.

- What was the hardest part of the project, and how did you get past it?
- If you started again, what would you do differently?
- What did you learn about Bootstrap, especially about customising it through its CSS variables instead of overriding its classes?
- What did you learn about JavaScript, for example about keeping one source of truth and redrawing from it?

## Credits

- [Bootstrap 5.3.3](https://getbootstrap.com/) (MIT licence), loaded from the jsDelivr CDN with Subresource Integrity hashes.
- [Geist and Geist Mono](https://fonts.google.com/specimen/Geist) fonts (SIL Open Font License), loaded from Google Fonts with one `<link>`.
- [Heroicons v2.1.5](https://heroicons.com/) (MIT licence), path data copied into `js/layout.js`.
- [GitHub REST API](https://docs.github.com/en/rest) for the commit feed on the About page.
- Google Maps embed for the office map on the Contact page.
- The agents are named after figures from Ancient Greece: Athena, Hermes, Pythagoras and Hephaestus.
