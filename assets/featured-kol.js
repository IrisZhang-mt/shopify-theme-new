if (!window.mtFeaturedKolInit) {
  window.mtFeaturedKolInit = true;

  // Flag the stage when the row sits at either scroll edge so CSS can hide that side's arrow.
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
    root.querySelectorAll('[data-fk-row]').forEach((row) => {
      if (row.dataset.fkBound) return;
      row.dataset.fkBound = 'true';
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

  // GA4 — view_item_list, same pattern as the other product-list modules. Cards open quick shop
  // (no product page link), so select_item / view_item / add_to_cart come from quick-shop.js.
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
    const tracked = trackedIds.get(section);
    const fresh = cards.filter((card) => !tracked.has(card.dataset.itemId));
    if (!fresh.length) return;
    fresh.forEach((card) => tracked.add(card.dataset.itemId));
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
        const section = entry.target.closest('.mt-fk');
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
    root.querySelectorAll('.mt-fk__card[data-item-id]').forEach((card) => impressionObserver.observe(card));

  bind(document);
  observe(document);
  document.addEventListener('shopify:section:load', (event) => {
    bind(event.target);
    observe(event.target);
  });
}
