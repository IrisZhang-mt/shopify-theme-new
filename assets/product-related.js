if (!window.mtRelInit) {
  window.mtRelInit = true;

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
  // window instead of firing one event per card.
  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const section = entry.target.closest('[data-rel]');
        if (!section) return;
        if (!pendingCards.has(section)) pendingCards.set(section, []);
        pendingCards.get(section).push(entry.target);
        clearTimeout(batchTimers.get(section));
        batchTimers.set(section, setTimeout(() => flushImpressions(section), BATCH_DELAY));
      });
    },
    { threshold: 0.5 }
  );

  const init = (scope) => {
    scope.querySelectorAll('[data-rel]').forEach((section) => {
      if (section.dataset.mtReady || !section.dataset.url) return;
      section.dataset.mtReady = 'true';
      trackedIds.set(section, new Set());

      const load = async () => {
        const pool = [...section.querySelectorAll('[data-rel-fallback] .mt-card')];
        let fresh = null;
        try {
          const res = await fetch(section.dataset.url);
          if (!res.ok) throw new Error(res.status);
          const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
          fresh = doc.querySelector('[data-rel]');
        } catch {
          fresh = null;
        }
        if (!section.isConnected) return;
        const row = fresh ? fresh.querySelector('.mt-pdp-rel__row') : null;
        if (row) {
          const keyOf = (card) => card.querySelector('.mt-card__link')?.getAttribute('href')?.split('?')[0];
          const seen = new Set([...row.querySelectorAll('.mt-card')].map(keyOf));
          for (const card of pool) {
            if (row.querySelectorAll('.mt-card').length >= 8) break;
            const key = keyOf(card);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            row.appendChild(card);
          }
        }
        if (!fresh || !fresh.querySelector('.mt-card')) {
          section.hidden = true;
          return;
        }
        section.replaceChildren(...fresh.children);
        section.classList.remove('mt-pdp-rel--pending');
        document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
        section.querySelectorAll('.mt-card[data-item-id]').forEach((card) => impressionObserver.observe(card));
      };

      load();
    });
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('[data-rel] .mt-card[data-item-id]');
    if (!card) return;
    const section = card.closest('[data-rel]');
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

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
