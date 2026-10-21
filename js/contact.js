/*
 * contact.js — the Contact page.
 * Checks the form with the shared Taskit.layout.validateForm(), then shows what was typed
 * in a Bootstrap modal. Nothing is sent anywhere: this is a front-end-only demo, so the
 * message only exists on this page, and the form is cleared once it has been shown.
 */
(function (Taskit) {
  'use strict';

  const { layout, store } = Taskit;
  const $ = id => document.getElementById(id);
  const form = $('contact-form');
  const modalEl = $('confirm-modal');

  // The four fields: the input's id, the word shown for it in the pop-up, and the id of
  // the error message under it.
  const FIELDS = [
    { id: 'contact-name', label: 'Name', error: 'name-error' },
    { id: 'contact-email', label: 'Email', error: 'email-error' },
    { id: 'contact-subject', label: 'Subject', error: 'subject-error' },
    { id: 'contact-message', label: 'Message', error: 'message-error' },
  ];

  // layout.js links each field to its error message (aria-invalid + aria-describedby) only
  // while the field is invalid, as on the Tasks page. Object.fromEntries turns the list
  // above into the { 'contact-name': 'name-error', … } pairs it expects.
  layout.linkErrors(form, Object.fromEntries(FIELDS.map(f => [f.id, f.error])));

  // Writes the trimmed values into the pop-up's list and opens it. escapeHtml turns
  // characters like < and > into plain text, so whatever was typed is shown, never run.
  function showConfirmation() {
    $('confirm-details').innerHTML = FIELDS.map(f =>
      `<div><dt class="label">${f.label}</dt><dd>${store.escapeHtml($(f.id).value.trim())}</dd></div>`
    ).join('');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  // The same text links as the footer (GitHub, LinkedIn, X, Instagram).
  $('contact-social').innerHTML = layout.socialLinksHtml();

  form.addEventListener('submit', e => {
    e.preventDefault(); // stay on the page: there is no server to send the form to
    if (!layout.validateForm(form)) return; // marks the errors and focuses the first one
    // Show the values first, then empty the fields and remove any red state and error links.
    showConfirmation();
    form.reset();
    layout.clearValidation(form);
  });

  // A modal opened from a script doesn't know where focus came from, so when it closes
  // (Done, ×, Esc or a click outside) focus goes back to the Send button.
  // As it starts closing, focus is first let go: Bootstrap marks the closing modal
  // aria-hidden, and Chrome warns if a focused button (Done or ×) is still inside it.
  modalEl.addEventListener('hide.bs.modal', () => document.activeElement.blur());
  modalEl.addEventListener('hidden.bs.modal', () => $('contact-submit').focus());
})(window.Taskit);
