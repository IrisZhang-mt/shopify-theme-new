if (!window.mtRowProgressInit) {
  window.mtRowProgressInit = true;

  const bars = new WeakMap();

  const sync = (row) => {
    const progress = bars.get(row);
    if (!progress) return;
    const max = row.scrollWidth - row.clientWidth;
    progress.hidden = max <= 1;
    if (progress.hidden) return;
    progress.style.setProperty('--mt-progress-size', (row.clientWidth / row.scrollWidth).toFixed(4));
    progress.style.setProperty('--mt-progress-pos', Math.min(Math.max(row.scrollLeft / max, 0), 1).toFixed(4));
  };

  const resize = new ResizeObserver((entries) => {
    entries.forEach((entry) => sync(entry.target));
  });

  const bind = (root) => {
    root.querySelectorAll('[data-row-progress]').forEach((progress) => {
      const row = progress.closest('[data-row-stage]')?.querySelector('[data-progress-row]');
      if (!row || row.dataset.progressBound) return;
      row.dataset.progressBound = 'true';
      bars.set(row, progress);
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
