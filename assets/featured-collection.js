if (!window.mtFeaturedInit) {
  window.mtFeaturedInit = true;

  const measure = () => {
    document.querySelectorAll('[data-fc-grid]').forEach((grid) => {
      const rows = new Map();
      grid.querySelectorAll('.mt-card').forEach((card) => {
        const key = card.offsetTop;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(card);
      });
      rows.forEach((row) => {
        let tallest = 0;
        row.forEach((card) => {
          const title = card.querySelector('.mt-card__title');
          if (title) tallest = Math.max(tallest, title.offsetHeight);
        });
        if (!tallest) return;
        row.forEach((card) => card.style.setProperty('--mt-fc-title-h', `${tallest}px`));
      });
    });
  };

  const align = () => {
    document
      .querySelectorAll('[data-fc-grid] .mt-card')
      .forEach((card) => card.style.removeProperty('--mt-fc-title-h'));
    requestAnimationFrame(measure);
  };

  let frame = 0;
  const queue = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(align);
  };

  window.addEventListener('resize', queue);
  window.addEventListener('pageshow', queue);
  document.addEventListener('shopify:section:load', queue);
  if (document.fonts?.ready) document.fonts.ready.then(queue);
  queue();
}
