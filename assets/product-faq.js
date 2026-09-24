if (!window.mtFaqInit) {
  window.mtFaqInit = true;

  const init = (scope) => {
    scope.querySelectorAll('[data-faq]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      root.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-faq-toggle]');
        if (!toggle) return;
        const item = toggle.closest('[data-faq-item]');
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        item.classList.toggle('mt-faq__item--open', open);
        if (open) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event_parameters: null });
          window.dataLayer.push({
            event: 'ga4Event',
            event_name: 'select_content',
            event_parameters: {
              content_type: 'FAQ',
              content_name: toggle.dataset.contentName,
            },
          });
        }
      });
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
