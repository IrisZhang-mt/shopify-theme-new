if (!window.mtFeaturedInit) {
  window.mtFeaturedInit = true;

  const measure = () => {
    document.querySelectorAll('[data-fc-grid]').forEach((grid) => {
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
        row.forEach((card) => card.style.setProperty('--mt-fc-title-h', `${tallest}px`));
      });
    });
  };

  const align = () => {
    document
      .querySelectorAll('[data-fc-grid] .mt-card')
      .forEach((card) => card.style.removeProperty('--mt-fc-title-h'));
    requestAnimationFrame(measure);
  };

  let frame = 0;
  const queue = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(align);
  };

  window.addEventListener('resize', queue);
  window.addEventListener('pageshow', queue);
  document.addEventListener('shopify:section:load', queue);
  if (document.fonts?.ready) document.fonts.ready.then(queue);
  queue();

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

  // Only report a product once it has actually scrolled into view (>=50%
  // visible), batching cards that become visible together within a short
  // window — same pattern as the other product-list modules.
  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const section = entry.target.closest('.mt-fc');
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

  document.querySelectorAll('.mt-fc .mt-card[data-item-id]').forEach((card) => impressionObserver.observe(card));

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('.mt-fc .mt-card[data-item-id]');
    if (!card) return;
    const section = card.closest('.mt-fc');
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
}
