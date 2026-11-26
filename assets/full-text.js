if (!window.mtFullTextInit) {
  window.mtFullTextInit = true;

  // GA4 — links_entry for links inside the rich text, same as the blog post body (article.js).
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.mt-full-text__text a[href]');
    if (!link) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'links_entry',
      event_parameters: {
        button_name: link.textContent.trim(),
      },
    });

    // Hold the navigation so GTM can send the hit first (same as full-image.js); new-tab
    // clicks, target="_blank" links and in-page anchors don't unload this page.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank' || link.getAttribute('href').startsWith('#')) return;
    event.preventDefault();
    setTimeout(() => {
      window.location.href = link.href;
    }, 250);
  });
}
