if (!window.mtPlpInit) {
  window.mtPlpInit = true;

  const strings = window.mtStrings || {};

  const desktopMq = window.matchMedia('(min-width: 750px)');
  const pending = new WeakMap();

  const sectionId = (plp) => plp.closest('[id^="shopify-section-"]')?.id.replace('shopify-section-', '') || '';

  const sectionUrl = (plp, url) => {
    const result = new URL(url, window.location.origin);
    const id = sectionId(plp);
    if (id) result.searchParams.set('section_id', id);
    return result;
  };

  const syncToggle = (plp) => {
    const toggle = plp.querySelector('[data-plp-toggle]');
    const aside = plp.querySelector('[data-plp-aside]');
    if (!toggle || !aside) return;
    const open = desktopMq.matches
      ? !aside.classList.contains('mt-plp__aside--hidden')
      : aside.classList.contains('mt-plp__aside--open');
    toggle.textContent = open ? strings.hideFilters : strings.showFilters;
    toggle.setAttribute('aria-expanded', String(open));
  };

  const syncAll = () => document.querySelectorAll('[data-plp]').forEach(syncToggle);

  let swatchMap = null;

  const applySwatches = (root) => {
    if (!swatchMap) {
      const data = document.querySelector('[data-plp-swatch-map]');
      if (!data) return;
      try {
        swatchMap = JSON.parse(data.textContent);
      } catch {
        return;
      }
    }
    root.querySelectorAll('.mt-plp__swatch[data-swatch]').forEach((swatch) => {
      const color = swatchMap[swatch.dataset.swatch];
      if (color) swatch.style.setProperty('--mt-swatch', color);
    });
  };

  const setOverlay = (plp, on) => {
    const aside = plp.querySelector('[data-plp-aside]');
    const wasOpen = aside.classList.contains('mt-plp__aside--open');
    aside.classList.toggle('mt-plp__aside--open', on);
    document.documentElement.classList.toggle('mt-plp-lock', on);
    if (on) {
      aside.setAttribute('role', 'dialog');
      aside.setAttribute('aria-modal', 'true');
      aside.querySelector('[data-plp-close]')?.focus({ preventScroll: true });
    } else {
      aside.removeAttribute('role');
      aside.removeAttribute('aria-modal');
      if (wasOpen) plp.querySelector('[data-plp-toggle]')?.focus({ preventScroll: true });
    }
    syncToggle(plp);
  };

  const measureTitles = () => {
    document.querySelectorAll('[data-plp-grid]').forEach((grid) => {
      const rows = new Map();
      grid.querySelectorAll('.mt-card').forEach((card) => {
        const key = card.offsetTop;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(card);
      });
      rows.forEach((row) => {
        let tallest = 0;
        row.forEach((card) => {
          const title = card.querySelector('.mt-card__title');
          if (title) tallest = Math.max(tallest, title.offsetHeight);
        });
        if (!tallest) return;
        row.forEach((card) => card.style.setProperty('--mt-plp-title-h', `${tallest}px`));
      });
    });
  };

  const alignTitles = () => {
    document
      .querySelectorAll('[data-plp-grid] .mt-card')
      .forEach((card) => card.style.removeProperty('--mt-plp-title-h'));
    requestAnimationFrame(measureTitles);
  };

  let alignFrame = 0;
  const queueAlign = () => {
    cancelAnimationFrame(alignFrame);
    alignFrame = requestAnimationFrame(alignTitles);
  };

  const observeMore = () => {
    document.querySelectorAll('[data-plp-more]:not([data-observed])').forEach((el) => {
      el.dataset.observed = '1';
      moreObserver.observe(el);
    });
  };

  const refresh = async (plp, url, push) => {
    pending.get(plp)?.abort();
    const controller = new AbortController();
    pending.set(plp, controller);
    plp.classList.add('mt-plp--loading');
    let doc;
    try {
      const res = await fetch(sectionUrl(plp, url), { signal: controller.signal });
      if (!res.ok) throw new Error(res.status);
      doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    } catch {
      if (!controller.signal.aborted) plp.classList.remove('mt-plp--loading');
      return;
    }
    if (pending.get(plp) !== controller) return;
    const next = doc.querySelector('[data-plp]');
    plp.classList.remove('mt-plp--loading');
    if (!next) return;
    const openGroups = new Set(
      [...plp.querySelectorAll('[data-plp-group][open]')].map((group) => group.dataset.plpGroup)
    );
    const active = document.activeElement;
    const focusKey = active?.name ? [active.name, active.value] : null;
    const hidden = plp.classList.contains('mt-plp--full');
    plp.querySelectorAll('[data-plp-more]').forEach((more) => moreObserver.unobserve(more));
    plp.innerHTML = next.innerHTML;
    document.documentElement.classList.remove('mt-plp-lock');
    plp.querySelector('[data-plp-aside]').classList.toggle('mt-plp__aside--hidden', hidden);
    syncToggle(plp);
    plp.querySelectorAll('[data-plp-group]').forEach((group) => {
      group.toggleAttribute('open', openGroups.has(group.dataset.plpGroup));
    });
    if (focusKey) {
      const [name, value] = focusKey;
      plp.querySelector(`input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
    }
    if (push) {
      try {
        history.pushState({ mtPlp: true }, '', url);
      } catch {}
    }
    applySwatches(plp);
    observeMore();
    queueAlign();
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
  };

  const apply = (plp) => {
    const params = new URLSearchParams(new FormData(plp.querySelector('[data-plp-filters]')));
    const query = params.toString();
    refresh(plp, plp.dataset.url + (query ? `?${query}` : ''), true);
  };

  const moreObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        const more = entry.target;
        if (more.dataset.busy) return;
        more.dataset.busy = '1';
        const plp = more.closest('[data-plp]');
        let doc;
        try {
          const res = await fetch(sectionUrl(plp, more.dataset.nextUrl));
          if (!res.ok) throw new Error(res.status);
          doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        } catch {
          delete more.dataset.busy;
          return;
        }
        if (!more.isConnected) return;
        plp.querySelector('[data-plp-grid]')?.append(...doc.querySelectorAll('[data-plp-grid] > *'));
        const nextMore = doc.querySelector('[data-plp-more]');
        if (nextMore) {
          more.dataset.nextUrl = nextMore.dataset.nextUrl;
          delete more.dataset.busy;
        } else {
          moreObserver.unobserve(more);
          more.remove();
        }
        queueAlign();
        document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      });
    },
    { rootMargin: '600px 0px' }
  );

  observeMore();
  syncAll();
  applySwatches(document);
  queueAlign();
  window.addEventListener('resize', queueAlign);
  document.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'width' && event.target.matches('[data-plp-aside]')) queueAlign();
  });
  if (document.fonts) document.fonts.ready.then(queueAlign);
  desktopMq.addEventListener('change', syncAll);
  document.addEventListener('shopify:section:load', () => {
    swatchMap = null;
    observeMore();
    syncAll();
    applySwatches(document);
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('[data-plp-toggle]');
    if (toggle) {
      const plp = toggle.closest('[data-plp]');
      if (desktopMq.matches) {
        const hidden = plp.classList.toggle('mt-plp--full');
        plp.querySelector('[data-plp-aside]').classList.toggle('mt-plp__aside--hidden', hidden);
        syncToggle(plp);
      } else {
        setOverlay(plp, true);
      }
      return;
    }
    const close = event.target.closest?.('[data-plp-close]');
    if (close) {
      setOverlay(close.closest('[data-plp]'), false);
      return;
    }
    const clear = event.target.closest?.('[data-plp-clear]');
    if (clear) {
      const plp = clear.closest('[data-plp]');
      plp.querySelectorAll('[data-plp-filters] input:checked').forEach((input) => {
        input.checked = false;
      });
      setOverlay(plp, false);
      apply(plp);
    }
  });

  document.addEventListener('change', (event) => {
    if (!desktopMq.matches) return;
    const input = event.target.closest?.('[data-plp-filters] input');
    if (input) apply(input.closest('[data-plp]'));
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-plp-filters]');
    if (!form) return;
    event.preventDefault();
    const plp = form.closest('[data-plp]');
    setOverlay(plp, false);
    apply(plp);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' && event.key !== 'Tab') return;
    const aside = document.querySelector('.mt-plp__aside--open');
    if (!aside) return;
    if (event.key === 'Escape') {
      setOverlay(aside.closest('[data-plp]'), false);
      return;
    }
    window.mtFocusTrap(event, aside, 'button:not(:disabled), input:not(:disabled), a[href], summary');
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll('[data-plp]').forEach((plp) => setOverlay(plp, false));
  });

  window.addEventListener('popstate', () => {
    const plp = document.querySelector('[data-plp]');
    if (plp) refresh(plp, window.location.href, false);
  });

  desktopMq.addEventListener('change', () => {
    document.querySelectorAll('[data-plp]').forEach((plp) => setOverlay(plp, false));
  });
}
