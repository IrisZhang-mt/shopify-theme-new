if (!window.mtCartInit) {
  window.mtCartInit = true;

  const reducedMq = window.mtReducedMq;
  const drawer = () => document.querySelector('[data-cart]');
  const quickShopOpen = () => !!document.querySelector('[data-qs]:not([hidden])');
  let busy = false;
  let trigger = null;
  let closeTimer = 0;

  const bindProgress = (wrap) => {
    const row = wrap.querySelector('[data-cart-tiles]');
    const fill = wrap.querySelector('[data-cart-progress]');
    if (!row || !fill) return;
    const update = () => {
      if (!row.isConnected) return;
      fill.style.width = `${Math.min(100, ((row.scrollLeft + row.clientWidth) / row.scrollWidth) * 100)}%`;
    };
    row.addEventListener('scroll', update, { passive: true });
    update();
  };

  const initRecs = async (root) => {
    const wrap = root.querySelector('[data-cart-recs]');
    if (!wrap || !wrap.dataset.url || wrap.dataset.loaded) return;
    wrap.dataset.loaded = 'true';
    const poolTiles = [...wrap.querySelectorAll('[data-fallback-tiles] .mt-cart__tile')];
    const poolCards = [...wrap.querySelectorAll('[data-fallback-cards] .mt-card')];
    let doc;
    try {
      const res = await fetch(wrap.dataset.url);
      if (!res.ok) throw new Error(res.status);
      doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    } catch {
      return;
    }
    const items = doc.querySelector('[data-cart-recs-items]');
    if (!items || !wrap.isConnected) return;
    const tilesRow = items.querySelector('[data-cart-tiles]');
    const cards = items.querySelector('.mt-cart__cards');
    const keyOf = (el) => el.querySelector('a')?.getAttribute('href')?.split('?')[0];
    if (tilesRow && cards) {
      const seen = new Set([...cards.querySelectorAll('.mt-card')].map(keyOf));
      for (const card of poolCards) {
        if (cards.querySelectorAll('.mt-card').length >= 8) break;
        const key = keyOf(card);
        if (!key || seen.has(key)) continue;
        const tile = poolTiles.find((t) => keyOf(t) === key);
        if (!tile) continue;
        seen.add(key);
        cards.appendChild(card);
        tilesRow.appendChild(tile);
      }
    }
    if (!items.querySelector('.mt-card')) return;
    wrap.replaceChildren(items);
    root.querySelector('[data-cart-recs-title]')?.removeAttribute('hidden');
    bindProgress(wrap);
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    const recCards = [...wrap.querySelectorAll('.mt-cart__cards .mt-card[data-item-id]')];
    if (recCards.length) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'view_item_list',
        event_parameters: {
          module_name: 'Side Cart',
          item_list_id: recCards[0].dataset.itemListId,
          item_list_name: recCards[0].dataset.itemListName,
          currency: root.dataset.currency,
          items: recCards.map((card) => ({
            item_id: card.dataset.itemId,
            item_name: card.dataset.itemName,
            discount: +card.dataset.itemDiscount || 0,
            index: +card.dataset.itemIndex,
            item_list_id: card.dataset.itemListId,
            item_list_name: card.dataset.itemListName,
            ...(card.dataset.itemVariant ? { item_variant: card.dataset.itemVariant } : {}),
            item_brand: card.dataset.itemBrand,
            price: +card.dataset.itemPrice,
            quantity: 1,
          })),
        },
      });
    }
  };

  let refreshId = 0;

  const refresh = async () => {
    const id = ++refreshId;
    const roots = [...document.querySelectorAll('[data-cart-root]')];
    await Promise.all(
      roots.map(async (root) => {
        let doc;
        try {
          const res = await fetch(root.dataset.url);
          if (!res.ok) throw new Error(res.status);
          doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        } catch {
          return;
        }
        if (id !== refreshId) return;
        const fresh = doc.querySelector('[data-cart-content]');
        const target = root.querySelector('[data-cart-content]');
        if (!fresh || !target) return;
        target.replaceWith(fresh);
        if (root.hasAttribute('data-cart') && !root.hidden) initRecs(root);
        document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      })
    );
    try {
      const cart = await (await fetch('/cart.js')).json();
      window.mtCartCount(cart.item_count);
    } catch {}
  };

  const open = (opener) => {
    const cartEl = drawer();
    if (!cartEl) return;
    if (!cartEl.hidden && cartEl.classList.contains('mt-cart--open')) return;
    clearTimeout(closeTimer);
    trigger = window.mtKeyboardFocus(opener) ? opener : null;
    cartEl.hidden = false;
    document.documentElement.classList.add('mt-cart-lock');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => cartEl.classList.add('mt-cart--open'));
    });
    initRecs(cartEl);
    cartEl.querySelector('[data-cart-close]:not(.mt-cart__backdrop)')?.focus({ preventScroll: true });
    const viewCartData = cartEl.querySelector('[data-cart-view-cart]');
    if (viewCartData) {
      try {
        const params = JSON.parse(viewCartData.textContent);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event_parameters: null });
        window.dataLayer.push({ event: 'ga4Event', event_name: 'view_cart', event_parameters: params });
      } catch {}
    }
  };

  const close = () => {
    const cartEl = drawer();
    if (!cartEl || cartEl.hidden) return;
    cartEl.classList.remove('mt-cart--open');
    document.documentElement.classList.remove('mt-cart-lock');
    const finish = () => {
      cartEl.hidden = true;
    };
    if (reducedMq.matches) finish();
    else closeTimer = setTimeout(finish, 450);
    trigger?.focus({ preventScroll: true });
    trigger = null;
  };

  const mutate = async (request) => {
    if (busy) return;
    busy = true;
    document.querySelectorAll('[data-cart-content]').forEach((el) => el.classList.add('mt-cart--busy'));
    try {
      await request();
    } catch {}
    await refresh();
    document.querySelectorAll('[data-cart-content]').forEach((el) => el.classList.remove('mt-cart--busy'));
    busy = false;
    const cartEl = drawer();
    if (cartEl && !cartEl.hidden && !cartEl.contains(document.activeElement)) {
      cartEl.querySelector('[data-cart-close]:not(.mt-cart__backdrop)')?.focus({ preventScroll: true });
    }
  };

  const change = (line, quantity) =>
    mutate(() =>
      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, quantity }),
      })
    );

  const add = (id) =>
    mutate(() =>
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: 1 }),
      })
    );

  const pushCartLineEvent = (eventName, buttonName, lineEl, deltaQty) => {
    if (!lineEl || deltaQty <= 0) return;
    const price = +lineEl.dataset.itemPrice || 0;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: eventName,
      event_parameters: {
        module_name: lineEl.dataset.moduleName,
        button_name: buttonName,
        currency: lineEl.closest('[data-cart-root]')?.dataset.currency,
        value: +(price * deltaQty).toFixed(2),
        item_list_id: lineEl.dataset.itemListId,
        item_list_name: lineEl.dataset.itemListName,
        items: [
          {
            item_list_id: lineEl.dataset.itemListId,
            item_list_name: lineEl.dataset.itemListName,
            item_id: lineEl.dataset.itemId,
            item_name: lineEl.dataset.itemName,
            index: +lineEl.dataset.itemIndex,
            ...(lineEl.dataset.itemVariant ? { item_variant: lineEl.dataset.itemVariant } : {}),
            item_brand: lineEl.dataset.itemBrand,
            price,
            quantity: deltaQty,
          },
        ],
      },
    });
  };

  document.addEventListener('click', (event) => {
    const checkout = event.target.closest?.('[data-checkout]');
    if (checkout) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'click_checkout',
        event_parameters: { module_name: checkout.dataset.moduleName },
      });
      return;
    }
    const opener = event.target.closest?.('[data-cart-open]');
    if (opener && drawer()) {
      event.preventDefault();
      open(opener);
      return;
    }
    if (event.target.closest?.('[data-cart-close]')) {
      close();
      return;
    }
    const minus = event.target.closest?.('[data-cart-minus]');
    if (minus) {
      const qty = Number(minus.parentElement.querySelector('[data-cart-qty]').textContent);
      pushCartLineEvent('remove_from_cart', 'minus', minus.closest('.mt-cart__line'), 1);
      change(Number(minus.dataset.line), Math.max(0, qty - 1));
      return;
    }
    const plus = event.target.closest?.('[data-cart-plus]');
    if (plus) {
      const qty = Number(plus.parentElement.querySelector('[data-cart-qty]').textContent);
      pushCartLineEvent('add_to_cart', 'plus', plus.closest('.mt-cart__line'), 1);
      change(Number(plus.dataset.line), qty + 1);
      return;
    }
    const remove = event.target.closest?.('[data-cart-remove]');
    if (remove) {
      const removeLine = remove.closest('.mt-cart__line');
      const qty = Number(removeLine?.querySelector('[data-cart-qty]')?.textContent) || 0;
      pushCartLineEvent('remove_from_cart', 'remove', removeLine, qty);
      change(Number(remove.dataset.line), 0);
      return;
    }
    const quickAdd = event.target.closest?.('[data-cart-add]');
    if (quickAdd) {
      add(Number(quickAdd.dataset.cartAdd));
      return;
    }
    const recsCard = event.target.closest?.(
      '[data-cart-recs] .mt-card[data-item-id], [data-cart-recs] .mt-cart__tile[data-item-id]'
    );
    if (recsCard && !event.target.closest('[data-qs-open]')) {
      const recsRoot = recsCard.closest('[data-cart-root]');
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_item',
        event_parameters: {
          module_name: 'Side Cart',
          item_list_id: recsCard.dataset.itemListId,
          item_list_name: recsCard.dataset.itemListName,
          currency: recsRoot?.dataset.currency,
          button_name: 'Product Card',
          items: [
            {
              item_id: recsCard.dataset.itemId,
              item_name: recsCard.dataset.itemName,
              discount: +recsCard.dataset.itemDiscount || 0,
              index: +recsCard.dataset.itemIndex,
              item_list_id: recsCard.dataset.itemListId,
              item_list_name: recsCard.dataset.itemListName,
              ...(recsCard.dataset.itemCategory2 ? { item_category2: recsCard.dataset.itemCategory2 } : {}),
              ...(recsCard.dataset.itemVariant ? { item_variant: recsCard.dataset.itemVariant } : {}),
              item_brand: recsCard.dataset.itemBrand,
              price: +recsCard.dataset.itemPrice,
              quantity: 1,
            },
          ],
        },
      });
    }
  });

  document.addEventListener('keydown', (event) => {
    const cartEl = drawer();
    if (!cartEl || cartEl.hidden || quickShopOpen()) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    window.mtFocusTrap(event, cartEl);
  });

  document.addEventListener('mt:cart-added', () => {
    refresh().then(() => open());
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    clearTimeout(closeTimer);
    const cartEl = drawer();
    if (!cartEl) return;
    cartEl.classList.remove('mt-cart--open');
    cartEl.hidden = true;
    document.documentElement.classList.remove('mt-cart-lock');
    trigger = null;
    refresh();
  });

  document.addEventListener('shopify:section:unload', () => {
    if (!document.querySelector('[data-cart]:not([hidden])')) {
      document.documentElement.classList.remove('mt-cart-lock');
    }
  });
}
