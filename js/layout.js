/*
 * layout.js — shared page chrome for every Taskit page.
 * Loaded in <head> so the saved colour theme is applied before the first paint
 * (no white flash in dark mode). On DOMContentLoaded it injects the one header and
 * footer every page shares, so nav links live in exactly one place.
 * Also hosts the icon helper (Taskit.icon), the validation helper used by every form on
 * the site, and the small observer that fades sections in as they scroll into view (.reveal).
 */
(function (Taskit) {
  'use strict';

  const THEME_KEY = 'taskit.theme';
  const PAGES = [
    ['index.html', 'Home'], ['tasks.html', 'Tasks'], ['analytics.html', 'Analytics'],
    ['agents.html', 'Agents'], ['about.html', 'About'], ['contact.html', 'Contact'],
  ];
  const SOCIALS = [
    ['GitHub', 'https://github.com'],
    ['LinkedIn', 'https://www.linkedin.com'],
    ['X', 'https://x.com'],
    ['Instagram', 'https://www.instagram.com'],
  ];

  /* ---------- icons ---------- */

  // Heroicons v2.1.5 (24/outline), MIT licence, https://heroicons.com
  // Each value is the `d` attribute of the icon's single <path>, copied verbatim from
  // https://cdn.jsdelivr.net/npm/heroicons@2.1.5/24/outline/<name>.svg
  // They live here as text (not in an external sprite file) because Chrome blocks
  // <svg><use href="file.svg#x"> on file:// pages, and this site must work from disk.
  const ICONS = {
    'arrow-path': 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
    'arrow-right': 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
    'arrow-up-right': 'm4.5 19.5 15-15m0 0H8.25m11.25 0v11.25',
    'arrow-up': 'M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18',
    'arrows-right-left': 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    'bars-3': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
    'calculator': 'M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z',
    'calendar-days': 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z',
    'check-circle': 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    'check': 'm4.5 12.75 6 6 9-13.5',
    'chevron-down': 'm19.5 8.25-7.5 7.5-7.5-7.5',
    'chevron-left': 'M15.75 19.5 8.25 12l7.5-7.5',
    'chevron-right': 'm8.25 4.5 7.5 7.5-7.5 7.5',
    'envelope': 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
    'information-circle': 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
    'light-bulb': 'M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    'magnifying-glass': 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
    'moon': 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
    'pencil-square': 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
    'pencil': 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125',
    'play': 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z',
    'plus': 'M12 4.5v15m7.5-7.5h-15',
    'sun': 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
    'trash': 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
    'wrench-screwdriver': 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z',
  };

  // Returns the SVG markup for one icon. It inherits the text colour (currentColor) and
  // size (1em, set by .icon in style.css), and is hidden from screen readers because
  // every icon here sits next to text or inside a button that has its own aria-label.
  function icon(name, extraClass = '') {
    const d = ICONS[name];
    if (!d) {
      console.warn('Unknown icon: ' + name);
      return '';
    }
    return `<svg class="icon${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  }

  // Page HTML can't call icon(), so it writes <span data-icon="arrow-right"></span> and
  // this swaps each one for the real SVG, keeping any classes the span had.
  function fillStaticIcons() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }
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
      btn.innerHTML = icon(dark ? 'sun' : 'moon'); // the icon shows what a click switches to
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

  // Text links ("GitHub ↗" drawn as an SVG arrow). Heroicons has no brand logos, so the
  // name is the link. The caller wraps them in a flex row; the Contact page reuses this too.
  function socialLinksHtml() {
    return SOCIALS.map(([label, url]) =>
      `<a class="social-link" href="${url}" target="_blank" rel="noopener" aria-label="Taskit on ${label} (opens in a new tab)">${label}${icon('arrow-up-right')}</a>`
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
            ${icon('bars-3')}
          </button>
          <div class="collapse navbar-collapse" id="main-nav">
            <ul class="navbar-nav me-auto ms-lg-3 mb-2 mb-lg-0">${links}</ul>
            <div class="d-flex align-items-center gap-2 mb-2 mb-lg-0">
              <button id="theme-toggle" type="button" aria-label="Toggle dark mode" aria-pressed="false"
                      class="theme-toggle btn btn-sm d-inline-flex align-items-center justify-content-center p-0">
                ${icon('moon')}
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
            <div class="d-flex flex-wrap gap-3">${socialLinksHtml()}</div>
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
    fillStaticIcons(); // after the header/footer are in, so it also covers anything they hold
    if (Taskit.store && !Taskit.store.persistent) showStorageWarning();
    initReveal();
  });

  Taskit.icon = icon;
  Taskit.layout = { validateForm, socialLinksHtml };
})(window.Taskit = window.Taskit || {});
