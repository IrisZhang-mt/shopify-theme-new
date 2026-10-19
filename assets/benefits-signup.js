if (!window.mtBenefitsSignupInit) {
  window.mtBenefitsSignupInit = true;

  // The customer form redirects back with ?mt-signup=<section id> on success
  // (see return_to in the section). Liquid can't read the query string, so the
  // subscribed state is switched on here — scoped to the section that posted,
  // so the footer form and other instances stay untouched.
  const boot = () => {
    const id = new URLSearchParams(window.location.search).get('mt-signup');
    if (!id) return;
    const el = document.querySelector(`[data-benefits][data-section-id="${CSS.escape(id)}"]`);
    if (!el) return;

    el.querySelector('[data-benefits-field]')?.setAttribute('hidden', '');
    el.querySelector('[data-benefits-done]')?.removeAttribute('hidden');
    el.querySelector('[data-benefits-consent]')?.setAttribute('hidden', '');

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'subscribe',
      event_parameters: { module_name: el.dataset.benefitsModule },
    });

    window.mtStripParams?.(['mt-signup']);
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
  };

  boot();
}
