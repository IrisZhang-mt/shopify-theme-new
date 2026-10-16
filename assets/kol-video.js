if (!window.mtKolVideoInit) {
  window.mtKolVideoInit = true;

  const desktopMq = window.matchMedia('(min-width: 750px)');

  // Only one KOL video plays at a time, across every instance on the page.
  let current = null;

  const stop = (card) => {
    const video = card.querySelector('.mt-kol__video');
    if (video) {
      video.pause();
      video.remove(); // drop the decoder + buffered data; the poster shows again
    }
    card.removeAttribute('data-playing');
    if (current === card) current = null;
  };

  // Pause (and tear down) a playing video once it scrolls or slides out of view.
  const visibility = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          visibility.unobserve(entry.target);
          stop(entry.target.closest('[data-kol-card]'));
        }
      });
    },
    { threshold: 0.25 }
  );

  const play = (card) => {
    if (current && current !== card) stop(current);

    const media = card.querySelector('[data-kol-media]');
    const template = card.querySelector(`[data-kol-video="${desktopMq.matches ? 'pc' : 'mb'}"]`);
    if (!media || !template) return;

    const video = template.content.querySelector('video').cloneNode(true);
    const poster = media.querySelector('.mt-kol__poster');
    if (poster?.currentSrc) video.poster = poster.currentSrc;
    media.insertBefore(video, media.querySelector('[data-kol-overlay]'));

    card.setAttribute('data-playing', '');
    current = card;
    visibility.observe(media);

    video.play().catch(() => stop(card));
    video.focus({ preventScroll: true });
  };

  const setup = (root) => {
    if (root.dataset.mtReady) return;
    root.dataset.mtReady = 'true';

    const track = root.querySelector('[data-kol-track]');
    const cards = Array.from(root.querySelectorAll('[data-kol-card]'));
    if (!track || !cards.length) return;

    cards.forEach((card) => {
      card.querySelector('[data-kol-play]')?.addEventListener('click', () => play(card));
    });

    // Switching breakpoint mid-play would leave the wrong-size source running.
    desktopMq.addEventListener('change', () => {
      cards.forEach((card) => {
        if (card.hasAttribute('data-playing')) stop(card);
      });
    });

    const prevBtn = root.querySelector('[data-kol-arrow="prev"]');
    const nextBtn = root.querySelector('[data-kol-arrow="next"]');
    if (!prevBtn || !nextBtn) return;

    const step = () => cards[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
    const syncArrows = () => {
      const max = track.scrollWidth - track.clientWidth - 1;
      prevBtn.disabled = track.scrollLeft <= 1;
      nextBtn.disabled = track.scrollLeft >= max;
    };

    prevBtn.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', syncArrows, { passive: true });
    syncArrows();

    // Theme editor: bring the selected card into view on mobile.
    root.addEventListener('shopify:block:select', (event) => {
      if (desktopMq.matches) return;
      track.scrollTo({ left: event.target.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    });
  };

  const initAll = (scope) => {
    scope.querySelectorAll('[data-kol]').forEach(setup);
  };

  initAll(document);
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
}
