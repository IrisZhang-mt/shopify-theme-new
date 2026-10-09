if (!window.mtFullImageInit) {
  window.mtFullImageInit = true;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-ga4-click]');
    if (!link) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: link.dataset.ga4Click,
      event_parameters: { button_name: link.dataset.ga4ButtonName },
    });

    // This link navigates immediately on click, often before GTM's
    // dataLayer listener gets a turn to actually fire the GA4 tag — hold
    // the navigation just long enough for that to happen. Clicks that open
    // in a new tab (modifier keys, middle click) don't unload this page,
    // so they're left alone.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!link.href) return;
    event.preventDefault();
    setTimeout(() => {
      window.location.href = link.href;
    }, 250);
  });
}
