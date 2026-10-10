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

  // A card image that fails (flaky mobile network) is never retried by the browser on
  // its own. Retry with a cache-busting param, since WebKit can otherwise reuse the
  // failed response for the same URL.
  const RETRY_DELAYS = [1000, 3000, 6000];
  const CARD_IMG = '.mt-card__media img';
  const isBroken = (img) => img.complete && img.naturalWidth === 0;
  const withRetry = (url, n) => {
    const clean = url.replace(/[?&]mt_retry=\d+/, '');
    return `${clean}${clean.includes('?') ? '&' : '?'}mt_retry=${n}`;
  };

  const retryImage = (img) => {
    const tries = Number(img.dataset.mtRetry || 0);
    if (tries >= RETRY_DELAYS.length || img.dataset.mtRetryPending) return;
    img.dataset.mtRetryPending = '1';
    setTimeout(() => {
      delete img.dataset.mtRetryPending;
      if (!img.isConnected || !isBroken(img)) return;
      img.dataset.mtRetry = tries + 1;
      const srcset = img.getAttribute('srcset');
      const src = img.getAttribute('src');
      if (srcset) {
        const busted = srcset.split(',').map((part) => {
          const [url, ...descriptor] = part.trim().split(/\s+/);
          return [withRetry(url, tries + 1), ...descriptor].join(' ');
        });
        img.setAttribute('srcset', busted.join(', '));
      }
      if (src) img.setAttribute('src', withRetry(src, tries + 1));
    }, RETRY_DELAYS[tries]);
  };

  // error doesn't bubble, so listen in the capture phase.
  document.addEventListener(
    'error',
    (event) => {
      if (event.target instanceof HTMLImageElement && event.target.matches(CARD_IMG)) retryImage(event.target);
    },
    true
  );

  // Safety net for a missed error event: check each image as it scrolls into view.
  // Images stop being watched once they load, so the observer only holds pending ones.
  const viewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.complete && img.naturalWidth > 0) viewObserver.unobserve(img);
      else if (isBroken(img)) retryImage(img);
    });
  });
  const watchImages = () => {
    document.querySelectorAll(CARD_IMG).forEach((img) => {
      if (img.dataset.mtWatched) return;
      img.dataset.mtWatched = '1';
      if (!(img.complete && img.naturalWidth > 0)) viewObserver.observe(img);
    });
  };
  document.addEventListener(
    'load',
    (event) => {
      if (event.target instanceof HTMLImageElement && event.target.matches(CARD_IMG)) viewObserver.unobserve(event.target);
    },
    true
  );
  // Cards inserted later (pagination, tabs, recommendations) announce themselves here.
  document.addEventListener('mt:reveal-scan', watchImages);
  watchImages();

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
      delete img.dataset.mtRetry;
    });
  });
}
