if (!window.mtPopInit) {
  window.mtPopInit = true;

  const reducedMq = window.mtReducedMq;
<<<<<<< HEAD
  const KEY = 'mt-pop-until';
=======
  const KEY = "mt-pop-until";
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
  let timer = 0;
  let closeTimer = 0;
  let popTrigger = null;

<<<<<<< HEAD
  const pop = () => document.querySelector('[data-pop]');

  const otherOverlayOpen = () => /mt-(qs|cart|rf|nav)-lock/.test(document.documentElement.className);
=======
  const pop = () => document.querySelector("[data-pop]");

  const otherOverlayOpen = () =>
    /mt-(qs|cart|rf|nav)-lock/.test(document.documentElement.className);
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654

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
<<<<<<< HEAD
    window.mtStripParams(['mt-pop']);
=======
    window.mtStripParams(["mt-pop"]);
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
    window.scrollTo(0, 0);
  };

  const open = (el) => {
    if (!el) return;
    clearTimeout(closeTimer);
    if (!el.hidden) {
<<<<<<< HEAD
      if (el.classList.contains('mt-pop--open')) return;
      document.documentElement.classList.add('mt-pop-lock');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('mt-pop--open'));
=======
      if (el.classList.contains("mt-pop--open")) return;
      document.documentElement.classList.add("mt-pop-lock");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add("mt-pop--open"));
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
      });
      return;
    }
    el.hidden = false;
<<<<<<< HEAD
    document.documentElement.classList.add('mt-pop-lock');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('mt-pop--open'));
    });
    [...el.querySelectorAll('button[data-pop-close]')]
=======
    document.documentElement.classList.add("mt-pop-lock");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add("mt-pop--open"));
    });
    [...el.querySelectorAll("button[data-pop-close]")]
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
      .find((item) => item.offsetParent !== null)
      ?.focus({ preventScroll: true });
  };

  const close = (el, days) => {
    if (!el || el.hidden) return;
<<<<<<< HEAD
    el.classList.remove('mt-pop--open');
    document.documentElement.classList.remove('mt-pop-lock');
=======
    el.classList.remove("mt-pop--open");
    document.documentElement.classList.remove("mt-pop-lock");
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
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
<<<<<<< HEAD
    if (new URLSearchParams(window.location.search).get('mt-pop') === 'success') {
      el.querySelector('.mt-pop__form')?.setAttribute('hidden', '');
      el.querySelector('[data-pop-success]')?.removeAttribute('hidden');
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'subscribe',
        event_parameters: { module_name: 'Popup Function' },
=======
    if (
      new URLSearchParams(window.location.search).get("mt-pop") === "success"
    ) {
      el.querySelector(".mt-pop__form")?.setAttribute("hidden", "");
      el.querySelector("[data-pop-success]")?.removeAttribute("hidden");
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: "ga4Event",
        event_name: "subscribe",
        event_parameters: { module_name: "Popup Function" },
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
      });
      snooze(365);
      clean();
      open(el);
      return;
    }
<<<<<<< HEAD
    if (el.querySelector('[data-pop-error]')) {
=======
    if (el.querySelector("[data-pop-error]")) {
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
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

<<<<<<< HEAD
  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('[data-pop-open]');
=======
  document.addEventListener("click", (event) => {
    const opener = event.target.closest?.("[data-pop-open]");
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
    if (opener) {
      const el = pop();
      if (!el) return;
      event.preventDefault();
      clearTimeout(timer);
      popTrigger = window.mtKeyboardFocus(opener) ? opener : null;
      open(el);
      return;
    }
<<<<<<< HEAD
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
=======
    const closer = event.target.closest?.("[data-pop-close]");
    if (!closer) return;
    const el = closer.closest("[data-pop]");
    close(el, Number(el.dataset.days) || 30);
  });

  document.addEventListener("keydown", (event) => {
    const el = pop();
    if (!el || el.hidden) return;
    if (event.key === "Escape") {
      close(el, Number(el.dataset.days) || 30);
      return;
    }
    if (event.key !== "Tab") return;
    window.mtFocusTrap(
      event,
      el,
      "button:not(:disabled), input:not(:disabled), a[href]",
    );
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    const el = pop();
    if (!el || el.hidden) return;
    el.classList.remove("mt-pop--open");
    el.hidden = true;
    document.documentElement.classList.remove("mt-pop-lock");
  });

  document.addEventListener("shopify:section:select", (event) => {
    const el = event.target.querySelector?.("[data-pop]");
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
    if (el) {
      clearTimeout(timer);
      open(el);
    }
  });

<<<<<<< HEAD
  document.addEventListener('shopify:section:deselect', (event) => {
    const el = event.target.querySelector?.('[data-pop]');
    if (el) close(el, 0);
  });

  document.addEventListener('shopify:section:load', (event) => {
    const el = event.target.querySelector?.('[data-pop]');
    if (el && window.Shopify?.designMode) {
      document.documentElement.classList.remove('mt-pop-lock');
=======
  document.addEventListener("shopify:section:deselect", (event) => {
    const el = event.target.querySelector?.("[data-pop]");
    if (el) close(el, 0);
  });

  document.addEventListener("shopify:section:load", (event) => {
    const el = event.target.querySelector?.("[data-pop]");
    if (el && window.Shopify?.designMode) {
      document.documentElement.classList.remove("mt-pop-lock");
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
      open(el);
    }
  });

<<<<<<< HEAD
  document.addEventListener('shopify:section:unload', (event) => {
    if (event.target.querySelector?.('[data-pop]')) {
      document.documentElement.classList.remove('mt-pop-lock');
=======
  document.addEventListener("shopify:section:unload", (event) => {
    if (event.target.querySelector?.("[data-pop]")) {
      document.documentElement.classList.remove("mt-pop-lock");
>>>>>>> e744ec03310c1b3ce7ef609a269ee569d564c654
    }
  });
}
