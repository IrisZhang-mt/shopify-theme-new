if (!window.mtBestSellersInit) {
  window.mtBestSellersInit = true;

  const panelState = new WeakMap();
  const lastTracked = new WeakMap();

  const trackList = (section, row) => {
    const cards = [...row.querySelectorAll('.mt-card[data-item-id]')];
    if (!cards.length) return;
    const ids = cards.map((card) => card.dataset.itemId).join(',');
    if (lastTracked.get(section) === ids) return;
    lastTracked.set(section, ids);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_item_list',
      event_parameters: {
        item_list_id: cards[0].dataset.itemListId,
        item_list_name: cards[0].dataset.itemListName,
        currency: section.dataset.currency,
        items: cards.map((card) => ({
          item_id: card.dataset.itemId,
          item_name: card.dataset.itemName,
          discount: +card.dataset.itemDiscount || 0,
          index: +card.dataset.itemIndex,
          item_list_id: card.dataset.itemListId,
          item_list_name: card.dataset.itemListName,
          ...(card.dataset.itemCategory2 ? { item_category2: card.dataset.itemCategory2 } : {}),
          ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
          item_brand: card.dataset.itemBrand,
          price: +card.dataset.itemPrice,
          quantity: 1,
        })),
      },
    });
  };

  const getPanels = (section) => {
    let state = panelState.get(section);
    if (state) return state;
    const panels = new Map();
    section.querySelectorAll('template[data-bs-panel]').forEach((template) => {
      panels.set(template.dataset.bsPanel, template.content);
      template.remove();
    });
    state = { panels, current: '0' };
    panelState.set(section, state);
    return state;
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.mt-bs__filter');
    if (!button) return;
    const section = button.closest('.mt-bs');
    const row = section.querySelector('[data-bs-row]');
    const key = button.dataset.bsTarget;
    const state = getPanels(section);
    if (key === state.current) return;

    const stash = document.createDocumentFragment();
    stash.append(...row.childNodes);
    state.panels.set(state.current, stash);

    const next = state.panels.get(key);
    if (next) {
      next.querySelectorAll?.('[data-reveal]').forEach((el) => {
        el.classList.remove('mt-in-view', 'mt-observed');
      });
      row.append(next);
    }
    state.current = key;
    row.scrollLeft = 0;

    section.querySelectorAll('.mt-bs__filter').forEach((item) => {
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    const cta = section.querySelector('[data-bs-cta]');
    if (cta) {
      cta.href = button.dataset.bsUrl;
      const text = cta.querySelector('[data-bs-cta-text]');
      if (text) text.textContent = (window.mtStrings?.shopCollection || 'Shop [label]').replace('[label]', button.dataset.bsLabel);
    }
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
  });
}
