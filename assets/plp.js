if (!window.mtPlpInit) {
  window.mtPlpInit = true;

  const strings = window.mtStrings || {};

  const desktopMq = window.matchMedia('(min-width: 750px)');
  const pending = new WeakMap();
  const pageCount = new WeakMap();
  const renderedUrl = new WeakMap();
  const RETURN_STATE_KEY = 'mt_plp_return_state';

  // Cards parsed by DOMParser come from an inert document. Re-setting srcset/src once
  // they are in the live grid makes iOS Safari pick up the lazy images; without it a
  // paginated image occasionally never loads.
  const appendCards = (grid, doc) => {
    const cards = [...doc.querySelectorAll('[data-plp-grid] > *')];
    grid.append(...cards);
    cards.forEach((card) =>
      card.querySelectorAll('img').forEach((img) => {
        const srcset = img.getAttribute('srcset');
        const src = img.getAttribute('src');
        if (srcset) img.setAttribute('srcset', srcset);
        if (src) img.setAttribute('src', src);
      })
    );
  };

  const trackedIds = new WeakMap();
  const pendingCards = new WeakMap();
  const batchTimers = new WeakMap();
  const BATCH_DELAY = 300;

  const buildItem = (card) => ({
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
  });

  const flushImpressions = (grid) => {
    const plp = grid.closest('[data-plp]');
    if (!plp) return;
    const cards = pendingCards.get(grid) || [];
    pendingCards.set(grid, []);
    const tracked = trackedIds.get(grid);
    const fresh = cards.filter((card) => !tracked.has(card.dataset.itemId));
    if (!fresh.length) return;
    fresh.forEach((card) => tracked.add(card.dataset.itemId));
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_item_list',
      event_parameters: {
        item_list_id: plp.dataset.itemListId,
        item_list_name: plp.dataset.itemListName,
        currency: plp.dataset.currency,
        items: fresh.map(buildItem),
      },
    });
  };

  // Only report a product once it has actually scrolled into view (>=50%
  // visible), batching cards that become visible together within a short
  // window instead of firing everything as soon as the grid renders.
  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const grid = entry.target.closest('[data-plp-grid]');
        if (!grid) return;
        if (!trackedIds.has(grid)) trackedIds.set(grid, new Set());
        if (!pendingCards.has(grid)) pendingCards.set(grid, []);
        pendingCards.get(grid).push(entry.target);
        clearTimeout(batchTimers.get(grid));
        batchTimers.set(grid, setTimeout(() => flushImpressions(grid), BATCH_DELAY));
      });
    },
    { threshold: 0.5 }
  );

  // Renumber on every call (DOM order, 1-based) rather than trusting the
  // Liquid-rendered index: that index comes from a per-page `forloop` that
  // restarts at 1 on every paginated fetch, so without this, loading page 2
  // would report its cards as index 1-24 again instead of continuing 25-48.
  const observeGrid = (grid) => {
    if (!grid) return;
    grid.querySelectorAll('.mt-card[data-item-id]').forEach((card, i) => {
      card.dataset.itemIndex = i + 1;
      impressionObserver.observe(card);
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

  const resetScroll = () => {
    window.scrollTo(0, 0);
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

  const queueAlign = () => window.mtAlignTitles();

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
    renderedUrl.set(plp, new URL(url, window.location.href).href);
    plp.classList.add('mt-plp--loading');
    resetScroll();
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
    observeGrid(plp.querySelector('[data-plp-grid]'));
    resetScroll();
    requestAnimationFrame(resetScroll);
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
    // motion.js sets scrollRestoration to 'manual' (so fresh loads start at the
    // top), and that is what makes iOS put a back-forward-restored PLP at y=0.
    // Hand this history entry back to the browser before leaving so Safari's
    // own restore keeps the position; a full-load return still starts at the
    // top via motion.js and is positioned by restoreReturnState() at boot.
    try {
      history.scrollRestoration = 'auto';
    } catch {}
    watchResume();
  };

  // Fallback for iOS returning to a frozen PLP with no pagehide / pageshow /
  // visibilitychange at all: timers stop while the page is frozen, so a long
  // gap between ticks means it was just resumed. Runs only between a
  // product-card click and the next restore.
  let resumeTimer = 0;
  const watchResume = () => {
    clearInterval(resumeTimer);
    let last = performance.now();
    resumeTimer = setInterval(() => {
      const now = performance.now();
      const gap = now - last;
      last = now;
      // Background tabs get throttled timers too; that isn't a resume.
      if (gap < 1500 || document.visibilityState === 'hidden') return;
      restoreReturnState();
    }, 500);
  };

  const restoreReturnState = async () => {
    // Not gated on performance.getEntriesByType('navigation')[0].type: iOS
    // Safari reports 'reload' instead of 'back_forward' for an actual back
    // navigation, so that check silently discarded a correctly-saved state on
    // every real-device test. The href match below, plus consuming the stored
    // state exactly once, are enough to avoid re-applying it on an unrelated
    // visit to the same filtered URL.
    clearInterval(resumeTimer);
    let raw = null;
    try {
      raw = sessionStorage.getItem(RETURN_STATE_KEY);
    } catch {}
    let state;
    try {
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

    // Start from however many pages are already in the grid, not always 1:
    // when this runs from the bfcache pageshow handler, the DOM (and
    // pageCount) already reflect everything loaded before the user left the
    // page, and re-fetching from page 1 would append duplicate cards.
    plp.querySelectorAll('[data-plp-more]').forEach((more) => moreObserver.unobserve(more));
    for (let loaded = pageCount.get(grid) || 1; loaded < state.pages; loaded += 1) {
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
      appendCards(grid, doc);
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
    observeGrid(grid);

    const target = [...grid.querySelectorAll('.mt-card[data-item-id]')].find(
      (card) => card.querySelector('.mt-card__link')?.getAttribute('href') === state.productHref
    );
    const place = () => {
      if (target?.isConnected) {
        target.scrollIntoView({ block: 'center' });
      } else if (typeof state.scrollY === 'number') {
        window.scrollTo(0, state.scrollY);
      }
    };
    settleScroll(place);
  };

  // iOS Safari can apply its own scroll position after pageshow / after the
  // initial render (e.g. jumping to the top on a back-forward restore), which
  // silently undoes a single scrollIntoView. Re-apply for the first second,
  // and stop as soon as the user touches the page so we never fight them.
  const settleScroll = (place) => {
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    const events = ['touchstart', 'wheel', 'keydown'];
    events.forEach((type) => window.addEventListener(type, cancel, { once: true, passive: true }));
    const run = () => {
      if (!cancelled) place();
    };
    run();
    requestAnimationFrame(run);
    [100, 300, 600, 1000].forEach((ms) => setTimeout(run, ms));
    setTimeout(() => {
      events.forEach((type) => window.removeEventListener(type, cancel));
    }, 1100);
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
        if (grid) appendCards(grid, doc);
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
        observeGrid(plp.querySelector('[data-plp-grid]'));
      });
    },
    { rootMargin: '600px 0px' }
  );

  observeMore();
  syncAll();
  applySwatches(document);
  document.querySelectorAll('[data-plp]').forEach((plp) => renderedUrl.set(plp, window.location.href));
  document.querySelectorAll('[data-plp-grid]').forEach((grid) => {
    pageCount.set(grid, 1);
    observeGrid(grid);
  });
  restoreReturnState();
  document.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'width' && event.target.matches('[data-plp-aside]')) queueAlign();
  });
  desktopMq.addEventListener('change', syncAll);
  document.addEventListener('shopify:section:load', () => {
    swatchMap = null;
    observeMore();
    syncAll();
    applySwatches(document);
    document.querySelectorAll('[data-plp-grid]').forEach((grid) => {
      pageCount.set(grid, 1);
      observeGrid(grid);
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
          items: [buildItem(card)],
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
    // A bfcache restore (this is what `persisted` means here) resumes the
    // page without re-running any top-level script, so the normal
    // restoreReturnState() call at boot never happens for it — run it here
    // instead, now that the frozen DOM/pageCount are back and queryable.
    restoreReturnState();
  });

  // On iOS Safari, going PLP -> PDP -> back a second time from a page that was
  // itself restored from the bfcache can fire neither pagehide nor pageshow:
  // the page is just hidden, reset to the top, and shown again, so neither
  // the boot nor the pageshow restore runs. Becoming visible again is the only
  // signal left. Safe to call alongside pageshow: the saved state is consumed
  // by whichever runs first, and is only written on a product-card click.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') restoreReturnState();
  });

  // iOS Safari can fire popstate on a back-forward restore of this page even
  // though the URL hasn't changed; re-rendering then would drop the appended
  // pages and scroll to the top, undoing restoreReturnState(). Only refresh
  // when the URL differs from what the grid currently shows (filter back/forward).
  window.addEventListener('popstate', () => {
    const plp = document.querySelector('[data-plp]');
    if (!plp) return;
    if ((renderedUrl.get(plp) || '') === window.location.href) return;
    refresh(plp, window.location.href, false);
  });

  desktopMq.addEventListener('change', () => {
    document.querySelectorAll('[data-plp]').forEach((plp) => setOverlay(plp, false));
  });
}
