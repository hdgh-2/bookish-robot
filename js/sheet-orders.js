/**
 * Sends the order form to the Google Sheet web app instead of reloading the page.
 *
 * Usage: add `data-sheet-orders` to the order <form>, then include
 *   <script src="js/sheet-config.js"></script>
 *   <script src="js/sheet-orders.js" defer></script>
 *
 * Optional: an element with `data-sheet-status` inside the form shows progress
 * and result messages. Every input needs a `name`; that name becomes the column.
 */
(function () {
  function setStatus(form, text, state) {
    var el = form.querySelector('[data-sheet-status]');
    if (!el) {
      if (state === 'error') alert(text);
      return;
    }
    el.textContent = text;
    el.setAttribute('data-state', state);
  }

  function handleSubmit(event) {
    var form = event.target;
    var url = window.ORDER_SHEET_URL;
    if (!url) return; // Not configured: let the form submit normally.

    event.preventDefault();
    var button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    setStatus(form, 'Sending your order…', 'pending');

    var body = new URLSearchParams(new FormData(form));

    // A form-encoded POST is a "simple" request, so the browser skips the CORS
    // preflight that Apps Script cannot answer.
    fetch(url, { method: 'POST', body: body })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) throw new Error(data.error || 'Unknown error');
        form.reset();
        setStatus(form, 'Thanks! Your order has been received.', 'success');
        form.dispatchEvent(new CustomEvent('order:sent', { bubbles: true }));
      })
      .catch(function (err) {
        console.error('Order submission failed', err);
        setStatus(
          form,
          'Sorry, your order could not be sent. Please try again or contact the organiser.',
          'error'
        );
      })
      .finally(function () {
        if (button) button.disabled = false;
      });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-sheet-orders]');
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener('submit', handleSubmit);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
