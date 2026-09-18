if (!window.mtSearchResultsInit) {
  window.mtSearchResultsInit = true;

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open]')) return;
    const card = event.target.closest?.('[data-srp] .mt-card[data-item-id]');
    if (!card) return;
    const section = card.closest('[data-srp]');
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
            ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
            item_brand: card.dataset.itemBrand,
            price: +card.dataset.itemPrice,
            quantity: 1,
          },
        ],
      },
    });
  });
}
