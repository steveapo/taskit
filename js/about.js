/*
 * about.js — the pause / play control for the testimonials carousel on the About page.
 * Moving content that lasts more than 5 seconds needs a way to stop it (WCAG 2.2.2), so,
 * following the WAI-ARIA carousel example:
 *   - the button pauses and restarts the automatic slides;
 *   - keyboard focus arriving on any of the carousel's controls pauses it, until the
 *     user presses play;
 *   - the pointer resting over the carousel holds it still only while it stays there;
 *   - if the user asked their system for reduced motion, it starts paused.
 */
(function (Taskit) {
  'use strict';

  const el = document.getElementById('testimonials');
  const toggle = document.getElementById('carousel-toggle');

  // Created here, before Bootstrap's own start-up (which waits for the page "load" event and
  // then reuses this instance). ride: false and pause: false switch off Bootstrap's own
  // auto-start and hover pausing, so this file is the one place that decides when it moves.
  // The 6-second interval still comes from data-bs-interval in the HTML.
  const carousel = bootstrap.Carousel.getOrCreateInstance(el, { ride: false, pause: false });

  let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hovered = false;

  // Starts or stops the slides to match the state.
  function move() {
    if (playing && !hovered) carousel.cycle();
    else carousel.pause();
  }

  // Sets the state, then makes the button show what a click will do: the pause icon while
  // playing, the play icon while paused. Its label changes with it (like the rotation
  // button in the WAI-ARIA carousel example).
  function setPlaying(value) {
    playing = value;
    toggle.setAttribute('aria-label', playing ? 'Pause testimonials' : 'Play testimonials');
    toggle.innerHTML = Taskit.icon(playing ? 'pause' : 'play');
    move();
  }

  toggle.addEventListener('click', () => setPlaying(!playing));
  el.addEventListener('mouseenter', () => { hovered = true; move(); });
  el.addEventListener('mouseleave', () => { hovered = false; move(); });
  // focusin bubbles up from the buttons inside (focus doesn't). :focus-visible is true for
  // keyboard focus but not for a mouse click, so clicking play doesn't pause it again.
  el.addEventListener('focusin', e => {
    if (playing && e.target.matches(':focus-visible')) setPlaying(false);
  });

  setPlaying(playing);
})(window.Taskit);
