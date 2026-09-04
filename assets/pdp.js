if (!window.mtPdpInit) {
  window.mtPdpInit = true;

  const strings = window.mtStrings || {};

  const reducedMq = window.mtReducedMq;
  const deskMq = window.matchMedia('(min-width: 750px)');
  const updaters = new Set();

  const runUpdaters = () => {
    updaters.forEach((update) => {
      if (!update()) updaters.delete(update);
    });
  };

  const readVariants = (root, selector) => {
    try {
      return JSON.parse(root.querySelector(selector).textContent);
    } catch {
      return [];
    }
  };

  const matchVariant = (variants, selected) =>
    variants.find((variant) =>
      selected.every((value, i) => value == null || variant.options[i] === value)
    );

  const valueAvailable = (variants, selected, optIndex, value) =>
    variants.some(
      (variant) =>
        variant.available &&
        variant.options[optIndex] === value &&
        selected.every((sel, i) => i === optIndex || sel == null || variant.options[i] === sel)
    );

  const readSelected = (root, selector, optKey, valueKey) => {
    const buttons = [...root.querySelectorAll(selector)];
    const count = buttons.reduce((max, button) => Math.max(max, Number(button.dataset[optKey]) + 1), 0);
    const selected = Array.from({ length: count }, () => null);
    buttons.forEach((button) => {
      if (button.getAttribute('aria-pressed') === 'true') {
        selected[Number(button.dataset[optKey])] = button.dataset[valueKey];
      }
    });
    return selected;
  };

  const initProduct = (root) => {
    const variants = readVariants(root, '[data-pdp-variants]');
    const track = root.querySelector('[data-pdp-track]');
    const state = {
      variants,
      selected: readSelected(root, '[data-pdp-value]', 'pdpOpt', 'pdpValue'),
      qty: 1,
      interacted: false,
    };

    const sync = () => {
      root.querySelectorAll('[data-pdp-value]').forEach((button) => {
        const optIndex = Number(button.dataset.pdpOpt);
        button.setAttribute('aria-pressed', String(state.selected[optIndex] === button.dataset.pdpValue));
        if (button.classList.contains('mt-pdp__pill')) {
          button.classList.toggle(
            'mt-pdp__pill--off',
            !valueAvailable(state.variants, state.selected, optIndex, button.dataset.pdpValue)
          );
        }
      });
      const variant = matchVariant(state.variants, state.selected);
      const add = root.querySelector('[data-pdp-add]');
      if (!add) return;
      if (variant) {
        add.dataset.pdpVariant = variant.id;
        add.disabled = !variant.available;
        add.textContent = variant.available ? strings.addToCart : strings.soldOut;
        const price = root.querySelector('[data-pdp-price]');
        if (price) price.innerHTML = variant.price;
        const compare = root.querySelector('[data-pdp-compare]');
        if (compare) {
          compare.innerHTML = variant.compare || '';
          compare.hidden = !variant.compare;
        }
        const sku = root.querySelector('[data-pdp-sku]');
        if (sku) {
          sku.querySelector('[data-pdp-sku-value]').textContent = variant.sku || '';
          sku.hidden = !variant.sku;
        }
        if (state.interacted) {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          try {
            history.replaceState(history.state, '', url);
          } catch {}
          if (variant.media > 0 && track && !deskMq.matches) {
            const slide = track.querySelector(`[data-pdp-media="${variant.media}"]`);
            if (slide) {
              track.scrollTo({ left: slide.offsetLeft, behavior: reducedMq.matches ? 'auto' : 'smooth' });
            }
          }
        }
      } else {
        add.disabled = true;
        add.textContent = strings.unavailable;
      }
    };

    const arrows = () => {
      const prev = root.querySelector('[data-pdp-prev]');
      const next = root.querySelector('[data-pdp-next]');
      if (!prev || !next || !track) return;
      const update = () => {
        if (!track.isConnected) return false;
        prev.disabled = track.scrollLeft <= 1;
        next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
        return true;
      };
      const step = (dir) => {
        const slide = track.querySelector('.mt-pdp__slide');
        if (!slide) return;
        track.scrollBy({
          left: dir * (slide.offsetWidth + 5),
          behavior: reducedMq.matches ? 'auto' : 'smooth',
        });
      };
      prev.addEventListener('click', () => step(-1));
      next.addEventListener('click', () => step(1));
      track.addEventListener('scroll', update, { passive: true });
      updaters.add(update);
      update();
    };

    root.addEventListener('click', (event) => {
      const value = event.target.closest('[data-pdp-value]');
      if (value) {
        state.interacted = true;
        const optIndex = Number(value.dataset.pdpOpt);
        state.selected[optIndex] = value.dataset.pdpValue;
        const name = value.closest('.mt-pdp__option')?.querySelector('.mt-pdp__label span');
        if (name) name.textContent = value.dataset.pdpValue;
        sync();
        return;
      }
      const tilesToggle = event.target.closest('[data-pdp-tiles-toggle]');
      if (tilesToggle) {
        const tiles = root.querySelector('[data-pdp-tiles]');
        const open = tilesToggle.getAttribute('aria-expanded') !== 'true';
        tilesToggle.setAttribute('aria-expanded', String(open));
        tiles?.classList.toggle('mt-pdp__tiles--collapsed', !open);
        tilesToggle.querySelector('[data-pdp-tiles-more]').hidden = open;
        tilesToggle.querySelector('[data-pdp-tiles-less]').hidden = !open;
        return;
      }
      const toggle = event.target.closest('[data-pdp-toggle]');
      if (toggle) {
        const panel = document.getElementById(toggle.getAttribute('aria-controls'));
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        panel?.classList.toggle('mt-open', open);
        return;
      }
      const qtyEl = root.querySelector('[data-pdp-qty]');
      if (qtyEl && event.target.closest('[data-pdp-minus]')) {
        state.qty = Math.max(1, state.qty - 1);
        qtyEl.textContent = state.qty;
        return;
      }
      if (qtyEl && event.target.closest('[data-pdp-plus]')) {
        state.qty = Math.min(99, state.qty + 1);
        qtyEl.textContent = state.qty;
        return;
      }
      const add = event.target.closest('[data-pdp-add]');
      if (add) window.mtAddToCart(add, state.qty);
    });

    const defaultColor = root.dataset.pdpDefaultColor;
    if (defaultColor) {
      const match = [...root.querySelectorAll('[data-pdp-tiles] [data-pdp-value]')].find(
        (button) => button.dataset.pdpValue === defaultColor
      );
      if (match) {
        state.selected[Number(match.dataset.pdpOpt)] = defaultColor;
        const name = match.closest('.mt-pdp__option')?.querySelector('.mt-pdp__label span');
        if (name) name.textContent = defaultColor;
      }
    }

    const tiles = root.querySelector('[data-pdp-tiles]');
    const tilesToggle = root.querySelector('[data-pdp-tiles-toggle]');
    if (tiles && tilesToggle) {
      const update = () => {
        if (!tiles.isConnected) return false;
        if (tilesToggle.getAttribute('aria-expanded') !== 'true') {
          tiles.classList.add('mt-pdp__tiles--collapsed');
          tilesToggle.hidden = tiles.scrollHeight <= tiles.clientHeight + 1;
        }
        return true;
      };
      updaters.add(update);
      update();
    }

    if (variants.length) sync();
    arrows();
  };

  const initPair = (pair) => {
    const variants = readVariants(pair, '[data-pair-variants]');
    const state = { variants, selected: readSelected(pair, '[data-pair-value]', 'pairOpt', 'pairValue') };

    const sync = () => {
      pair.querySelectorAll('[data-pair-value]').forEach((button) => {
        const optIndex = Number(button.dataset.pairOpt);
        button.setAttribute('aria-pressed', String(state.selected[optIndex] === button.dataset.pairValue));
        if (button.classList.contains('mt-pair__pill')) {
          button.classList.toggle(
            'mt-pair__pill--off',
            !valueAvailable(state.variants, state.selected, optIndex, button.dataset.pairValue)
          );
        }
      });
      const variant = matchVariant(state.variants, state.selected);
      const add = pair.querySelector('[data-pair-add]');
      if (!add) return;
      if (variant) {
        add.dataset.pairVariant = variant.id;
        add.disabled = !variant.available;
        add.textContent = variant.available ? strings.addToCart : strings.soldOut;
        const image = pair.querySelector('.mt-pair__media img');
        if (variant.image && image && image.src !== variant.image) {
          image.srcset = '';
          image.src = variant.image;
        }
      } else {
        add.disabled = true;
        add.textContent = strings.unavailable;
      }
    };

    pair.addEventListener('click', (event) => {
      const value = event.target.closest('[data-pair-value]');
      if (value) {
        const optIndex = Number(value.dataset.pairOpt);
        state.selected[optIndex] = value.dataset.pairValue;
        if (value.classList.contains('mt-pair__swatch')) {
          const name = pair.querySelector('[data-pair-color-name]');
          if (name) name.textContent = value.dataset.pairValue;
        }
        sync();
        return;
      }
      const add = event.target.closest('[data-pair-add]');
      if (add) window.mtAddToCart(add, 1);
    });

    if (variants.length) sync();
  };

  const initPairs = (root) => {
    const wrap = root.querySelector('[data-pdp-pairs]');
    if (!wrap || !wrap.dataset.url) return;
    const load = async () => {
      const pool = [...wrap.querySelectorAll('[data-pdp-pairs-fallback] [data-pair]')];
      let doc = null;
      try {
        const res = await fetch(wrap.dataset.url);
        if (!res.ok) throw new Error(res.status);
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      } catch {
        doc = null;
      }
      if (!wrap.isConnected) return;
      const target = wrap.querySelector('[data-pdp-pairs-items]');
      if (!target) return;
      const fetched = doc ? [...doc.querySelectorAll('[data-pdp-pairs-items] [data-pair]')] : [];
      const keyOf = (pair) => pair.querySelector('.mt-pair__details')?.getAttribute('href')?.split('?')[0];
      const seen = new Set();
      const picks = [];
      for (const pair of [...fetched, ...pool]) {
        if (picks.length >= 2) break;
        const key = keyOf(pair);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        picks.push(pair);
      }
      if (!picks.length) return;
      target.replaceChildren(...picks);
      wrap.hidden = false;
      picks.forEach(initPair);
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    };
    load();
  };

  const initSticky = (root) => {
    const cols = [...root.querySelectorAll('[data-pdp-col]')];
    if (!cols.length) return;
    const apply = () => {
      if (!cols[0].isConnected) {
        observer.disconnect();
        return false;
      }
      const header = document.querySelector('.mt-header');
      const headerH = header ? header.offsetHeight : 38;
      cols.forEach((col) => {
        if (!deskMq.matches) {
          col.style.removeProperty('--mt-stick');
          return;
        }
        const top = Math.min(headerH, window.innerHeight - col.offsetHeight);
        col.style.setProperty('--mt-stick', `${Math.round(top)}px`);
      });
      return true;
    };
    const observer = new ResizeObserver(apply);
    cols.forEach((col) => observer.observe(col));
    updaters.add(apply);
    apply();
  };

  const init = (scope) => {
    scope.querySelectorAll('[data-pdp]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      initProduct(root);
      initSticky(root);
      initPairs(root);
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
  window.addEventListener('resize', runUpdaters);
  deskMq.addEventListener('change', runUpdaters);

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    runUpdaters();
    document.querySelectorAll('[data-pdp-add], [data-pair-add]').forEach((button) => {
      if (button.textContent === strings.adding || button.textContent === strings.added) {
        button.textContent = strings.addToCart;
        button.disabled = false;
      }
    });
  });
}
