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
  });
}
