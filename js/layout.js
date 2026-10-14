/*
 * layout.js — shared page chrome for every Taskit page.
 * Loaded in <head> so the saved colour theme is applied before the first paint
 * (no white flash in dark mode). On DOMContentLoaded it injects the one header and
 * footer every page shares, so nav links live in exactly one place.
 * Also hosts the validation helper used by every form on the site.
 */
(function (Taskit) {
  'use strict';

  const THEME_KEY = 'taskit.theme';
  const PAGES = [
    ['index.html', 'Home'], ['tasks.html', 'Tasks'], ['analytics.html', 'Analytics'],
    ['agents.html', 'Agents'], ['about.html', 'About'], ['contact.html', 'Contact'],
  ];
  const SOCIALS = [
    ['GitHub', 'bi-github', 'https://github.com'],
    ['LinkedIn', 'bi-linkedin', 'https://www.linkedin.com'],
    ['X', 'bi-twitter-x', 'https://x.com'],
    ['Instagram', 'bi-instagram', 'https://www.instagram.com'],
  ];
  // Text fields we re-check ourselves, because the browser's `required` accepts "   ".
  const TEXT_FIELDS = 'textarea[required], input[required][type="text"]';

  /* ---------- dark mode ---------- */

  function savedTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === 'light' || t === 'dark') return t;
    } catch (err) { /* storage blocked: fall back to the OS preference */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Bootstrap 5.3 switches every component's colours from this one attribute.
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const dark = theme === 'dark';
      btn.setAttribute('aria-pressed', String(dark));
      btn.querySelector('i').className = dark ? 'bi bi-sun' : 'bi bi-moon-stars';
    }
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* not remembered, but still switches */ }
    applyTheme(next);
  }

  applyTheme(savedTheme()); // runs immediately, while <head> is still being parsed

  /* ---------- header & footer ---------- */

  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function socialLinksHtml(sizeClass = 'fs-5') {
    return SOCIALS.map(([label, icon, url]) =>
      `<a class="link-secondary ${sizeClass} me-3" href="${url}" target="_blank" rel="noopener" aria-label="Taskit on ${label}"><i class="bi ${icon}" aria-hidden="true"></i></a>`
    ).join('');
  }

  function headerHtml() {
    const here = currentPage();
    const pageLabel = (PAGES.find(([href]) => href === here) || PAGES[0])[1];
    const links = PAGES.map(([href, label]) => {
      const active = href === here;
      return `<li class="nav-item"><a class="nav-link${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a></li>`;
    }).join('');
    return `
      <a class="visually-hidden-focusable position-absolute p-2 bg-body" href="#main">Skip to main content</a>
      <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom" aria-label="Main navigation">
        <div class="container">
          <a class="navbar-brand d-flex align-items-center gap-2 fw-bold" href="index.html">
            <img src="img/logo.svg" alt="" width="32" height="32">
            Taskit <span class="fw-normal text-body-secondary d-none d-sm-inline">· ${pageLabel}</span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#main-nav"
                  aria-controls="main-nav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="main-nav">
            <ul class="navbar-nav ms-auto mb-2 mb-lg-0">${links}</ul>
            <button id="theme-toggle" class="btn btn-outline-secondary ms-lg-3 mb-2 mb-lg-0" type="button"
                    aria-label="Toggle dark mode" aria-pressed="false">
              <i class="bi bi-moon-stars" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </nav>`;
  }

  function footerHtml() {
    return `
      <div class="container py-4">
        <div class="row gy-3 align-items-center">
          <div class="col-md-4">
            <a href="index.html" class="d-inline-flex align-items-center gap-2 fw-bold text-body text-decoration-none">
              <img src="img/logo.svg" alt="" width="28" height="28"> Taskit
            </a>
            <p class="small text-body-secondary mb-0 mt-2">A demo project. The AI agents are simulated.</p>
          </div>
          <div class="col-md-4 small">
            <a href="mailto:hello@taskit.example">hello@taskit.example</a><br>
            Athens, Greece
          </div>
          <div class="col-md-4 text-md-end">${socialLinksHtml()}</div>
        </div>
        <p class="small text-body-secondary text-center mt-4 mb-0">&copy; ${new Date().getFullYear()} Taskit. All rights reserved.</p>
      </div>`;
  }

  function showStorageWarning() {
    const main = document.getElementById('main');
    if (!main) return;
    main.insertAdjacentHTML('afterbegin', `
      <div class="container mt-3">
        <div class="alert alert-warning alert-dismissible mb-0" role="alert">
          Taskit can't use your browser's storage right now, so changes won't be kept after you leave this page.
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      </div>`);
  }

  /* ---------- forms ---------- */

  function checkText(el) {
    const length = el.value.trim().length;
    el.setCustomValidity(length >= Math.max(1, el.minLength) ? '' : 'Please fill in this field.');
  }

  // Shared by every form: browser validation + Bootstrap's red/green styling.
  function validateForm(form) {
    form.querySelectorAll(TEXT_FIELDS).forEach(checkText);
    form.classList.add('was-validated');
    const firstInvalid = form.querySelector(':invalid');
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  // Re-check text fields as the user types so the red/green state updates live.
  document.addEventListener('input', e => {
    if (e.target.matches && e.target.matches(TEXT_FIELDS)) checkText(e.target);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    if (header) {
      header.className = 'sticky-top';
      header.innerHTML = headerHtml();
    }
    if (footer) {
      footer.className = 'border-top bg-body-tertiary mt-5';
      footer.innerHTML = footerHtml();
    }
    applyTheme(document.documentElement.getAttribute('data-bs-theme')); // sync the new button's icon
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    if (Taskit.store && !Taskit.store.persistent) showStorageWarning();
  });

  Taskit.layout = { validateForm, socialLinksHtml };
})(window.Taskit = window.Taskit || {});
