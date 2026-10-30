if (!window.mtBestSellersInit) {
  window.mtBestSellersInit = true;

  const panelState = new WeakMap();
  const trackedKeys = new WeakMap();
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

  // Tabs share one item_list_id but switch item_list_name, so the same
  // product id can legitimately need a fresh impression under a new tab —
  // dedup on the pair, not the bare id.
  const keyOf = (card) => `${card.dataset.itemId}|${card.dataset.itemListName}`;

  const flushImpressions = (section) => {
    const cards = pendingCards.get(section) || [];
    pendingCards.set(section, []);
    const tracked = trackedKeys.get(section);
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

  // Only report a product once it has actually scrolled into view (>=50%
  // visible), batching cards that become visible together within a short
  // window instead of firing everything as soon as a tab/row renders.
  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const section = entry.target.closest('.mt-bs');
        if (!section) return;
        if (!trackedKeys.has(section)) trackedKeys.set(section, new Set());
        if (!pendingCards.has(section)) pendingCards.set(section, []);
        pendingCards.get(section).push(entry.target);
        clearTimeout(batchTimers.get(section));
        batchTimers.set(section, setTimeout(() => flushImpressions(section), BATCH_DELAY));
      });
    },
    { threshold: 0.5 }
  );

  const observeRow = (row) => {
    row.querySelectorAll('.mt-card[data-item-id]').forEach((card) => impressionObserver.observe(card));
  };

  const getPanels = (section) => {
    let state = panelState.get(section);
    if (state) return state;
    const panels = new Map();
    section.querySelectorAll('template[data-bs-panel]').forEach((template) => {
      panels.set(template.dataset.bsPanel, template.content);
      template.remove();
    });
    state = { panels, current: '0', loading: null };
    panelState.set(section, state);
    return state;
  };

  // Tabs after the first are not in the home page HTML: they carry data-bs-src and are
  // fetched once (starting on hover/touch/focus so the click usually finds them ready).
  const requests = new WeakMap();
  const loadPanel = (button) => {
    if (!button.dataset.bsSrc) return null;
    if (!requests.has(button)) {
      const section = button.closest('.mt-bs');
      const request = fetch(button.dataset.bsSrc)
        .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
        .then((html) => {
          const cards = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-bs-panel-cards]');
          if (!cards?.querySelector('.mt-card')) return null;
          const listName = `${section.dataset.bsHeading}_${button.dataset.bsLabel}`;
          cards.querySelectorAll('.mt-card[data-item-id]').forEach((card) => {
            card.dataset.itemListId = section.dataset.bsListId;
            card.dataset.itemListName = listName;
          });
          const panel = document.createDocumentFragment();
          panel.append(...cards.childNodes);
          return panel;
        })
        .catch(() => null);
      requests.set(button, request);
      // A failed request may be retried on the next attempt.
      request.then((panel) => panel || requests.delete(button));
    }
    return requests.get(button);
  };

  const prefetch = (event) => {
    const button = event.target.closest?.('.mt-bs__filter[data-bs-src]');
    if (button) loadPanel(button);
  };
  document.addEventListener('pointerover', prefetch);
  document.addEventListener('focusin', prefetch);

  const showPanel = (row, panel) => {
    if (panel) {
      panel.querySelectorAll?.('[data-reveal]').forEach((el) => {
        el.classList.remove('mt-in-view', 'mt-observed');
      });
      row.append(panel);
    }
    row.style.minHeight = '';
    row.scrollLeft = 0;
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    observeRow(row);
  };

  const setActiveTab = (section, button) => {
    section.querySelectorAll('.mt-bs__filter').forEach((item) => {
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    const cta = section.querySelector('[data-bs-cta]');
    if (cta) {
      cta.href = button.dataset.bsUrl;
      const text = cta.querySelector('[data-bs-cta-text]');
      if (text) text.textContent = (window.mtStrings?.shopCollection || 'Shop [label]').replace('[label]', button.dataset.bsLabel);
    }
  };

  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('.mt-bs__filter');
    if (!button) return;
    const section = button.closest('.mt-bs');
    const row = section.querySelector('[data-bs-row]');
    const key = button.dataset.bsTarget;
    const state = getPanels(section);
    if (key === state.current) return;

    // Hold the row's height so the page doesn't jump while a tab loads. Measure before the
    // cards are moved out; a row that is already loading keeps the height it was given.
    if (!row.style.minHeight) row.style.minHeight = `${row.offsetHeight}px`;
    // While a tab is still loading the row is empty, so there is nothing to stash for it.
    if (state.loading !== state.current) {
      const stash = document.createDocumentFragment();
      stash.append(...row.childNodes);
      state.panels.set(state.current, stash);
    }
    row.replaceChildren();
    const previous = section.querySelector(`.mt-bs__filter[data-bs-target="${state.current}"]`);
    state.current = key;
    setActiveTab(section, button);

    if (state.panels.has(key) || !button.dataset.bsSrc) {
      state.loading = null;
      showPanel(row, state.panels.get(key));
      return;
    }

    state.loading = key;
    row.setAttribute('aria-busy', 'true');
    const panel = await loadPanel(button);
    if (panel) state.panels.set(key, panel);
    if (state.current !== key) return;
    row.removeAttribute('aria-busy');
    if (panel) {
      state.loading = null;
      showPanel(row, state.panels.get(key));
    } else if (previous) {
      // Network/server failure: fall back to the tab that was showing. state.loading stays
      // on the failed tab so its empty row is not cached and the next click retries.
      previous.click();
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('[data-bs-row] .mt-card[data-item-id]');
    if (!card) return;
    const section = card.closest('.mt-bs');
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

  document.querySelectorAll('.mt-bs [data-bs-row]').forEach(observeRow);
}
