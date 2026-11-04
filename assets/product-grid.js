if (!window.mtProductGridInit) {
  window.mtProductGridInit = true;

  // ---- Pagination: swap the cards in place, no URL change ----
  // Several grids can share one page and would all follow a shared ?page=, so the
  // page only lives in data-page. Pager and count update on click (inside the
  // input window that CLS ignores); the cards follow when the HTML arrives.
  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  const saveData = () => navigator.connection?.saveData === true;
  const cache = new Map();
  const shownPage = new WeakMap();
  const pending = new WeakMap();

  const ARROW_PREV = '<svg width="9" height="18" viewBox="0 0 9 18" fill="none" aria-hidden="true"><path d="M8 1 1 9l7 8" stroke="currentColor" stroke-width="1.5"/></svg>';
  const ARROW_NEXT = '<svg width="9" height="18" viewBox="0 0 9 18" fill="none" aria-hidden="true"><path d="m1 1 7 8-7 8" stroke="currentColor" stroke-width="1.5"/></svg>';

  const sectionId = (section) => section.closest('[id^="shopify-section-"]')?.id.replace('shopify-section-', '') || '';
  const pagerOf = (section) => section.querySelector('[data-pgrid-pager]');

  // Built from the current URL so a localized page (e.g. /ar/...) gets its own markup.
  const fetchPage = (section, page) => {
    const id = sectionId(section);
    const key = `${id}:${page}`;
    if (!cache.has(key)) {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('section_id', id);
      url.searchParams.set('page', page);
      const request = fetch(url).then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      });
      request.catch(() => cache.delete(key));
      cache.set(key, request);
    }
    return cache.get(key);
  };

  // A short last page is topped up with the tail of the page before it, so it always
  // shows the collection's last N products: no blank slots, same height.
  const isShortLast = (pager, page) =>
    page > 1 && page === +pager.dataset.pages && +pager.dataset.total % +pager.dataset.perPage !== 0;
  const sourcePages = (pager, page) => (isShortLast(pager, page) ? [page - 1, page] : [page]);

  const prefetch = (section, page) => {
    const pager = pagerOf(section);
    if (!pager || page < 1 || page > +pager.dataset.pages) return;
    sourcePages(pager, page).forEach((n) => fetchPage(section, n).catch(() => {}));
  };

  // Always 7 slots (first, last, current ±1, gaps filled), so the arrows never move.
  const SLOTS = 7;
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const pageItems = (current, pages) => {
    if (pages <= SLOTS) return range(1, pages);
    if (current <= 4) return [...range(1, 5), '…', pages];
    if (current >= pages - 3) return [1, '…', ...range(pages - 4, pages)];
    return [1, '…', current - 1, current, current + 1, '…', pages];
  };

  const arrowButton = (pager, step) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mt-pgrid__arrow';
    button.dataset.pgridStep = step;
    button.setAttribute('aria-label', step < 0 ? pager.dataset.labelPrev : pager.dataset.labelNext);
    button.innerHTML = step < 0 ? ARROW_PREV : ARROW_NEXT;
    return button;
  };

  const renderPager = (pager) => {
    const page = +pager.dataset.page;
    const pages = +pager.dataset.pages;
    const total = +pager.dataset.total;
    const perPage = +pager.dataset.perPage;
    const focused = pager.contains(document.activeElement) ? document.activeElement.dataset.pgridStep || 'page' : '';

    const from = isShortLast(pager, page) ? total - perPage + 1 : (page - 1) * perPage + 1;
    pager.querySelector('[data-pgrid-count]').textContent = pager.dataset.template
      .replace('[from]', from)
      .replace('[to]', Math.min(page * perPage, total))
      .replace('[total]', total);

    const prev = arrowButton(pager, -1);
    const next = arrowButton(pager, 1);
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
    const nums = pageItems(page, pages).map((item) => {
      if (item === '…') {
        const dots = document.createElement('span');
        dots.className = 'mt-pgrid__dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.textContent = item;
        return dots;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mt-pgrid__num';
      button.dataset.pgridPage = item;
      button.textContent = item;
      button.setAttribute('aria-label', pager.dataset.labelPage.replace('[n]', item));
      if (item === page) button.setAttribute('aria-current', 'page');
      return button;
    });
    pager.querySelector('[data-pgrid-pages]').replaceChildren(prev, ...nums, next);

    // The buttons were rebuilt; keep keyboard focus on the same control.
    if (!focused) return;
    const arrow = focused === '-1' ? prev : focused === '1' ? next : null;
    (arrow && !arrow.disabled ? arrow : pager.querySelector('[aria-current="page"]'))?.focus();
  };

  const remToPx = (value) => {
    const n = parseFloat(value) || 0;
    if (!value.trim().endsWith('rem')) return n;
    return n * parseFloat(getComputedStyle(document.documentElement).fontSize);
  };

  // Same offset as anchor-tabs: the header plus the stuck tab bar, if the page has one.
  const scrollToSection = (section) => {
    const tabs = document.querySelector('[data-atabs]');
    const stuck = tabs ? remToPx(getComputedStyle(tabs).getPropertyValue('--mt-atabs-stuck-h')) : 0;
    const offset = (document.querySelector('.section-header')?.offsetHeight || 0) + stuck;
    // With motion.js smooth scrolling on, positions on screen follow .mt-scroll, not window.scrollY.
    const smooth = document.documentElement.classList.contains('mt-smooth') && document.querySelector('.mt-scroll');
    const scrollY = smooth ? smooth.scrollTop : window.scrollY;
    const top = Math.max(0, section.getBoundingClientRect().top + scrollY - offset);
    if (window.mtScrollTo) window.mtScrollTo(top);
    else window.scrollTo({ top, behavior: reducedMq.matches ? 'auto' : 'smooth' });
  };

  const parseCards = (html) => [
    ...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('[data-pgrid-grid] > .mt-card'),
  ];

  // ---- Filter tabs: the list comes from templates/collection.pgrid.liquid (24 cards a page) ----
  // By tag: Shopify filters /collections/{handle}/{tag}, so only the pages a grid page needs are
  // fetched. By discount: there is no native filter, so the whole collection is fetched once and
  // filtered on each card's data-sale-percent (the number its sale badge shows).
  const FEED_SIZE = 24;
  const filters = new WeakMap();
  const baseCounts = new WeakMap();
  const feeds = new Map();
  const EMPTY_FEED = { total: 0, pages: 0, cards: [] };

  const feedUrl = (section, filter, page) => {
    const url = new URL(section.dataset.feedUrl, window.location.origin);
    if (filter.tag) url.pathname += `/${filter.tag}`;
    url.searchParams.set('view', 'pgrid');
    url.searchParams.set('page', page);
    return url.href;
  };

  const fetchFeed = (url) => {
    if (!feeds.has(url)) {
      const request = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(res.status);
          // A tag no product in the collection carries redirects to the unfiltered collection.
          return res.redirected ? null : res.text();
        })
        .then((html) => {
          if (html === null) return EMPTY_FEED;
          const root = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-pgrid-feed]');
          if (!root) throw new Error('bad feed');
          const cards = [...root.querySelectorAll('[data-pgrid-grid] > .mt-card')];
          return { total: +root.dataset.total, pages: +root.dataset.pages, cards };
        });
      request.catch(() => feeds.delete(url));
      feeds.set(url, request);
    }
    return feeds.get(url);
  };

  const allCards = async (section, filter) => {
    const first = await fetchFeed(feedUrl(section, filter, 1));
    const rest = await Promise.all(range(2, first.pages).map((n) => fetchFeed(feedUrl(section, filter, n))));
    return [first, ...rest].flatMap((feed) => feed.cards);
  };

  // Same window as the unfiltered grid: a short last page shows the list's last N cards.
  const windowOf = (page, perPage, total) => {
    let start = (page - 1) * perPage;
    if (page > 1 && start + perPage > total) start = Math.max(0, total - perPage);
    return { start, end: Math.min(start + perPage, total) };
  };

  const filteredPage = async (section, filter, page) => {
    const perPage = +section.dataset.perPage;
    if (filter.tag) {
      const { total } = await fetchFeed(feedUrl(section, filter, 1));
      const { start, end } = windowOf(page, perPage, total);
      if (start >= end) return { cards: [], total, start };
      const from = Math.floor(start / FEED_SIZE) + 1;
      const to = Math.floor((end - 1) / FEED_SIZE) + 1;
      const pages = await Promise.all(range(from, to).map((n) => fetchFeed(feedUrl(section, filter, n))));
      const offset = (from - 1) * FEED_SIZE;
      return { cards: pages.flatMap((feed) => feed.cards).slice(start - offset, end - offset), total, start };
    }
    const matches = (await allCards(section, {})).filter((card) => {
      const percent = +card.dataset.salePercent || 0;
      return percent >= filter.min && percent <= filter.max;
    });
    const { start, end } = windowOf(page, perPage, matches.length);
    return { cards: matches.slice(start, end), total: matches.length, start };
  };

  const filterOf = (tab) => ({
    label: tab.dataset.label,
    ...(tab.dataset.tag
      ? { tag: tab.dataset.tag }
      : { min: +tab.dataset.min, max: tab.dataset.max ? +tab.dataset.max : Infinity }),
  });

  // Cards for one grid page: { cards, total, start }; cards are copies, so cached feeds stay intact.
  const loadPage = async (section, page) => {
    const filter = filters.get(section);
    if (filter) {
      const result = await filteredPage(section, filter, page);
      const cards = result.cards.map((card, i) => {
        const copy = document.importNode(card, true);
        // GA4: the list is this grid narrowed by the tab, positions count from the filtered list.
        if (copy.dataset.itemId) {
          copy.dataset.itemListId = section.dataset.listId;
          copy.dataset.itemListName = `${section.dataset.listName} - ${filter.label}`;
          copy.dataset.itemIndex = result.start + i + 1;
        }
        return copy;
      });
      return { ...result, cards };
    }
    // A grid that fits one page has no pager; clearing its tab reloads page 1.
    const pager = pagerOf(section);
    const htmls = await Promise.all((pager ? sourcePages(pager, page) : [1]).map((n) => fetchPage(section, n)));
    const cards = htmls.flatMap(parseCards);
    if (!cards.length) throw new Error('empty page');
    if (!pager) return { cards, total: cards.length };
    return { cards: cards.slice(-pager.dataset.perPage), total: baseCounts.get(section)?.total ?? +pager.dataset.total };
  };

  const swap = (section, cards) => {
    const grid = section.querySelector('[data-pgrid-grid]');
    const empty = section.querySelector('[data-pgrid-empty]');
    if (empty) empty.hidden = cards.length > 0;
    // Restart the reveal stagger from the first slot (topped-up cards carry their old index).
    cards.forEach((card, i) => card.style.setProperty('--mt-reveal-i', i));
    grid.replaceChildren(...cards);
    // Cards parsed by DOMParser come from an inert document; re-setting srcset/src makes
    // iOS Safari pick up the lazy images (same fix as plp.js).
    cards.forEach((card) =>
      card.querySelectorAll('img').forEach((img) => {
        const srcset = img.getAttribute('srcset');
        const src = img.getAttribute('src');
        if (srcset) img.setAttribute('srcset', srcset);
        if (src) img.setAttribute('src', src);
      })
    );
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    observe();
  };

  const prefetchNext = (section, page) => {
    if (saveData()) return;
    if (filters.get(section)) idle(() => loadPage(section, page + 1).catch(() => {}));
    else idle(() => prefetch(section, page + 1));
  };

  // Pager totals follow the active filter; a list that fits one page hides the pager.
  const setTotal = (pager, total) => {
    pager.dataset.total = total;
    pager.dataset.pages = Math.max(1, Math.ceil(total / +pager.dataset.perPage));
    pager.hidden = +pager.dataset.pages < 2;
  };

  // undo() puts the grid's state back when the cards for the new state cannot be loaded.
  const show = async (section, page, undo) => {
    const pager = pagerOf(section);
    const grid = section.querySelector('[data-pgrid-grid]');
    const token = {};
    pending.set(section, token);
    grid.setAttribute('aria-busy', 'true');
    try {
      const { cards, total } = await loadPage(section, page);
      if (pending.get(section) !== token) return;
      swap(section, cards);
      if (pager) {
        setTotal(pager, total);
        pager.dataset.page = page;
        renderPager(pager);
      }
      shownPage.set(section, page);
      prefetchNext(section, page);
    } catch {
      // Keep the cards on screen and put the controls back on the state they belong to.
      if (pending.get(section) !== token) return;
      undo();
    } finally {
      if (pending.get(section) === token) grid.removeAttribute('aria-busy');
    }
  };

  const go = (section, page) => {
    const pager = pagerOf(section);
    if (!pager || page < 1 || page > +pager.dataset.pages || page === +pager.dataset.page) return;
    if (!shownPage.has(section)) shownPage.set(section, +pager.dataset.page);

    pager.dataset.page = page;
    renderPager(pager);
    scrollToSection(section);
    show(section, page, () => {
      pager.dataset.page = shownPage.get(section);
      renderPager(pager);
    });
  };

  // Single choice; pressing the active tab again goes back to the whole collection.
  const toggleTab = (section, tab) => {
    const pager = pagerOf(section);
    if (pager && !baseCounts.has(section)) baseCounts.set(section, { total: +pager.dataset.total });
    if (!shownPage.has(section)) shownPage.set(section, pager ? +pager.dataset.page : 1);

    const tabs = [...section.querySelectorAll('[data-pgrid-tab]')];
    const was = { pressed: tabs.find((t) => t.getAttribute('aria-pressed') === 'true'), filter: filters.get(section) };
    const pressed = was.pressed === tab ? null : tab;
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t === pressed)));
    filters.set(section, pressed ? filterOf(pressed) : null);

    // GA4: a tab is a filter, reported like the PLP's (on select only, not when cleared).
    if (pressed) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_filter',
        event_parameters: {
          filter_type: pressed.dataset.tag ? 'Product tag' : 'Discount range',
          filter_content: pressed.dataset.label,
        },
      });
    }

    show(section, 1, () => {
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t === was.pressed)));
      filters.set(section, was.filter);
    });
  };

  // Prefetch the next page once the grid is close to view and the browser is idle.
  const nearObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        nearObserver.unobserve(entry.target);
        if (saveData()) return;
        const section = entry.target;
        idle(() => prefetch(section, +pagerOf(section).dataset.page + 1));
      });
    },
    { rootMargin: '400px 0px' }
  );

  const initPagers = () =>
    document.querySelectorAll('[data-pgrid-pager]').forEach((pager) => {
      renderPager(pager);
      nearObserver.observe(pager.closest('[data-pgrid]'));
    });

  // A double click or a quick second tap would select and then clear the tab: only the first
  // click counts, and the same tab ignores clicks for TAB_LOCK ms after it acts. Other tabs stay live.
  const TAB_LOCK = 1000;
  const lastTab = new WeakMap();
  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-pgrid-tab]');
    if (!tab || event.detail > 1) return;
    const section = tab.closest('[data-pgrid]');
    const last = lastTab.get(section);
    if (last?.tab === tab && event.timeStamp - last.time < TAB_LOCK) return;
    lastTab.set(section, { tab, time: event.timeStamp });
    toggleTab(section, tab);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-pgrid-pager] button');
    if (!button || button.disabled) return;
    const section = button.closest('[data-pgrid]');
    const pager = pagerOf(section);
    const page = button.dataset.pgridPage
      ? +button.dataset.pgridPage
      : +pager.dataset.page + +button.dataset.pgridStep;
    go(section, page);
  });

  // Desktop hover: start loading the page (or the tab's first page) under the pointer before the click.
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const tab = event.target.closest?.('[data-pgrid-tab]');
    if (tab) {
      const section = tab.closest('[data-pgrid]');
      // The pressed tab clears the filter, so its click needs the unfiltered first page.
      if (tab.getAttribute('aria-pressed') === 'true') fetchPage(section, 1).catch(() => {});
      else filteredPage(section, filterOf(tab), 1).catch(() => {});
      return;
    }
    const button = event.target.closest?.('[data-pgrid-pager] button:not(:disabled)');
    if (!button) return;
    const section = button.closest('[data-pgrid]');
    const pager = pagerOf(section);
    const page = button.dataset.pgridPage ? +button.dataset.pgridPage : +pager.dataset.page + +button.dataset.pgridStep;
    if (filters.get(section)) loadPage(section, page).catch(() => {});
    else prefetch(section, page);
  });

  document.addEventListener('shopify:section:load', initPagers);

  // GA4 — same view_item_list / select_item pattern as the other product-list modules.
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

  const flushImpressions = (section) => {
    const cards = pendingCards.get(section) || [];
    pendingCards.set(section, []);
    // Keyed by list too: a product seen unfiltered counts again under a tab's list name.
    const tracked = trackedIds.get(section);
    const keyOf = (card) => `${card.dataset.itemListName}|${card.dataset.itemId}`;
    const fresh = cards.filter((card) => !tracked.has(keyOf(card)));
    if (!fresh.length) return;
    fresh.forEach((card) => tracked.add(keyOf(card)));
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_item_list',
      event_parameters: {
        item_list_id: fresh[0].dataset.itemListId,
        item_list_name: fresh[0].dataset.itemListName,
        currency: section.dataset.currency,
        items: fresh.map(buildItem),
      },
    });
  };

  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const section = entry.target.closest('[data-pgrid]');
        if (!section) return;
        if (!trackedIds.has(section)) trackedIds.set(section, new Set());
        if (!pendingCards.has(section)) pendingCards.set(section, []);
        pendingCards.get(section).push(entry.target);
        clearTimeout(batchTimers.get(section));
        batchTimers.set(section, setTimeout(() => flushImpressions(section), BATCH_DELAY));
      });
    },
    { threshold: 0.5 }
  );

  const observe = () =>
    document.querySelectorAll('[data-pgrid] .mt-card[data-item-id]').forEach((card) => impressionObserver.observe(card));
  document.addEventListener('shopify:section:load', observe);
  observe();

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('[data-pgrid] .mt-card[data-item-id]');
    if (!card) return;
    const section = card.closest('[data-pgrid]');
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'select_item',
      event_parameters: {
        item_list_id: card.dataset.itemListId,
        item_list_name: card.dataset.itemListName,
        currency: section?.dataset.currency,
        button_name: 'Product Card',
        items: [buildItem(card)],
      },
    });
  });

  initPagers();
}
