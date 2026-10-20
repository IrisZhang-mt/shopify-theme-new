if (!window.mtOffersInit) {
  window.mtOffersInit = true;

  const reducedMq = window.mtReducedMq;
  let closeTimer = 0;
  let trigger = null;

  const modal = () => document.querySelector('[data-offers]');
  const openedModal = () => document.querySelector('[data-offers]:not([hidden])');

  // The cart drawer is a transformed, low z-index layer, so the popup is lifted
  // under <body> on open (same approach as size-chart.js); a re-rendered section
  // copy replaces any previously lifted one.
  const portal = (el) => {
    if (el.parentElement === document.body) return el;
    document.querySelectorAll('body > [data-offers]').forEach((old) => old.remove());
    document.body.append(el);
    return el;
  };

  const open = (opener) => {
    let el = modal();
    if (!el) return;
    el = portal(el);
    clearTimeout(closeTimer);
    trigger = opener;
    el.hidden = false;
    document.documentElement.classList.add('mt-offers-lock');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('mt-offers--open')));
    el.querySelector('.mt-offers__close')?.focus({ preventScroll: true });
  };

  const close = () => {
    const el = openedModal();
    if (!el) return;
    el.classList.remove('mt-offers--open');
    document.documentElement.classList.remove('mt-offers-lock');
    const finish = () => {
      el.hidden = true;
    };
    if (reducedMq.matches) finish();
    else closeTimer = setTimeout(finish, 450);
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('[data-offers-open]');
    if (opener) {
      event.preventDefault();
      open(opener);
      return;
    }
    if (event.target.closest?.('[data-offers-close]')) close();
  });

  // Capture phase + stopPropagation so Escape/Tab stay inside the popup and
  // don't also reach cart.js, which would close the drawer underneath.
  document.addEventListener(
    'keydown',
    (event) => {
      const el = openedModal();
      if (!el) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'Tab') {
        event.stopPropagation();
        window.mtFocusTrap(event, el);
      }
    },
    true
  );

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    clearTimeout(closeTimer);
    document.querySelectorAll('[data-offers]').forEach((el) => {
      el.classList.remove('mt-offers--open');
      el.hidden = true;
    });
    document.documentElement.classList.remove('mt-offers-lock');
    trigger = null;
  });

  document.addEventListener('shopify:section:load', () => {
    if (!openedModal()) document.documentElement.classList.remove('mt-offers-lock');
  });
}
