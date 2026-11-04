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

  bind(document);
  document.addEventListener('shopify:section:load', (event) => bind(event.target));
}
