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

  // Same approach as tasks.js: a field is linked to its error message only while it is
  // invalid, so a screen reader hears "invalid, Add a subject." on a bad field and nothing
  // extra on a good one. Only after a submit attempt (.was-validated), like the red borders.
  function updateErrorAttributes() {
    const checked = form.classList.contains('was-validated');
    FIELDS.forEach(f => {
      const field = $(f.id);
      if (checked && !field.validity.valid) {
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', f.error);
      } else {
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
    });
  }

  // Writes the trimmed values into the pop-up's list and opens it. escapeHtml turns
  // characters like < and > into plain text, so whatever was typed is shown, never run.
  function showConfirmation() {
    $('confirm-details').innerHTML = FIELDS.map(f =>
      `<div><dt class="label">${f.label}</dt><dd>${store.escapeHtml($(f.id).value.trim())}</dd></div>`
    ).join('');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  // Empties the fields and wipes every trace of an earlier failed submit: the red state,
  // the "spaces only" errors layout.js stored on the text fields, and the error links.
  function clearForm() {
    form.reset();
    form.classList.remove('was-validated');
    FIELDS.forEach(f => $(f.id).setCustomValidity(''));
    updateErrorAttributes();
  }

  // The same text links as the footer (GitHub, LinkedIn, X, Instagram).
  $('contact-social').innerHTML = layout.socialLinksHtml();

  form.addEventListener('submit', e => {
    e.preventDefault(); // stay on the page: there is no server to send the form to
    const valid = layout.validateForm(form); // also focuses the first invalid field
    updateErrorAttributes();
    if (!valid) return;
    showConfirmation(); // reads the values first...
    clearForm();        // ...then clears them
  });

  // Keep the error links up to date while the user fixes a field. This listener is added
  // after layout.js's one, so it runs after layout.js has re-checked the text.
  document.addEventListener('input', e => {
    if (form.contains(e.target)) updateErrorAttributes();
  });

  // A modal opened from a script doesn't know where focus came from, so when it closes
  // (Done, ×, Esc or a click outside) focus goes back to the Send button.
  // As it starts closing, focus is first let go: Bootstrap marks the closing modal
  // aria-hidden, and Chrome warns if a focused button (Done or ×) is still inside it.
  modalEl.addEventListener('hide.bs.modal', () => document.activeElement.blur());
  modalEl.addEventListener('hidden.bs.modal', () => $('contact-submit').focus());
})(window.Taskit);
