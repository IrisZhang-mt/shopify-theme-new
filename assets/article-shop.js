// Shop the article (snippets/article-shop.liquid): SHOP THIS SECTION carousel, product link hover cards
// and photo hotspots inside a blog post body. Loaded after article.js, so the body is already rebuilt.
if (!window.mtArticleShopInit) {
  window.mtArticleShopInit = true;

  const MARKER = '[shop-this-section]';
  const MAX_SPOTS = 3;
  // Desktop = a mouse on a wide screen: link hover cards, hotspot cards open on hover (right of the dot).
  // Everything else taps: links just navigate, hotspot cards open under the dot once it is tapped.
  const desktopMq = window.matchMedia('(min-width: 750px) and (hover: hover) and (pointer: fine)');
  const wideMq = window.matchMedia('(min-width: 750px)');
  const reducedMq = window.mtReducedMq || window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

  // ---- GA4: view_item_list (batched, once per product per list) / select_item, as in the other product lists ----
  const push = (eventName, params) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({ event: 'ga4Event', event_name: eventName, event_parameters: params });
  };

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

  const currencyOf = (el) => el.closest('[data-currency]')?.dataset.currency;

  const tracked = new Set();
  let viewQueue = [];
  let viewTimer = 0;

  const flushViews = () => {
    const lists = new Map();
    viewQueue.forEach((el) => {
      const key = `${el.dataset.itemListId}|${el.dataset.itemListName}`;
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key).push(el);
    });
    viewQueue = [];
    lists.forEach((els) => {
      push('view_item_list', {
        item_list_id: els[0].dataset.itemListId,
        item_list_name: els[0].dataset.itemListName,
        currency: currencyOf(els[0]),
        items: els.map(buildItem),
      });
    });
  };

  const seen = (el) => {
    if (!el.dataset.itemId) return;
    const key = `${el.dataset.itemListName}|${el.dataset.itemId}`;
    if (tracked.has(key)) return;
    tracked.add(key);
    viewQueue.push(el);
    clearTimeout(viewTimer);
    viewTimer = setTimeout(flushViews, 300);
  };

  // Carousel cards count once half shown; hotspot cards are observed only while open.
  const viewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        viewObserver.unobserve(entry.target);
        seen(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-qs-open], [data-asp-close]')) return;
    const card = event.target.closest?.('[data-asp] .mt-card[data-item-id]');
    const pop = card ? null : event.target.closest?.('[data-asp-pop] a')?.closest('[data-asp-pop]');
    const el = card || pop;
    if (!el) return;
    push('select_item', {
      item_list_id: el.dataset.itemListId,
      item_list_name: el.dataset.itemListName,
      currency: currencyOf(el),
      button_name: 'Product Card',
      items: [buildItem(el)],
    });
  });

  // ---- SHOP THIS SECTION: moved from its hidden holder into the line that reads [shop-this-section] ----
  const blockOf = (slot) => {
    const rte = slot.closest('[data-art-rte]');
    let block = slot;
    while (block.parentElement && block.parentElement !== rte) block = block.parentElement;
    return block;
  };

  const removeSlot = (slot) => {
    const block = blockOf(slot);
    if (block !== slot && block.textContent.trim() === MARKER) block.remove();
    else slot.remove();
  };

  const syncRow = (module) => {
    const row = module.querySelector('[data-asp-row]');
    const cards = [...row.children];
    if (!cards.length) return;
    const max = row.scrollWidth - row.clientWidth;
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : row.clientWidth;
    // Desktop counts pages of three; mobile counts cards.
    const per = wideMq.matches ? 3 : 1;
    const total = Math.ceil(cards.length / per);
    let current = Math.round(row.scrollLeft / (step * per)) + 1;
    if (row.scrollLeft >= max - 2) current = total;
    current = clamp(current, 1, total);
    module.querySelector('[data-asp-count]').textContent = `${current} / ${total}`;
    module.querySelector('[data-asp-arrow="prev"]').disabled = row.scrollLeft <= 1;
    module.querySelector('[data-asp-arrow="next"]').disabled = row.scrollLeft >= max - 1;
    module.toggleAttribute('data-single', max <= 1);
  };

  const bindRow = (module) => {
    const row = module.querySelector('[data-asp-row]');
    let frame = 0;
    row.addEventListener(
      'scroll',
      () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          syncRow(module);
        });
      },
      { passive: true }
    );
    new ResizeObserver(() => syncRow(module)).observe(row);
    module.querySelectorAll('[data-asp-arrow]').forEach((arrow) => {
      arrow.addEventListener('click', () => {
        const cards = [...row.children];
        const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : row.clientWidth;
        const per = wideMq.matches ? 3 : 1;
        const dir = arrow.dataset.aspArrow === 'next' ? 1 : -1;
        row.scrollBy({ left: dir * step * per, behavior: reducedMq.matches ? 'auto' : 'smooth' });
      });
    });
    syncRow(module);
    row.querySelectorAll('.mt-card[data-item-id]').forEach((card) => viewObserver.observe(card));
    // Cards past the first page are clipped by the row, so the page reveal (motion.js) only fires once they are
    // scrolled to and they show up late after the first Next (QA 2026-11-25): reveal the whole row with page one.
    const rowReveal = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        rowReveal.disconnect();
        row.querySelectorAll('.mt-card[data-reveal]').forEach((card) => card.classList.add('mt-in-view'));
      },
      { threshold: 0.15 }
    );
    rowReveal.observe(row);
  };

  const mountSection = (art) => {
    const module = art.querySelector('[data-asp]');
    const slots = [...art.querySelectorAll('[data-asp-slot]')];
    const slot = module ? slots.shift() : null;
    slots.forEach(removeSlot);
    if (!slot) return;
    const block = blockOf(slot);
    if (block === slot) {
      slot.replaceWith(module);
    } else if (block.textContent.trim() === MARKER) {
      block.replaceWith(module);
    } else {
      // The placeholder shares its line with text: the module goes right after that paragraph.
      block.after(module);
      slot.remove();
    }
    module.hidden = false;
    bindRow(module);
    return true;
  };

  // ---- Product link cards (desktop hover): links to /products/{handle}#shop ----
  const linkCards = new WeakMap();
  let linkOpen = null;
  let linkAnchor = null;
  let linkShowTimer = 0;
  let linkHideTimer = 0;

  const cardForLink = (anchor) => {
    if (linkCards.has(anchor)) return linkCards.get(anchor);
    let card = null;
    try {
      const url = new URL(anchor.href, window.location.href);
      const match = url.hash === '#shop' && url.pathname.match(/\/products\/([^/]+)/);
      const art = anchor.closest('[data-art]');
      const layer = art?.querySelector('[data-asp-layer]');
      const handle = match ? decodeURIComponent(match[1]) : '';
      const template = handle && art?.querySelector(`template[data-asp-link="${CSS.escape(handle)}"]`);
      if (template && layer) {
        card = layer.querySelector(`[data-asp-link-card="${CSS.escape(handle)}"]`);
        if (!card) {
          card = template.content.firstElementChild.cloneNode(true);
          card.dataset.aspLinkCard = handle;
          layer.append(card);
        }
      }
    } catch {
      card = null;
    }
    linkCards.set(anchor, card);
    return card;
  };

  const hideLink = () => {
    clearTimeout(linkShowTimer);
    clearTimeout(linkHideTimer);
    linkOpen?.classList.remove('is-open');
    linkOpen = null;
    linkAnchor = null;
  };

  // Just under the hovered line of the link, left-aligned with it (flips above near the bottom of the window).
  const showLink = (anchor, card, pointerY) => {
    if (linkOpen && linkOpen !== card) linkOpen.classList.remove('is-open');
    const rects = [...anchor.getClientRects()];
    const rect = rects.find((r) => pointerY >= r.top && pointerY <= r.bottom) || rects[rects.length - 1];
    if (!rect) return;
    const layerRect = card.parentElement.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8 && rect.top - 6 - height >= 8) top = rect.top - 6 - height;
    const left = clamp(rect.left, 8, document.documentElement.clientWidth - width - 8);
    card.style.top = `${top - layerRect.top}px`;
    card.style.left = `${left - layerRect.left}px`;
    card.classList.add('is-open');
    linkOpen = card;
    linkAnchor = anchor;
    seen(card);
  };

  // ---- Photo hotspots ----
  const groups = [];
  const spotOfDot = new WeakMap();
  let spotHideTimer = 0;

  const groupOf = (el) => groups.find((group) => group.host.contains(el));

  // Desktop: right of the dot (14px open-dot radius + 19px), vertically centred, else left of it.
  // Touch: under the dot (11px open-dot radius + 8px), centred, else above it, else pushed to a side.
  // The first place inside the photo that leaves the other dots uncovered wins (a covered dot can't be tapped).
  const placeCard = (group, spot) => {
    const { card } = spot;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const b = group.bounds;
    const desktop = desktopMq.matches;
    const fits = ([left, top]) => left >= b.left && top >= b.top && left + width <= b.right && top + height <= b.bottom;
    const near = ([left]) => desktop || (spot.cx >= left && spot.cx <= left + width);
    const clear = ([left, top]) =>
      !group.spots.some(
        (other) =>
          other !== spot &&
          !other.dot.hidden &&
          other.cx > left - 14 &&
          other.cx < left + width + 14 &&
          other.cy > top - 14 &&
          other.cy < top + height + 14
      );
    let options;
    if (desktop) {
      const middle = clamp(spot.cy - height / 2, b.top, b.bottom - height);
      options = [
        [spot.cx + 33, middle],
        [spot.cx - 33 - width, middle],
      ];
    } else {
      const below = spot.cy + 19;
      const above = spot.cy - 19 - height;
      const centre = clamp(spot.cx - width / 2, b.left, b.right - width);
      options = [below, above].flatMap((top) => [
        [centre, top],
        [b.left, top],
        [b.right - width, top],
      ]);
    }
    const [left, top] = options.find((o) => fits(o) && near(o) && clear(o)) ||
      options.find((o) => fits(o) && near(o)) || [
        clamp(options[0][0], b.left, b.right - width),
        clamp(options[0][1], b.top, b.bottom - height),
      ];
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };

  // x / y are percentages of the original image; map them through object-fit (cover on the regrouped images).
  const placeSpots = (group) => {
    const { host, img } = group;
    const hostRect = host.getBoundingClientRect();
    const box = img.getBoundingClientRect();
    let width = box.width;
    let height = box.height;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const fit = getComputedStyle(img).objectFit;
    if (naturalW && naturalH && (fit === 'cover' || fit === 'contain')) {
      const scale = (fit === 'cover' ? Math.max : Math.min)(box.width / naturalW, box.height / naturalH);
      width = naturalW * scale;
      height = naturalH * scale;
    }
    const originX = box.left - hostRect.left + (box.width - width) / 2;
    const originY = box.top - hostRect.top + (box.height - height) / 2;
    // The part of the photo actually on screen (the frame crops it; a wrapper may add padding around it).
    group.bounds = {
      left: Math.max(0, box.left - hostRect.left),
      top: Math.max(0, box.top - hostRect.top),
      right: Math.min(hostRect.width, box.right - hostRect.left),
      bottom: Math.min(hostRect.height, box.bottom - hostRect.top),
    };
    const { bounds } = group;
    group.spots.forEach((spot) => {
      spot.cx = originX + (clamp(spot.x, 0, 100) / 100) * width;
      spot.cy = originY + (clamp(spot.y, 0, 100) / 100) * height;
      spot.dot.hidden =
        spot.cx < bounds.left || spot.cx > bounds.right || spot.cy < bounds.top || spot.cy > bounds.bottom;
      spot.dot.style.left = `${spot.cx}px`;
      spot.dot.style.top = `${spot.cy}px`;
      if (spot.card.classList.contains('is-open')) placeCard(group, spot);
    });
  };

  const closeSpot = (spot) => {
    spot.card.classList.remove('is-open', 'is-pinned');
    spot.dot.classList.remove('is-on');
    spot.dot.setAttribute('aria-expanded', 'false');
    viewObserver.unobserve(spot.card);
  };

  const closeGroup = (group) => {
    group.spots.forEach(closeSpot);
    group.pinned = null;
  };

  const openSpot = (group, spot, pinned) => {
    group.spots.forEach((other) => other !== spot && closeSpot(other));
    spot.dot.classList.add('is-on');
    spot.dot.setAttribute('aria-expanded', 'true');
    spot.card.classList.add('is-open');
    spot.card.classList.toggle('is-pinned', pinned);
    group.pinned = pinned ? spot : null;
    placeCard(group, spot);
    viewObserver.observe(spot.card);
  };

  // Both devices start with every card closed: a tap / click on a dot opens it (QA 2026-11-25, adjustment 1).
  const resetGroup = (group) => closeGroup(group);

  const hostFor = (img) => {
    // article.js puts image-only paragraphs into .mt-art__full / __pair / __gallery: the paragraph is the frame.
    const paragraph = img.closest('p');
    if (paragraph?.parentElement?.matches('.mt-art__full, .mt-art__pair, .mt-art__gallery')) return paragraph;
    // Elsewhere wrap the image (or the link around it, so a dot is never inside a link).
    const target = img.closest('a') || img;
    const host = document.createElement('span');
    target.before(host);
    host.append(target);
    return host;
  };

  const hostResize = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const group = groups.find((item) => item.host === entry.target);
      if (group) placeSpots(group);
    });
  });

  const mountSpots = (art) => {
    const byImage = new Map();
    art.querySelectorAll('template[data-asp-spot]').forEach((template) => {
      const list = byImage.get(template.dataset.img) || [];
      if (list.length < MAX_SPOTS) list.push(template);
      byImage.set(template.dataset.img, list);
    });
    let stilled = false;
    byImage.forEach((templates, index) => {
      const img = art.querySelector(`[data-art-rte] img[data-asp-img="${CSS.escape(index)}"]`);
      if (!img) return;
      const host = hostFor(img);
      host.classList.add('mt-asp-host');
      // Parallax slides the image inside its frame, which would pull the dots off the product: keep these still.
      if (host.hasAttribute('data-mt-parallax')) {
        host.removeAttribute('data-mt-parallax');
        host.classList.add('mt-asp-host--still');
        img.style.transform = '';
        stilled = true;
      }
      const layer = document.createElement('div');
      layer.className = 'mt-asp-spots';
      const group = { host, img, pinned: null, spots: [] };
      templates.forEach((template) => {
        const card = template.content.firstElementChild.cloneNode(true);
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'mt-asp-dot';
        dot.setAttribute('aria-label', template.dataset.title || '');
        dot.setAttribute('aria-expanded', 'false');
        layer.append(dot, card);
        const spot = { x: parseFloat(template.dataset.x) || 0, y: parseFloat(template.dataset.y) || 0, dot, card, cx: 0, cy: 0 };
        spotOfDot.set(dot, spot);
        group.spots.push(spot);
      });
      host.append(layer);
      groups.push(group);
      placeSpots(group);
      resetGroup(group);
      if (!img.complete) img.addEventListener('load', () => placeSpots(group), { once: true });
      hostResize.observe(host);
    });
    return stilled;
  };

  // Clicks: a dot pins its card (or closes it when it is the pinned one); × or anywhere outside the open card
  // closes it. Both devices.
  document.addEventListener('click', (event) => {
    const close = event.target.closest?.('[data-asp-close]');
    if (close) {
      const group = groupOf(close);
      if (group) closeGroup(group);
      return;
    }
    groups.forEach((group) => {
      if (group.pinned && !group.pinned.card.contains(event.target) && !group.pinned.dot.contains(event.target)) {
        closeGroup(group);
      }
    });
    const dot = event.target.closest?.('.mt-asp-dot');
    if (dot) {
      event.preventDefault();
      const group = groupOf(dot);
      const spot = spotOfDot.get(dot);
      if (!group || !spot) return;
      clearTimeout(spotHideTimer);
      if (group.pinned === spot) closeGroup(group);
      else openSpot(group, spot, true);
      return;
    }
    if (event.target.closest?.('.mt-asp-pop--link [data-qs-open]')) hideLink();
  });

  // Hover (mouse only): links show their card; a dot shows its card unless one is pinned in that photo,
  // in which case the dot only turns solid.
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse' || !desktopMq.matches) return;
    const target = event.target;
    if (target.closest?.('.mt-asp-pop--link')) {
      clearTimeout(linkHideTimer);
      return;
    }
    if (target.closest?.('.mt-asp-pop--spot')) {
      clearTimeout(spotHideTimer);
      return;
    }
    const dot = target.closest?.('.mt-asp-dot');
    if (dot) {
      const group = groupOf(dot);
      const spot = spotOfDot.get(dot);
      if (!group || !spot) return;
      clearTimeout(spotHideTimer);
      if (group.pinned) {
        if (group.pinned !== spot) dot.classList.add('is-on');
      } else {
        openSpot(group, spot, false);
      }
      return;
    }
    const anchor = target.closest?.('[data-art-rte] a');
    const card = anchor && cardForLink(anchor);
    if (!card) return;
    clearTimeout(linkHideTimer);
    if (linkAnchor === anchor && linkOpen) return;
    clearTimeout(linkShowTimer);
    const pointerY = event.clientY;
    linkShowTimer = setTimeout(() => showLink(anchor, card, pointerY), 120);
  });

  document.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target;
    const next = event.relatedTarget;

    const spotEl = target.closest?.('.mt-asp-dot, .mt-asp-pop--spot');
    if (spotEl) {
      const group = groupOf(spotEl);
      if (!group) return;
      const spot = group.spots.find((item) => item.dot === spotEl || item.card.contains(spotEl));
      if (!spot || (next && (spot.dot.contains(next) || spot.card.contains(next)))) return;
      if (group.pinned) {
        if (group.pinned !== spot) spot.dot.classList.remove('is-on');
        return;
      }
      clearTimeout(spotHideTimer);
      spotHideTimer = setTimeout(() => {
        if (group.pinned !== spot) closeSpot(spot);
      }, 200);
      return;
    }

    const linkEl = target.closest?.('.mt-asp-pop--link, [data-art-rte] a');
    if (!linkEl || !(linkOpen || linkShowTimer)) return;
    if (next && (next.closest?.('.mt-asp-pop--link') || linkAnchor?.contains(next))) return;
    clearTimeout(linkShowTimer);
    clearTimeout(linkHideTimer);
    linkHideTimer = setTimeout(hideLink, 200);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideLink();
  });

  desktopMq.addEventListener('change', () => {
    hideLink();
    groups.forEach((group) => {
      placeSpots(group);
      resetGroup(group);
    });
  });
  window.addEventListener('resize', hideLink);

  const init = (scope) => {
    let rescan = false;
    scope.querySelectorAll('[data-art]').forEach((art) => {
      if (art.dataset.aspReady) return;
      art.dataset.aspReady = 'true';
      if (mountSection(art)) rescan = true;
      if (mountSpots(art)) rescan = true;
    });
    // New cards need their reveal; parallax drops the photos that now carry dots.
    if (rescan) document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
