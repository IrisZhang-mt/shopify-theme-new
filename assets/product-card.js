if (!window.__mtCardSwatchInit) {
  window.__mtCardSwatchInit = true;

  // Touch taps fire mouseover right before click; swapping the image there starts a
  // load that the navigation aborts, and iOS restores it broken from the bfcache.
  const canHover = window.matchMedia('(hover: hover)');

  document.addEventListener('mouseover', (event) => {
    if (!canHover.matches) return;
    const swatch = event.target.closest('.mt-card__swatch');
    if (!swatch) return;
    const group = swatch.closest('.mt-card__swatches');
    const swatches = group ? [...group.querySelectorAll('.mt-card__swatch')] : [];
    if (group && group.dataset.mtActive === undefined) {
      group.dataset.mtActive = swatches.findIndex((el) => el.classList.contains('is-active'));
    }
    swatches.forEach((el) => el.classList.remove('is-active'));
    swatch.classList.add('is-active');
    const src = swatch.dataset.swatchSrc;
    if (!src) return;
    const img = swatch.closest('.mt-card')?.querySelector('.mt-card__media img');
    if (img) {
      if (img.dataset.mtSrc === undefined) {
        img.dataset.mtSrc = img.getAttribute('src') || '';
        img.dataset.mtSrcset = img.getAttribute('srcset') || '';
      }
      img.src = src;
      img.srcset = src;
    }
  });

  document.addEventListener('click', (event) => {
    const swatch = event.target.closest('.mt-card__swatch');
    if (!swatch?.dataset.swatchHref) return;
    event.preventDefault();
    window.location.href = swatch.dataset.swatchHref;
  });

  // Back/forward restore: put cards back to their server-rendered state and retry
  // images whose load was aborted by the navigation.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll('.mt-card__swatches[data-mt-active]').forEach((group) => {
      const active = Number(group.dataset.mtActive);
      group.querySelectorAll('.mt-card__swatch').forEach((el, i) => el.classList.toggle('is-active', i === active));
      delete group.dataset.mtActive;
    });
    document.querySelectorAll('.mt-card__media img').forEach((img) => {
      const restore = img.dataset.mtSrc !== undefined;
      const broken = img.complete && img.naturalWidth === 0;
      if (!restore && !broken) return;
      const src = restore ? img.dataset.mtSrc : img.getAttribute('src');
      const srcset = restore ? img.dataset.mtSrcset : img.getAttribute('srcset');
      if (srcset) img.setAttribute('srcset', srcset);
      else img.removeAttribute('srcset');
      if (src) img.setAttribute('src', src);
      delete img.dataset.mtSrc;
      delete img.dataset.mtSrcset;
    });
  });
}
