if (!window.mtHeaderInit) {
  window.mtHeaderInit = true;

  const DURATION = 250;
  const closeTimers = new WeakMap();
  const hoverMq = window.matchMedia('(hover: hover) and (min-width: 750px)');
  const widthMq = window.matchMedia('(min-width: 750px)');
  const reducedMq = window.mtReducedMq;

  const closeDetails = (details) => {
    if (!details.open || details.classList.contains('mt-closing')) return;
    if (reducedMq.matches) {
      details.removeAttribute('open');
      return;
    }
    details.classList.add('mt-closing');
    closeTimers.set(
      details,
      setTimeout(() => {
        details.removeAttribute('open');
        details.classList.remove('mt-closing');
      }, DURATION)
    );
  };

  const openDetails = (details) => {
    if (details.classList.contains('mt-closing')) {
      clearTimeout(closeTimers.get(details));
      details.classList.remove('mt-closing');
    }
    details.setAttribute('open', '');
  };

  document.addEventListener('mouseover', (event) => {
    if (!hoverMq.matches) return;
    const summary = event.target.closest?.('.mt-header__mega > summary');
    if (!summary) return;
    const mega = summary.parentElement;
    openDetails(mega);
    document.querySelectorAll('.mt-header__mega[open]').forEach((item) => {
      if (item !== mega) closeDetails(item);
    });
  });

  document.addEventListener('mouseout', (event) => {
    if (!hoverMq.matches) return;
    const mega = event.target.closest?.('.mt-header__mega');
    if (mega && !mega.contains(event.relatedTarget)) closeDetails(mega);
  });

  let searchCloseTimer = 0;
  let searchQueryTimer = 0;
  let searchSeq = 0;

  const searchParts = () => {
    const header = document.querySelector('.mt-header');
    return { header, panel: header?.querySelector('[data-search]'), link: header?.querySelector('[data-search-open]') };
  };

  const searchReset = (panel) => {
    clearTimeout(searchQueryTimer);
    searchSeq += 1;
    const input = panel.querySelector('[data-search-input]');
    if (!input) return;
    input.value = '';
    searchSize(input);
    searchQuery(input);
  };

  const searchOpen = () => {
    const { header, panel, link } = searchParts();
    if (!header || !panel) return;
    document.querySelectorAll('.mt-header details[open]').forEach(closeDetails);
    clearTimeout(searchCloseTimer);
    if (header.classList.contains('mt-header--search-closing')) searchReset(panel);
    header.classList.remove('mt-header--search-closing');
    panel.hidden = false;
    requestAnimationFrame(() => header.classList.add('mt-header--search'));
    document.documentElement.classList.add('mt-search-lock');
    link?.setAttribute('aria-expanded', 'true');
    const input = panel.querySelector('[data-search-input]');
    if (input) {
      searchSize(input);
      input.focus({ preventScroll: true });
    }
  };

  const searchClose = (restoreFocus) => {
    const { header, panel, link } = searchParts();
    if (!header?.classList.contains('mt-header--search')) return;
    header.classList.remove('mt-header--search');
    document.documentElement.classList.remove('mt-search-lock');
    link?.setAttribute('aria-expanded', 'false');
    if (reducedMq.matches) {
      if (panel) {
        panel.hidden = true;
        searchReset(panel);
      }
    } else {
      header.classList.add('mt-header--search-closing');
      searchCloseTimer = setTimeout(() => {
        header.classList.remove('mt-header--search-closing');
        if (panel) {
          panel.hidden = true;
          searchReset(panel);
        }
      }, DURATION);
    }
    if (restoreFocus) link?.focus();
  };

  const searchImage = (url) => (url.includes('?') ? `${url}&width=280` : `${url}?width=280`);

  const searchRender = (panel, queries, products) => {
    const suggest = panel.querySelector('[data-search-suggest]');
    const suggestItems = panel.querySelector('[data-search-suggest-items]');
    const results = panel.querySelector('[data-search-results]');
    const empty = panel.querySelector('[data-search-empty]');
    suggestItems.textContent = '';
    queries.slice(0, 6).forEach((entry) => {
      const chip = document.createElement('button');
      chip.className = 'mt-header__srch-tag';
      chip.type = 'button';
      chip.dataset.searchChip = entry.text;
      chip.textContent = entry.text;
      suggestItems.append(chip);
    });
    suggest.hidden = queries.length === 0;
    results.textContent = '';
    products.forEach((item) => {
      const card = document.createElement('a');
      card.className = 'mt-header__srch-item';
      card.href = item.url;
      if (item.featured_image?.url) {
        const img = document.createElement('img');
        img.src = searchImage(item.featured_image.url);
        img.alt = item.featured_image.alt || item.title;
        img.width = 114;
        img.height = 150;
        card.append(img);
      }
      const info = document.createElement('span');
      info.className = 'mt-header__srch-item-info';
      const title = document.createElement('span');
      title.textContent = item.title;
      const price = document.createElement('span');
      price.className = 'mt-header__srch-item-price';
      price.textContent = `${panel.dataset.searchFrom} $${+item.price}`;
      info.append(title, price);
      card.append(info);
      results.append(card);
    });
    results.hidden = products.length === 0;
    empty.hidden = queries.length > 0 || products.length > 0;
  };

  const searchQuery = async (input) => {
    const panel = input.closest('[data-search]');
    if (!panel) return;
    const q = input.value.trim();
    const popular = panel.querySelector('[data-search-popular]');
    const all = panel.querySelector('[data-search-all]');
    if (!q) {
      if (popular) popular.hidden = false;
      all.hidden = true;
      searchRender(panel, [], []);
      panel.querySelector('[data-search-empty]').hidden = true;
      return;
    }
    const seq = ++searchSeq;
    let data;
    try {
      const res = await fetch(
        `${panel.dataset.searchUrl}/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product,query&resources[limit]=6&resources[options][unavailable_products]=last`
      );
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch {
      return;
    }
    if (seq !== searchSeq || !panel.isConnected || input.value.trim() !== q) return;
    if (popular) popular.hidden = true;
    all.hidden = false;
    const queries = data.resources?.results?.queries || [];
    const products = (data.resources?.results?.products || []).slice(0, 2);
    searchRender(panel, queries, products);
  };

  const searchSize = (input) => {
    const mirror = input.form?.querySelector('[data-search-mirror]');
    if (!mirror) return;
    mirror.textContent = input.value || input.placeholder;
    input.style.width = `${Math.ceil(mirror.getBoundingClientRect().width) + 12}px`;
  };

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-search-input]');
    if (!input) return;
    searchSize(input);
    clearTimeout(searchQueryTimer);
    searchQueryTimer = setTimeout(() => searchQuery(input), 250);
  });

  document.addEventListener('click', (event) => {
    const summary = event.target.closest('.mt-header summary');
    const clickedDetails = summary?.parentElement;

    const anchor = event.target.closest('.mt-header a[href*="#"]');
    if (anchor && anchor.hash && anchor.pathname === window.location.pathname && anchor.host === window.location.host) {
      closeAll();
      return;
    }

    const searchLink = event.target.closest('[data-search-open]');
    if (searchLink) {
      event.preventDefault();
      if (searchLink.closest('.mt-header')?.classList.contains('mt-header--search')) {
        searchClose(false);
      } else {
        searchOpen();
      }
      return;
    }

    const chip = event.target.closest('[data-search-chip]');
    if (chip) {
      const panel = chip.closest('[data-search]');
      const input = panel?.querySelector('[data-search-input]');
      if (input) {
        input.value = chip.dataset.searchChip;
        input.focus({ preventScroll: true });
        searchSize(input);
        searchQuery(input);
      }
      return;
    }

    if (!event.target.closest('[data-search]')) searchClose(false);

    if (summary && summary.dataset.url && hoverMq.matches && event.detail > 0 && event.pointerType !== 'touch') {
      event.preventDefault();
      window.location.href = summary.dataset.url;
      return;
    }

    if (summary && clickedDetails?.open) {
      event.preventDefault();
      closeDetails(clickedDetails);
    }

    document.querySelectorAll('.mt-header details[open]').forEach((item) => {
      if (item !== clickedDetails && !item.contains(event.target)) closeDetails(item);
    });
  });

  document.addEventListener('keydown', (event) => {
    const { header, panel } = searchParts();
    const searchIsOpen = header?.classList.contains('mt-header--search');
    if (event.key === 'Tab' && searchIsOpen && panel?.contains(document.activeElement)) {
      window.mtFocusTrap(event, panel, 'a[href], button:not(:disabled), input');
      return;
    }
    if (event.key !== 'Escape') return;
    if (searchIsOpen) {
      searchClose(true);
      return;
    }
    document.querySelectorAll('.mt-header details[open]').forEach((item) => {
      closeDetails(item);
      item.querySelector('summary')?.focus();
    });
  });

  document.addEventListener(
    'toggle',
    (event) => {
      const drawer = event.target.closest?.('.mt-header__drawer');
      if (!drawer || event.target !== drawer) return;
      document.documentElement.classList.toggle('mt-nav-lock', drawer.open);
    },
    true
  );

  const closeAll = () => {
    document.querySelectorAll('.mt-header details[open]').forEach((item) => {
      clearTimeout(closeTimers.get(item));
      item.classList.remove('mt-closing');
      item.removeAttribute('open');
    });
    document.documentElement.classList.remove('mt-nav-lock');
    const { header, panel, link } = searchParts();
    clearTimeout(searchCloseTimer);
    header?.classList.remove('mt-header--search', 'mt-header--search-closing');
    if (panel) {
      panel.hidden = true;
      searchReset(panel);
    }
    link?.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('mt-search-lock');
  };

  widthMq.addEventListener('change', closeAll);
  window.addEventListener('hashchange', closeAll);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) closeAll();
  });
  document.addEventListener('shopify:section:unload', () => {
    if (!document.querySelector('.mt-header__drawer[open]')) closeAll();
  });
}
