/*
 * layout.js — shared page chrome for every Taskit page.
 * Loaded in <head> so the saved colour theme is applied before the first paint
 * (no white flash in dark mode). On DOMContentLoaded it injects the one header and
 * footer every page shares, so nav links live in exactly one place.
 * Also hosts the validation helper used by every form on the site, and the small
 * observer that fades sections in as they scroll into view (.reveal).
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
  // The Taskit mark: a rounded square with a tick. currentColor makes it follow the text
  // colour, so it switches with the theme. (img/logo.svg is still the favicon.)
  const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="1.75" y="1.75" width="16.5" height="16.5" rx="5"/><path d="M6.5 10.25l2.5 2.5 4.5-5"/></svg>`;
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

  /* ---------- reveal on scroll ---------- */

  // Only switch reveals on when the browser can observe scrolling and the user hasn't
  // asked for less motion. Without this class the CSS never hides anything.
  const canReveal = 'IntersectionObserver' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canReveal) document.documentElement.classList.add('js-reveal');

  // The first report for each .reveal says whether it starts on screen. Sections that
  // start below the screen are tucked away ("is-waiting") and fade up when scrolled to.
  // Sections already on screen are never hidden, so nothing can get stuck invisible.
  function initReveal() {
    if (!canReveal) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-waiting');
          observer.unobserve(entry.target); // reveal once, then stop watching
        } else {
          entry.target.classList.add('is-waiting');
        }
      });
    });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

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
    const links = PAGES.map(([href, label]) => {
      const active = href === here;
      return `<li class="nav-item"><a class="nav-link${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a></li>`;
    }).join('');
    return `
      <a class="visually-hidden-focusable position-absolute z-3 p-2 bg-body" href="#main">Skip to main content</a>
      <nav class="navbar navbar-expand-lg" aria-label="Main navigation">
        <div class="container">
          <a class="navbar-brand d-flex align-items-center gap-2" href="index.html">${LOGO_SVG} Taskit</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#main-nav"
                  aria-controls="main-nav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="main-nav">
            <ul class="navbar-nav me-auto ms-lg-3 mb-2 mb-lg-0">${links}</ul>
            <div class="d-flex align-items-center gap-2 mb-2 mb-lg-0">
              <button id="theme-toggle" type="button" aria-label="Toggle dark mode" aria-pressed="false"
                      class="theme-toggle btn btn-sm d-inline-flex align-items-center justify-content-center p-0">
                <i class="bi bi-moon-stars" aria-hidden="true"></i>
              </button>
              <a class="btn btn-pill btn-sm d-none d-lg-inline-flex" href="tasks.html">Open board</a>
            </div>
          </div>
        </div>
      </nav>`;
  }

  // One footer column: a small label, then a plain list of links to existing pages.
  function footerColumn(title, hrefs) {
    const links = hrefs.map(href => {
      const [, label] = PAGES.find(([h]) => h === href);
      return `<li><a href="${href}">${label}</a></li>`;
    }).join('');
    return `<h2 class="label mb-3">${title}</h2><ul class="footer-links">${links}</ul>`;
  }

  function footerHtml() {
    return `
      <div class="container py-5">
        <div class="row gy-4">
          <div class="col-12 col-lg-4">
            <a href="index.html" class="footer-brand d-inline-flex align-items-center gap-2">${LOGO_SVG} Taskit</a>
            <p class="mb-0 mt-2">A demo project. The AI agents are simulated.</p>
          </div>
          <div class="col-6 col-lg-2">${footerColumn('Product', ['tasks.html', 'analytics.html', 'agents.html'])}</div>
          <div class="col-6 col-lg-2">${footerColumn('Company', ['about.html', 'contact.html'])}</div>
          <div class="col-12 col-lg-4">
            <h2 class="label mb-3">Contact</h2>
            <p class="mb-2"><a href="mailto:hello@taskit.example">hello@taskit.example</a><br>Athens, Greece</p>
            <div>${socialLinksHtml('fs-6')}</div>
          </div>
        </div>
        <p class="mt-5 mb-0">&copy; ${new Date().getFullYear()} Taskit. All rights reserved.</p>
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
      header.className = 'site-header sticky-top';
      header.innerHTML = headerHtml();
    }
    if (footer) {
      footer.className = 'site-footer mt-5';
      footer.innerHTML = footerHtml();
    }
    applyTheme(document.documentElement.getAttribute('data-bs-theme')); // sync the new button's icon
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    if (Taskit.store && !Taskit.store.persistent) showStorageWarning();
    initReveal();
  });

  Taskit.layout = { validateForm, socialLinksHtml };
})(window.Taskit = window.Taskit || {});
