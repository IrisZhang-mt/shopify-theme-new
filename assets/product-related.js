if (!window.mtRelInit) {
  window.mtRelInit = true;

  const init = (scope) => {
    scope.querySelectorAll('[data-rel]').forEach((section) => {
      if (section.dataset.mtReady || !section.dataset.url) return;
      section.dataset.mtReady = 'true';

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
        const cards = [...section.querySelectorAll('.mt-card[data-item-id]')];
        if (cards.length) {
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
                ...(card.dataset.itemCategory ? { item_category: card.dataset.itemCategory } : {}),
                ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
                item_brand: card.dataset.itemBrand,
                price: +card.dataset.itemPrice,
                quantity: 1,
              })),
            },
          });
        }
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
  });

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
