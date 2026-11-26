if (!window.mtProductCarouselInit) {
  window.mtProductCarouselInit = true;

  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  const saveData = () => navigator.connection?.saveData === true;
  // Cards per list; matches the limit in product-carousel.liquid.
  const MAX = 12;

  const rowOf = (section) => section.querySelector('[data-pcar-row]');
  const cardsOf = (row) => [...row.querySelectorAll(':scope > .mt-card')];

  // ---- Edge flags: the stage is flagged at either scroll edge so CSS can hide that side's arrow (as in featured-kol) ----
  const sync = (row) => {
    const stage = row.closest('[data-row-stage]');
    if (!stage) return;
    const max = row.scrollWidth - row.clientWidth;
    stage.toggleAttribute('data-at-start', row.scrollLeft <= 1);
    stage.toggleAttribute('data-at-end', row.scrollLeft >= max - 1);
  };

  const resize = new ResizeObserver((entries) => {
    entries.forEach((entry) => sync(entry.target));
  });

  const bind = (root) => {
    root.querySelectorAll('[data-pcar-row]').forEach((row) => {
      if (row.dataset.pcarBound) return;
      row.dataset.pcarBound = 'true';
      let frame = 0;
      row.addEventListener(
        'scroll',
        () => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            sync(row);
          });
        },
        { passive: true }
      );
      resize.observe(row);
      sync(row);
    });
  };

  // ---- Filter tabs: cards come from templates/collection.pgrid.liquid (12 a page), as in product-grid ----
  // By tag: Shopify filters /collections/{handle}/{tag}, so the first page is the 12. By discount:
  // there is no native filter, so pages are fetched until 12 cards match on data-sale-percent.
  const feeds = new Map();
  const EMPTY_FEED = { total: 0, pages: 0, cards: [] };
  const baseCards = new WeakMap();
  const filters = new WeakMap();
  const pending = new WeakMap();

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

  const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

  const matchingCards = async (section, filter) => {
    if (filter.tag) return (await fetchFeed(feedUrl(section, filter, 1))).cards.slice(0, MAX);
    const inRange = (card) => {
      const percent = +card.dataset.salePercent || 0;
      return percent >= filter.min && percent <= filter.max;
    };
    const first = await fetchFeed(feedUrl(section, {}, 1));
    let matches = first.cards.filter(inRange);
    if (matches.length < MAX && first.pages > 1) {
      const rest = await Promise.all(range(2, first.pages).map((n) => fetchFeed(feedUrl(section, {}, n))));
      matches = matches.concat(rest.flatMap((feed) => feed.cards).filter(inRange));
    }
    return matches.slice(0, MAX);
  };

  const filterOf = (tab) => ({
    label: tab.dataset.label,
    ...(tab.dataset.tag
      ? { tag: tab.dataset.tag }
      : { min: +tab.dataset.min, max: tab.dataset.max ? +tab.dataset.max : Infinity }),
  });

  // Copies of the feed cards (cached feeds stay intact), restamped for this row: image sizes for the
  // wider carousel card, and GA4 list name / positions for the list narrowed by the tab.
  const loadCards = async (section, filter) => {
    if (!filter) return baseCards.get(section);
    const cards = await matchingCards(section, filter);
    return cards.map((card, i) => {
      const copy = document.importNode(card, true);
      copy.querySelectorAll('img[sizes]').forEach((img) => (img.sizes = section.dataset.sizes));
      if (copy.dataset.itemId) {
        copy.dataset.itemListId = section.dataset.listId;
        copy.dataset.itemListName = `${section.dataset.listName} - ${filter.label}`;
        copy.dataset.itemIndex = i + 1;
      }
      return copy;
    });
  };

  const swap = (section, cards) => {
    const row = rowOf(section);
    const empty = row.querySelector('[data-pcar-empty]');
    const offset = row.querySelector('.mt-pcar__promo') ? 1 : 0;
    cardsOf(row).forEach((card) => card.remove());
    cards.forEach((card, i) => card.style.setProperty('--mt-reveal-i', Math.min(i + offset, 4)));
    cards.forEach((card) => row.insertBefore(card, empty));
    if (empty) empty.hidden = cards.length > 0;
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
    // A new list starts from the left. The scroll event also refreshes the edge flags, the progress bar
    // and motion.js's row state, which a content swap alone does not (the row's own size is unchanged).
    row.scrollLeft = 0;
    row.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    observe(section);
  };

  // Shop more follows a tag tab to the collection filtered by that tag; discount tabs have no native URL.
  const syncMore = (section, filter) => {
    const more = section.querySelector('[data-pcar-more]');
    if (!more || !section.dataset.feedUrl) return;
    const url = new URL(section.dataset.feedUrl, window.location.origin);
    if (filter?.tag) url.pathname += `/${filter.tag}`;
    more.href = url.pathname + url.search;
  };

  // undo() puts the controls back when the cards for the new state cannot be loaded.
  const show = async (section, undo) => {
    const row = rowOf(section);
    const token = {};
    pending.set(section, token);
    row.setAttribute('aria-busy', 'true');
    try {
      const cards = await loadCards(section, filters.get(section));
      if (pending.get(section) !== token) return;
      swap(section, cards);
      // A tag with nothing in this collection has no page of its own; keep the whole collection.
      syncMore(section, cards.length ? filters.get(section) : null);
    } catch {
      if (pending.get(section) !== token) return;
      undo();
    } finally {
      if (pending.get(section) === token) row.removeAttribute('aria-busy');
    }
  };

  // Single choice; pressing the active tab again goes back to the server-rendered list.
  const toggleTab = (section, tab) => {
    if (!baseCards.has(section)) baseCards.set(section, cardsOf(rowOf(section)));

    const tabs = [...section.querySelectorAll('[data-pcar-tab]')];
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

    show(section, () => {
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t === was.pressed)));
      filters.set(section, was.filter);
    });
  };

  // A double click or a quick second tap would select and then clear the tab: only the first
  // click counts, and the same tab ignores clicks for TAB_LOCK ms after it acts. Other tabs stay live.
  const TAB_LOCK = 1000;
  const lastTab = new WeakMap();
  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-pcar-tab]');
    if (!tab || event.detail > 1) return;
    const section = tab.closest('[data-pcar]');
    const last = lastTab.get(section);
    if (last?.tab === tab && event.timeStamp - last.time < TAB_LOCK) return;
    lastTab.set(section, { tab, time: event.timeStamp });
    toggleTab(section, tab);
  });

  // Desktop hover: start loading a tab's cards under the pointer before the click.
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse' || saveData()) return;
    const tab = event.target.closest?.('[data-pcar-tab]');
    if (!tab || tab.getAttribute('aria-pressed') === 'true') return;
    const section = tab.closest('[data-pcar]');
    idle(() => matchingCards(section, filterOf(tab)).catch(() => {}));
  });

  // GA4 — same view_item_list / select_item pattern as the other product-list modules. The promo card
  // is a plain image, so it is not tracked.
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
    const fresh = cards.filter((card) => card.isConnected && !tracked.has(keyOf(card)));
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

  // Cards scrolled out of the row's visible part don't intersect, so only cards actually shown count.
  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const section = entry.target.closest('[data-pcar]');
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

  const observe = (root) =>
    root.querySelectorAll('[data-pcar] .mt-card[data-item-id]').forEach((card) => impressionObserver.observe(card));

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('[data-pcar] .mt-card[data-item-id]');
    if (!card) return;
    const section = card.closest('[data-pcar]');
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

  bind(document);
  observe(document);
  document.addEventListener('shopify:section:load', (event) => {
    bind(event.target);
    observe(event.target);
  });
}
