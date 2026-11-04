if (!window.mtFeaturedBlogInit) {
  window.mtFeaturedBlogInit = true;

  // Flag the stage when the row sits at either scroll edge so CSS can hide that side's arrow.
  const sync = (row) => {
    const stage = row.closest('[data-row-stage]');
    if (!stage) return;
    const max = row.scrollWidth - row.clientWidth;
    stage.toggleAttribute('data-at-start', row.scrollLeft <= 1);
    stage.toggleAttribute('data-at-end', row.scrollLeft >= max - 1);
  };

  const resize = new ResizeObserver((entries) => {
    entries.forEach((entry) => sync(entry.target));
  });

  const bind = (root) => {
    root.querySelectorAll('[data-fb-row]').forEach((row) => {
      if (row.dataset.fbBound) return;
      row.dataset.fbBound = 'true';
      let frame = 0;
      row.addEventListener(
        'scroll',
        () => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            sync(row);
          });
        },
        { passive: true }
      );
      resize.observe(row);
      sync(row);
    });
  };

  // GA4 — select_content, same shape as the Blog page (blog.js): a card sends its title as
  // content_name, the "read all" link sends its text as button_name.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('.mt-fb .mt-blog__card, .mt-fb .mt-fb__cta');
    if (!link) return;
    const card = link.classList.contains('mt-blog__card');
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'select_content',
      event_parameters: card
        ? { module_name: 'Featured Blog', content_name: link.querySelector('.mt-blog__name')?.textContent.trim() }
        : { module_name: 'Featured Blog', button_name: link.textContent.trim() },
    });

    // Hold the navigation so GTM can send the hit first (same as full-image.js);
    // new-tab clicks don't unload this page and are left alone.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setTimeout(() => {
      window.location.href = link.href;
    }, 250);
  });

  bind(document);
  document.addEventListener('shopify:section:load', (event) => bind(event.target));
}
