if (!window.mtPlpInit) {
  window.mtPlpInit = true;

  const strings = window.mtStrings || {};

  const desktopMq = window.matchMedia('(min-width: 750px)');
  const pending = new WeakMap();
  const trackedCount = new WeakMap();
  const pageCount = new WeakMap();
  const RETURN_STATE_KEY = 'mt_plp_return_state';

  const trackGrid = (grid) => {
    if (!grid) return;
    const plp = grid.closest('[data-plp]');
    if (!plp) return;
    const cards = [...grid.querySelectorAll('.mt-card[data-item-id]')];
    const already = trackedCount.get(grid) || 0;
    const freshCards = cards.slice(already);
    if (!freshCards.length) return;
    trackedCount.set(grid, cards.length);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_item_list',
      event_parameters: {
        item_list_id: plp.dataset.itemListId,
        item_list_name: plp.dataset.itemListName,
        currency: plp.dataset.currency,
        items: freshCards.map((card, i) => ({
          item_id: card.dataset.itemId,
          item_name: card.dataset.itemName,
          discount: +card.dataset.itemDiscount || 0,
          index: already + i + 1,
          item_list_id: card.dataset.itemListId,
          item_list_name: card.dataset.itemListName,
          ...(card.dataset.itemCategory ? { item_category: card.dataset.itemCategory } : {}),
          ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
          item_brand: card.dataset.itemBrand,
          price: +card.dataset.itemPrice,
          quantity: 1,
        })),
      },
    });
  };

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

  const scrollToBar = (plp) => {
    const bar = plp.querySelector('.mt-plp__bar');
    if (!bar) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const headerOffset =
      parseFloat(rootStyle.getPropertyValue('--mt-header-h')) * parseFloat(rootStyle.fontSize) || 0;
    let top = -headerOffset;
    let node = bar;
    while (node) {
      top += node.offsetTop;
      node = node.offsetParent;
    }
    if (window.mtScrollTo) {
      window.mtScrollTo(top);
    } else {
      window.scrollTo(0, top);
    }
  };

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
    const freshGrid = plp.querySelector('[data-plp-grid]');
    if (freshGrid) pageCount.set(freshGrid, 1);
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
    trackGrid(plp.querySelector('[data-plp-grid]'));
    scrollToBar(plp);
  };

  const apply = (plp) => {
    const params = new URLSearchParams(new FormData(plp.querySelector('[data-plp-filters]')));
    const query = params.toString();
    refresh(plp, plp.dataset.url + (query ? `?${query}` : ''), true);
  };

  const saveReturnState = (plp, card) => {
    const grid = plp.querySelector('[data-plp-grid]');
    const productHref = card.querySelector('.mt-card__link')?.getAttribute('href');
    if (!grid || !productHref) return;
    try {
      sessionStorage.setItem(
        RETURN_STATE_KEY,
        JSON.stringify({
          collectionHref: window.location.pathname + window.location.search,
          pages: pageCount.get(grid) || 1,
          productHref,
          scrollY: window.scrollY,
        })
      );
    } catch {}
  };

  const restoreReturnState = async () => {
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry && navEntry.type !== 'back_forward') {
      try {
        sessionStorage.removeItem(RETURN_STATE_KEY);
      } catch {}
      return;
    }
    let state;
    try {
      const raw = sessionStorage.getItem(RETURN_STATE_KEY);
      if (!raw) return;
      state = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      sessionStorage.removeItem(RETURN_STATE_KEY);
    } catch {}
    if (!state || state.collectionHref !== window.location.pathname + window.location.search) return;
    const plp = document.querySelector('[data-plp]');
    const grid = plp?.querySelector('[data-plp-grid]');
    if (!plp || !grid) return;

    plp.querySelectorAll('[data-plp-more]').forEach((more) => moreObserver.unobserve(more));
    for (let loaded = 1; loaded < state.pages; loaded += 1) {
      const more = plp.querySelector('[data-plp-more]');
      if (!more) break;
      let doc;
      try {
        const res = await fetch(sectionUrl(plp, more.dataset.nextUrl));
        if (!res.ok) break;
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      } catch {
        break;
      }
      grid.append(...doc.querySelectorAll('[data-plp-grid] > *'));
      const nextMore = doc.querySelector('[data-plp-more]');
      if (nextMore) {
        more.dataset.nextUrl = nextMore.dataset.nextUrl;
      } else {
        more.remove();
      }
    }
    pageCount.set(grid, state.pages);
    const finalMore = plp.querySelector('[data-plp-more]');
    if (finalMore) moreObserver.observe(finalMore);
    queueAlign();
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    trackGrid(grid);

    const target = [...grid.querySelectorAll('.mt-card[data-item-id]')].find(
      (card) => card.querySelector('.mt-card__link')?.getAttribute('href') === state.productHref
    );
    if (target) {
      target.scrollIntoView({ block: 'center' });
    } else if (typeof state.scrollY === 'number') {
      window.scrollTo(0, state.scrollY);
    }
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
        const grid = plp.querySelector('[data-plp-grid]');
        grid?.append(...doc.querySelectorAll('[data-plp-grid] > *'));
        if (grid) pageCount.set(grid, (pageCount.get(grid) || 1) + 1);
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
        trackGrid(plp.querySelector('[data-plp-grid]'));
      });
    },
    { rootMargin: '600px 0px' }
  );

  observeMore();
  syncAll();
  applySwatches(document);
  queueAlign();
  document.querySelectorAll('[data-plp-grid]').forEach((grid) => {
    pageCount.set(grid, 1);
    trackGrid(grid);
  });
  restoreReturnState();
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
    document.querySelectorAll('[data-plp-grid]').forEach((grid) => {
      pageCount.set(grid, 1);
      trackGrid(grid);
    });
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
      return;
    }
    const tile = event.target.closest?.('[data-category-name]');
    if (tile) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_category',
        event_parameters: { button_name: tile.dataset.categoryName },
      });
      return;
    }
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('[data-plp-grid] .mt-card[data-item-id]');
    if (card) {
      const plp = card.closest('[data-plp]');
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_item',
        event_parameters: {
          item_list_id: card.dataset.itemListId,
          item_list_name: card.dataset.itemListName,
          currency: plp?.dataset.currency,
          button_name: 'Product Card',
          items: [
            {
              item_id: card.dataset.itemId,
              item_name: card.dataset.itemName,
              discount: +card.dataset.itemDiscount || 0,
              index: +card.dataset.itemIndex,
              item_list_id: card.dataset.itemListId,
              item_list_name: card.dataset.itemListName,
                  ...(card.dataset.itemCategory ? { item_category: card.dataset.itemCategory } : {}),
          ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
              item_brand: card.dataset.itemBrand,
              price: +card.dataset.itemPrice,
              quantity: 1,
            },
          ],
        },
      });
      if (plp) saveReturnState(plp, card);
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest?.('[data-plp-filters] input');
    if (!input) return;
    if (input.checked) {
      const filterType = input.closest('[data-plp-group]')?.dataset.filterType;
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_filter',
        event_parameters: { filter_type: filterType, filter_content: input.dataset.filterContent },
      });
    }
    if (desktopMq.matches) apply(input.closest('[data-plp]'));
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
