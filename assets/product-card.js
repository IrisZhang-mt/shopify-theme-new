if (!window.__mtCardSwatchInit) {
  window.__mtCardSwatchInit = true;

  document.addEventListener('mouseover', (event) => {
    const swatch = event.target.closest('.mt-card__swatch');
    if (!swatch) return;
    const group = swatch.closest('.mt-card__swatches');
    group?.querySelectorAll('.mt-card__swatch').forEach((el) => el.classList.remove('is-active'));
    swatch.classList.add('is-active');
    const src = swatch.dataset.swatchSrc;
    if (!src) return;
    const img = swatch.closest('.mt-card')?.querySelector('.mt-card__media img');
    if (img) {
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
}
