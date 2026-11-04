if (!window.mtKolVideoInit) {
  window.mtKolVideoInit = true;

  const desktopMq = window.matchMedia('(min-width: 750px)');
  const VISIBLE_RATIO = 0.25;

  // Only one KOL video plays at a time, across every instance on the page.
  let current = null;

  const videoOf = (card) => card.querySelector('.mt-kol__video');

  // Pause a playing video once it scrolls or slides mostly out of view.
  const visibility = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio < VISIBLE_RATIO) videoOf(entry.target)?.pause();
      });
    },
    { threshold: VISIBLE_RATIO }
  );

  // Removes the <video> entirely (drops its decoder + buffer) and restores the poster.
  const reset = (card) => {
    const video = videoOf(card);
    if (video) {
      visibility.unobserve(video.parentElement);
      video.pause();
      video.remove();
    }
    card.removeAttribute('data-playing');
    card.querySelector('[data-kol-overlay]')?.removeAttribute('inert');
    if (current === card) current = null;
  };

  const play = (card) => {
    if (current && current !== card) videoOf(current)?.pause();

    const media = card.querySelector('[data-kol-media]');
    const overlay = card.querySelector('[data-kol-overlay]');
    const template = card.querySelector(`[data-kol-video="${desktopMq.matches ? 'pc' : 'mb'}"]`);
    if (!media || !template) return;

    // Sources live in an inert <template> so nothing is fetched until this click.
    const video = template.content.querySelector('video').cloneNode(true);
    const poster = media.querySelector('.mt-kol__poster');
    if (poster?.currentSrc) video.poster = poster.currentSrc;
    video.addEventListener('play', () => {
      if (current && current !== card) videoOf(current)?.pause();
      current = card;
    });
    media.insertBefore(video, overlay);

    card.setAttribute('data-playing', '');
    overlay?.setAttribute('inert', '');
    current = card;
    visibility.observe(media);

    video.play().catch(() => reset(card));
    video.focus({ preventScroll: true });
  };

  // GA4 — view_item_list / select_item for the products under the cards, same pattern as
  // the other product-list modules.
  const trackedIds = new WeakMap();
  const pendingItems = new WeakMap();
  const batchTimers = new WeakMap();
  const BATCH_DELAY = 300;

  const buildItem = (el) => ({
    item_id: el.dataset.itemId,
    item_name: el.dataset.itemName,
    discount: +el.dataset.itemDiscount || 0,
    index: +el.dataset.itemIndex,
    item_list_id: el.dataset.itemListId,
    item_list_name: el.dataset.itemListName,
    ...(el.dataset.itemCategory ? { item_category: el.dataset.itemCategory } : {}),
    ...(el.dataset.itemVariant ? { item_variant: el.dataset.itemVariant } : {}),
    item_brand: el.dataset.itemBrand,
    price: +el.dataset.itemPrice,
    quantity: 1,
  });

  const flushImpressions = (section) => {
    const items = pendingItems.get(section) || [];
    pendingItems.set(section, []);
    const tracked = trackedIds.get(section);
    const fresh = items.filter((el) => !tracked.has(el.dataset.itemIndex));
    if (!fresh.length) return;
    fresh.forEach((el) => tracked.add(el.dataset.itemIndex));
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_item_list',
      event_parameters: {
        item_list_id: fresh[0].dataset.itemListId,
        item_list_name: fresh[0].dataset.itemListName,
        currency: section.dataset.currency,
        items: fresh.map(buildItem),
      },
    });
  };

  const impressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        impressionObserver.unobserve(entry.target);
        const section = entry.target.closest('[data-kol]');
        if (!section) return;
        if (!trackedIds.has(section)) trackedIds.set(section, new Set());
        if (!pendingItems.has(section)) pendingItems.set(section, []);
        pendingItems.get(section).push(entry.target);
        clearTimeout(batchTimers.get(section));
        batchTimers.set(section, setTimeout(() => flushImpressions(section), BATCH_DELAY));
      });
    },
    { threshold: 0.5 }
  );

  document.addEventListener('click', (event) => {
    const item = event.target.closest?.('[data-kol] .mt-kol__product[data-item-id]');
    if (!item || !event.target.closest('a')) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'select_item',
      event_parameters: {
        item_list_id: item.dataset.itemListId,
        item_list_name: item.dataset.itemListName,
        currency: item.closest('[data-kol]')?.dataset.currency,
        button_name: 'Product Card',
        items: [buildItem(item)],
      },
    });
  });

  const setup = (root) => {
    if (root.dataset.mtReady) return;
    root.dataset.mtReady = 'true';

    const track = root.querySelector('[data-kol-track]');
    const cards = Array.from(root.querySelectorAll('[data-kol-card]'));
    if (!track || !cards.length) return;

    cards.forEach((card) => {
      card.querySelector('[data-kol-play]')?.addEventListener('click', () => {
        play(card);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event_parameters: null });
        window.dataLayer.push({
          event: 'ga4Event',
          event_name: 'select_content',
          event_parameters: {
            module_name: 'KOL Video',
            content_name: card.querySelector('.mt-kol__heading')?.textContent.trim(),
            button_name: 'Play',
          },
        });
      });
    });
    root.querySelectorAll('.mt-kol__product[data-item-id]').forEach((item) => impressionObserver.observe(item));

    // Crossing the breakpoint would leave the wrong (PC vs mobile) source in place.
    desktopMq.addEventListener('change', () => cards.forEach(reset));

    // Theme editor: bring the selected card into view on mobile.
    root.addEventListener('shopify:block:select', (event) => {
      if (!desktopMq.matches) event.target.scrollIntoView({ block: 'nearest', inline: 'start' });
    });

    const prevBtn = root.querySelector('[data-kol-arrow="prev"]');
    const nextBtn = root.querySelector('[data-kol-arrow="next"]');
    if (!prevBtn || !nextBtn) return;

    const step = () => cards[0].offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
    const syncArrows = () => {
      prevBtn.disabled = track.scrollLeft <= 1;
      nextBtn.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
    };

    prevBtn.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', syncArrows, { passive: true });
    syncArrows();
  };

  const initAll = (scope) => {
    scope.querySelectorAll('[data-kol]').forEach(setup);
  };

  initAll(document);
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
}
