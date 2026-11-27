// Global toast (toast.css) — one short message at a time, bottom centre, auto-hides.
// window.mtToast(message): show any message.
// window.mtToastCartError(status): failed /cart/add.js or /cart/change.js — 422 means the
// stock limit is reached, anything else (incl. 0 = network) gets the generic message.
(() => {
  const strings = window.mtStrings || {};
  const DURATION = 3000;
  let el = null;
  let timer = null;

  // circled "!" — strokes/fills use currentColor, so it follows the toast text colour
  const ICON =
    '<svg class="mt-toast__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M8 4.25v4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="8" cy="11.4" r="0.95" fill="currentColor"/>' +
    '</svg>';

  const toastEl = () => {
    if (el?.isConnected) return el;
    el = document.createElement('div');
    el.className = 'mt-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `${ICON}<span class="mt-toast__text"></span>`;
    document.body.appendChild(el);
    return el;
  };

  window.mtToast = (message) => {
    if (!message) return;
    const toast = toastEl();
    toast.querySelector('.mt-toast__text').textContent = message;
    clearTimeout(timer);
    // restart the enter transition when a new message replaces a visible one
    toast.classList.remove('mt-toast--shown');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('mt-toast--shown'));
    });
    timer = setTimeout(() => toast.classList.remove('mt-toast--shown'), DURATION);
  };

  window.mtToastCartError = (status) => {
    window.mtToast(status === 422 ? strings.cartErrorStock : strings.cartErrorGeneric);
  };
})();
