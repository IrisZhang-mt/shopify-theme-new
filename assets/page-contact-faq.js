if (!window.mtContactFaqInit) {
  window.mtContactFaqInit = true;

  const init = (scope) => {
    scope.querySelectorAll('[data-contact-faq]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      root.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-contact-faq-toggle]');
        if (!toggle) return;
        const item = toggle.closest('[data-contact-faq-item]');
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        item.classList.toggle('mt-contact-faq__item--open', open);
      });
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
