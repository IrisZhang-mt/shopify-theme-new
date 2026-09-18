if (!window.mtSplitInit) {
  window.mtSplitInit = true;

  document.querySelectorAll('.mt-split__tile[data-banner-slot]').forEach((tile) => {
    if (tile.dataset.bannerTracked) return;
    tile.dataset.bannerTracked = 'true';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_banner',
      event_parameters: {
        module_name: 'Mid Banner',
        banner_slot: tile.dataset.bannerSlot,
        banner_name: tile.dataset.bannerName,
      },
    });
  });

  document.addEventListener('click', (event) => {
    const tile = event.target.closest?.('a.mt-split__tile[data-banner-slot]');
    if (!tile) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'click_banner',
      event_parameters: {
        module_name: 'Mid Banner',
        banner_slot: tile.dataset.bannerSlot,
        banner_name: tile.dataset.bannerName,
        button_name: tile.dataset.buttonName,
      },
    });
  });
}
