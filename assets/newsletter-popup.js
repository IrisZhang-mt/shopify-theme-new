if (!window.mtPopInit) {
  window.mtPopInit = true;

  const reducedMq = window.mtReducedMq;
  const KEY = 'mt-pop-until';
  let timer = 0;
  let closeTimer = 0;
  let popTrigger = null;

  const pop = () => document.querySelector('[data-pop]');

  const otherOverlayOpen = () => /mt-(qs|cart|rf|nav)-lock/.test(document.documentElement.className);

  const snoozed = () => {
    try {
      return Date.now() < Number(localStorage.getItem(KEY) || 0);
    } catch {
      return false;
    }
  };

  const snooze = (days) => {
    try {
      localStorage.setItem(KEY, String(Date.now() + days * 864e5));
    } catch {
      return;
    }
  };

  const clean = () => {
    window.mtStripParams(['mt-pop']);
    window.scrollTo(0, 0);
  };

  const open = (el) => {
    if (!el) return;
    clearTimeout(closeTimer);
    if (!el.hidden) {
      if (el.classList.contains('mt-pop--open')) return;
      document.documentElement.classList.add('mt-pop-lock');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('mt-pop--open'));
      });
      return;
    }
    el.hidden = false;
    document.documentElement.classList.add('mt-pop-lock');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('mt-pop--open'));
    });
    [...el.querySelectorAll('button[data-pop-close]')]
      .find((item) => item.offsetParent !== null)
      ?.focus({ preventScroll: true });
  };

  const close = (el, days) => {
    if (!el || el.hidden) return;
    el.classList.remove('mt-pop--open');
    document.documentElement.classList.remove('mt-pop-lock');
    const finish = () => {
      el.hidden = true;
    };
    if (reducedMq.matches) finish();
    else closeTimer = setTimeout(finish, 500);
    if (days) snooze(days);
    popTrigger?.focus({ preventScroll: true });
    popTrigger = null;
  };

  const boot = () => {
    const el = pop();
    if (!el || window.Shopify?.designMode) return;
    if (new URLSearchParams(window.location.search).get('mt-pop') === 'success') {
      el.querySelector('.mt-pop__form')?.setAttribute('hidden', '');
      el.querySelector('[data-pop-success]')?.removeAttribute('hidden');
      snooze(365);
      clean();
      open(el);
      return;
    }
    if (el.querySelector('[data-pop-error]')) {
      open(el);
      return;
    }
    if (snoozed()) return;
    const fire = () => {
      if (otherOverlayOpen()) {
        timer = setTimeout(fire, 15000);
        return;
      }
      open(pop());
    };
    timer = setTimeout(fire, (Number(el.dataset.delay) || 6) * 1000);
  };

  boot();

  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('[data-pop-open]');
    if (opener) {
      const el = pop();
      if (!el) return;
      event.preventDefault();
      clearTimeout(timer);
      popTrigger = window.mtKeyboardFocus(opener) ? opener : null;
      open(el);
      return;
    }
    const closer = event.target.closest?.('[data-pop-close]');
    if (!closer) return;
    const el = closer.closest('[data-pop]');
    close(el, Number(el.dataset.days) || 30);
  });

  document.addEventListener('keydown', (event) => {
    const el = pop();
    if (!el || el.hidden) return;
    if (event.key === 'Escape') {
      close(el, Number(el.dataset.days) || 30);
      return;
    }
    if (event.key !== 'Tab') return;
    window.mtFocusTrap(event, el, 'button:not(:disabled), input:not(:disabled), a[href]');
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const el = pop();
    if (!el || el.hidden) return;
    el.classList.remove('mt-pop--open');
    el.hidden = true;
    document.documentElement.classList.remove('mt-pop-lock');
  });

  document.addEventListener('shopify:section:select', (event) => {
    const el = event.target.querySelector?.('[data-pop]');
    if (el) {
      clearTimeout(timer);
      open(el);
    }
  });

  document.addEventListener('shopify:section:deselect', (event) => {
    const el = event.target.querySelector?.('[data-pop]');
    if (el) close(el, 0);
  });

  document.addEventListener('shopify:section:load', (event) => {
    const el = event.target.querySelector?.('[data-pop]');
    if (el && window.Shopify?.designMode) {
      document.documentElement.classList.remove('mt-pop-lock');
      open(el);
    }
  });

  document.addEventListener('shopify:section:unload', (event) => {
    if (event.target.querySelector?.('[data-pop]')) {
      document.documentElement.classList.remove('mt-pop-lock');
    }
  });
}
