if (!window.mtQuickShopInit) {
  window.mtQuickShopInit = true;

  const strings = window.mtStrings || {};

  const reducedMq = window.mtReducedMq;
  const state = { variants: [], selected: [], colorOpt: -1, slide: 0, trigger: null };
  const addTimers = new WeakMap();

  const modal = () => document.querySelector('[data-qs]');
  const panel = () => modal()?.querySelector('[data-qs-panel]');

  const slides = () => [...(panel()?.querySelectorAll('.mt-qs__slide') || [])];
  const visibleSlides = () => slides().filter((slide) => !slide.hidden);

  const gallery = () => panel()?.querySelector('[data-qs-track]');

  const syncArrows = () => {
    const view = gallery();
    const root = panel();
    if (!view || !root) return;
    const max = view.scrollWidth - view.clientWidth;
    const items = visibleSlides();
    const nearest = items.findIndex((item) => item.offsetLeft >= view.scrollLeft - 4);
    state.slide = nearest === -1 ? Math.max(items.length - 1, 0) : nearest;
    const prev = root.querySelector('[data-qs-prev]');
    const next = root.querySelector('[data-qs-next]');
    if (!prev || !next) return;
    prev.disabled = view.scrollLeft <= 1;
    next.disabled = max <= 0 || view.scrollLeft >= max - 1;
  };

  document.addEventListener(
    'scroll',
    (event) => {
      if (event.target instanceof Element && event.target.matches('[data-qs-track]')) syncArrows();
    },
    { capture: true, passive: true }
  );

  const moveGallery = (index) => {
    const items = visibleSlides();
    const view = gallery();
    if (!items.length || !view) return;
    state.slide = Math.max(0, Math.min(index, items.length - 1));
    view.scrollTo({
      left: items[state.slide].offsetLeft,
      behavior: window.mtReducedMq.matches ? 'auto' : 'smooth',
    });
  };

  const currentVariant = () =>
    state.variants.find((variant) =>
      state.selected.every((value, i) => value == null || variant.options[i] === value)
    );

  const valueAvailable = (optIndex, value) =>
    state.variants.some(
      (variant) =>
        variant.available &&
        variant.options[optIndex] === value &&
        state.selected.every((sel, i) => i === optIndex || sel == null || variant.options[i] === sel)
    );

  // Same fallback as the PDP: if the current size has no available variant
  // for the newly picked color, jump to the first available one for that color.
  const resolveColorFallback = () => {
    const colorOpt = state.colorOpt;
    if (colorOpt < 0 || state.selected[colorOpt] == null) return;
    const current = currentVariant();
    if (current && current.available) return;
    const colorValue = state.selected[colorOpt];
    const candidates = state.variants.filter((variant) => variant.options[colorOpt] === colorValue);
    const availableVariant = candidates.find((variant) => variant.available);
    if (!availableVariant) return;
    availableVariant.options.forEach((value, index) => {
      if (index !== colorOpt) state.selected[index] = value;
    });
  };

  const syncSelection = () => {
    const root = panel();
    root.querySelectorAll('[data-qs-value]').forEach((button) => {
      const optIndex = Number(button.dataset.qsOpt);
      button.setAttribute('aria-pressed', String(state.selected[optIndex] === button.dataset.qsValue));
      if (button.classList.contains('mt-qs__pill')) {
        button.classList.toggle('mt-qs__pill--off', !valueAvailable(optIndex, button.dataset.qsValue));
      }
    });
    const variant = currentVariant();
    const add = root.querySelector('[data-qs-add]');
    if (variant) {
      add.dataset.qsVariant = variant.id;
      add.disabled = !variant.available;
      add.textContent = variant.available ? strings.addToCart : strings.soldOut;
      const price = root.querySelector('[data-qs-price]');
      if (price && variant.price) price.innerHTML = variant.price;
      const compare = root.querySelector('[data-qs-compare]');
      if (compare) {
        compare.innerHTML = variant.compare || '';
        compare.hidden = !variant.compare;
      }
    } else {
      add.disabled = true;
      add.textContent = strings.unavailable;
    }
  };

  const initPanel = (root) => {
    let variants = [];
    try {
      variants = JSON.parse(root.querySelector('[data-qs-variants]').textContent);
    } catch {
      variants = [];
    }
    state.variants = variants;
    const optionCount = variants[0]?.options.length || 0;
    state.selected = Array.from({ length: optionCount }, () => null);
    root.querySelectorAll('[data-qs-value][aria-pressed="true"]').forEach((button) => {
      state.selected[Number(button.dataset.qsOpt)] = button.dataset.qsValue;
    });
    state.slide = 0;
    const view = gallery();
    if (view) view.scrollLeft = 0;
    syncArrows();
    if (variants.length) syncSelection();
  };

  const qsItem = (card) => ({
    item_id: card.dataset.itemId,
    item_name: card.dataset.itemName,
    discount: +card.dataset.itemDiscount || 0,
    index: +card.dataset.itemIndex,
    item_list_id: card.dataset.itemListId,
    item_list_name: card.dataset.itemListName,
    ...(card.dataset.itemCategory ? { item_category: card.dataset.itemCategory } : {}),
    ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
    item_brand: card.dataset.itemBrand,
    price: +card.dataset.itemPrice,
    quantity: 1,
  });

  const qsCurrentItem = () => {
    const card = state.card;
    const variant = currentVariant();
    if (!card || !variant || !card.dataset.itemListId) return null;
    return {
      item_id: variant.sku,
      item_name: card.dataset.itemName,
      discount: variant.discountValue || 0,
      index: +card.dataset.itemIndex,
      item_list_id: card.dataset.itemListId,
      item_list_name: card.dataset.itemListName,
      ...(card.dataset.itemCategory ? { item_category: card.dataset.itemCategory } : {}),
      ...(variant.itemVariant ? { item_variant: variant.itemVariant } : {}),
      item_brand: card.dataset.itemBrand,
      price: variant.priceValue,
      quantity: 1,
    };
  };

  let opening = false;
  let openSeq = 0;
  let closeTimer = 0;

  const open = async (trigger) => {
    const card = trigger.closest('[data-quick-url]');
    const qs = modal();
    if (!card || !qs || opening) return;
    state.card = card;
    if (card.dataset.itemListId) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_item',
        event_parameters: {
          item_list_id: card.dataset.itemListId,
          item_list_name: card.dataset.itemListName,
          currency: card.closest('[data-currency]')?.dataset.currency,
          button_name: 'QUICK SHOP',
          items: [qsItem(card)],
        },
      });
    }
    opening = true;
    const seq = ++openSeq;
    clearTimeout(closeTimer);
    state.trigger = window.mtKeyboardFocus(trigger) ? trigger : null;
    const url = new URL(card.dataset.quickUrl, window.location.origin);
    url.searchParams.set('section_id', 'quick-shop');
    let doc;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    } catch {
      if (seq !== openSeq) return;
      opening = false;
      window.location.href = card.dataset.quickUrl;
      return;
    }
    if (seq !== openSeq) return;
    opening = false;
    const content = doc.querySelector('[data-qs-panel]');
    if (!content) {
      window.location.href = card.dataset.quickUrl;
      return;
    }
    qs.querySelector('[data-qs-box]').replaceChildren(content);
    initPanel(content);
    qs.hidden = false;
    if (card.dataset.itemListId) {
      const item = qsItem(card);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'view_item',
        event_parameters: {
          currency: card.closest('[data-currency]')?.dataset.currency,
          value: item.price,
          item_list_id: card.dataset.itemListId,
          item_list_name: card.dataset.itemListName,
          items: [item],
        },
      });
    }
    document.documentElement.classList.add('mt-qs-lock');
    requestAnimationFrame(() => {
      syncArrows();
      requestAnimationFrame(() => qs.classList.add('mt-qs--open'));
    });
    content.querySelector('[data-qs-close]:not(.mt-qs__close--media)')?.focus({ preventScroll: true });
  };

  const close = () => {
    const qs = modal();
    if (!qs || qs.hidden) return;
    qs.classList.remove('mt-qs--open');
    document.documentElement.classList.remove('mt-qs-lock');
    const finish = () => {
      qs.hidden = true;
      qs.querySelector('[data-qs-box]').replaceChildren();
    };
    if (reducedMq.matches) finish();
    else closeTimer = setTimeout(finish, 450);
    state.trigger?.focus({ preventScroll: true });
    state.trigger = null;
  };

  window.mtAddToCart = async (button, quantity, beforeNotify) => {
    const id = Number(button.dataset.qsVariant || button.dataset.pdpVariant || button.dataset.pairVariant);
    if (!id || button.disabled) return;
    const label = button.textContent;
    clearTimeout(addTimers.get(button));
    button.disabled = true;
    button.textContent = strings.adding;
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity }),
      });
      if (!res.ok) throw new Error(res.status);
      try {
        const cart = await (await fetch('/cart.js')).json();
        window.mtCartCount(cart.item_count);
      } catch {}
      button.textContent = strings.added;
      if (beforeNotify) beforeNotify();
      document.dispatchEvent(new CustomEvent('mt:cart-added'));
    } catch {
      button.textContent = strings.unavailable;
    }
    const settled = button.textContent;
    addTimers.set(
      button,
      setTimeout(() => {
        if (!button.isConnected || button.textContent !== settled) return;
        button.textContent = label;
        button.disabled = false;
      }, 1500)
    );
  };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('[data-qs-open]');
    if (opener) {
      event.preventDefault();
      open(opener);
      return;
    }
    const qs = modal();
    if (!qs || qs.hidden) return;
    if (event.target.closest('[data-qs-close]')) {
      close();
      return;
    }
    const prev = event.target.closest('[data-qs-prev]');
    if (prev) {
      moveGallery(state.slide - 1);
      return;
    }
    const next = event.target.closest('[data-qs-next]');
    if (next) {
      moveGallery(state.slide + 1);
      return;
    }
    const value = event.target.closest('[data-qs-value]');
    if (value) {
      const optIndex = Number(value.dataset.qsOpt);
      state.selected[optIndex] = value.dataset.qsValue;
      if (value.classList.contains('mt-qs__swatch')) {
        const name = panel().querySelector('[data-qs-color-name]');
        if (name) name.textContent = value.dataset.qsValue;
        const color = value.dataset.qsValue.toLowerCase();
        const items = slides();
        const matched = items.some((slide) => slide.dataset.color && slide.dataset.color.toLowerCase() === color);
        items.forEach((slide) => {
          slide.hidden = matched && slide.dataset.color !== '' && slide.dataset.color.toLowerCase() !== color;
        });
        const view = gallery();
        if (matched && view) {
          view.scrollTo({ left: 0, behavior: reducedMq.matches ? 'auto' : 'smooth' });
        } else if (!matched) {
          const variantMatch = state.variants.find(
            (variant) => variant.options[optIndex] === value.dataset.qsValue && variant.media
          );
          if (variantMatch) {
            const index = items.findIndex((slide) => slide.dataset.media === String(variantMatch.media));
            if (index !== -1) moveGallery(index);
          }
        }
        syncArrows();
      }
      syncSelection();
      return;
    }
    const add = event.target.closest('[data-qs-add]');
    if (add) {
      const item = qsCurrentItem();
      if (item) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event_parameters: null });
        window.dataLayer.push({
          event: 'ga4Event',
          event_name: 'add_to_cart',
          event_parameters: {
            button_name: 'Add to Cart',
            currency: state.card?.closest('[data-currency]')?.dataset.currency,
            value: item.price,
            item_list_id: item.item_list_id,
            item_list_name: item.item_list_name,
            items: [item],
          },
        });
      }
      window.mtAddToCart(add, 1, close);
      return;
    }
    const details = event.target.closest('.mt-qs__details');
    if (details) {
      const item = qsCurrentItem();
      if (item) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event_parameters: null });
        window.dataLayer.push({
          event: 'ga4Event',
          event_name: 'select_item',
          event_parameters: {
            item_list_id: item.item_list_id,
            item_list_name: item.item_list_name,
            currency: state.card?.closest('[data-currency]')?.dataset.currency,
            button_name: 'See Details',
            items: [item],
          },
        });
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    const qs = modal();
    if (event.key === 'Escape' && opening) {
      openSeq += 1;
      opening = false;
      return;
    }
    if (!qs || qs.hidden) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    window.mtFocusTrap(event, qs);
  });

  window.addEventListener('resize', () => {
    const qs = modal();
    if (qs && !qs.hidden) moveGallery(state.slide);
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    clearTimeout(closeTimer);
    openSeq += 1;
    opening = false;
    const qs = modal();
    if (!qs) return;
    qs.classList.remove('mt-qs--open');
    qs.hidden = true;
    qs.querySelector('[data-qs-box]').replaceChildren();
    document.documentElement.classList.remove('mt-qs-lock');
    state.trigger = null;
  });
}
