if (!window.mtRevsInit) {
  window.mtRevsInit = true;

  const ENDPOINT = 'https://judge.me/reviews/all_reviews_js_based';
  const BATCH = 7;
  const TIMEOUT = 12000;
  const TYPES = { product: 'product-reviews', shop: 'shop-reviews' };

  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  };

  const read = (source, selector) => source.querySelector(selector)?.textContent.trim() || '';

  const stamp = (source) => {
    const raw = source.querySelector('.jdgm-rev__timestamp')?.dataset.content || '';
    const parsed = Date.parse(raw.replace(' ', 'T').replace(' UTC', 'Z'));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const parse = (html, scope) => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    return [...doc.querySelectorAll('.jdgm-rev')].map((source) => ({
      scope,
      author: read(source, '.jdgm-rev__author'),
      title: read(source, '.jdgm-rev__title'),
      body: read(source, '.jdgm-rev__body'),
      rating: Number(source.querySelector('.jdgm-rev__rating')?.dataset.score) || 0,
      picture: source.querySelector('.jdgm-rev__pic-img')?.dataset.src
        || source.querySelector('.jdgm-rev__pic-img')?.getAttribute('src')
        || '',
      time: stamp(source),
    }));
  };

  const row = (review, ratingLabel) => {
    const item = node('article', 'mt-revs__row');
    item.setAttribute('data-revs-row', '');
    item.setAttribute('data-reveal', '');
    item.dataset.scope = review.scope;

    const who = node('div', 'mt-revs__who');
    who.append(node('h2', 'mt-revs__author', review.author));
    if (review.rating) {
      who.append(window.mtStars(review.rating, 'mt-revs', ratingLabel.replace('[rating]', review.rating), 12));
    }
    item.append(who);

    const content = node('div', 'mt-revs__content');
    if (review.title) content.append(node('h3', 'mt-revs__head', review.title));
    if (review.body) content.append(node('p', 'mt-revs__text', review.body));
    item.append(content);

    if (review.picture) {
      item.setAttribute('data-picture', '');
      const media = node('div', 'mt-revs__media');
      const image = new Image(100, 134);
      image.src = review.picture;
      image.alt = review.author;
      image.loading = 'lazy';
      image.decoding = 'async';
      media.append(image);
      item.append(media);
    }
    return item;
  };

  const fetchType = async (state, type, page, perPage) => {
    const params = new URLSearchParams({
      shop_domain: state.shop,
      url: state.shop,
      platform: 'shopify',
      review_type: TYPES[type],
      page,
      per_page: perPage || BATCH,
    });
    if (state.picturesFirst) params.set('sort_by', 'pictures_first');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const response = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(response.status);
      const data = await response.json();
      return {
        reviews: parse(data.html, type),
        product: Number(data.number_of_product_reviews) || 0,
        shop: Number(data.number_of_shop_reviews) || 0,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const initSection = (root) => {
    const list = root.querySelector('[data-revs-list]');
    const more = root.querySelector('[data-revs-more]');
    const empty = root.querySelector('[data-revs-empty]');
    if (!list) return;

    const stars = root.querySelector('[data-revs-stars]');
    const averageText = root.querySelector('[data-revs-average-text]');
    const ratingLabel = averageText?.dataset.template || '[rating]';
    const basedText = root.querySelector('[data-revs-based]');

    const baseAverage = Number(root.dataset.revsAverage) || 0;
    const state = {
      shop: root.dataset.revsShop,
      baseTotal: Number(root.dataset.revsTotal) || 0,
      baseAverage,
      counts: null,
      average: baseAverage,
      pending: [],
      tab: 'all',
      picturesFirst: false,
      page: 1,
      token: 0,
      loading: false,
    };

    state.pending = window.mtReviewStore.read().map((entry) => ({
      scope: entry.scope === 'shop' ? 'shop' : 'product',
      author: entry.name || '',
      title: entry.title || '',
      body: entry.body || '',
      picture: '',
      rating: Number(entry.rating) || 0,
      time: entry.time,
    }));

    const scopes = () => (state.tab === 'all' ? ['product', 'shop'] : [state.tab]);

    const trueAverage = (liveTotal, ordered) => {
      if (liveTotal <= 0) return 0;
      const extra = liveTotal - state.baseTotal;
      if (extra <= 0 || extra > ordered.length) return state.baseAverage;
      let sum = state.baseAverage * state.baseTotal;
      for (let index = 0; index < extra; index += 1) {
        if (!ordered[index].rating) return state.baseAverage;
        sum += ordered[index].rating;
      }
      return sum / liveTotal;
    };

    const fill = (template, token, value) => (template ? template.replace(token, value) : '');

    const paintSummary = () => {
      if (!state.counts) return;
      const live = state.counts.product + state.counts.shop;
      const shown = live + state.pending.length;
      let average = state.average;
      if (state.pending.length) {
        const sum = state.average * live + state.pending.reduce((total, item) => total + item.rating, 0);
        average = shown > 0 ? sum / shown : 0;
      }

      root.querySelectorAll('[data-revs-tab]').forEach((tab) => {
        const key = tab.dataset.revsTab;
        if (key !== 'product' && key !== 'shop') return;
        const pendingHere = state.pending.filter((item) => item.scope === key).length;
        const value = state.counts[key] + pendingHere;
        const label = fill(tab.dataset.template, '[count]', value);
        if (label) tab.textContent = label;
      });

      if (averageText) {
        const label = fill(averageText.dataset.template, '[rating]', average.toFixed(2));
        if (label) averageText.textContent = label;
      }

      if (basedText) {
        const label = shown === 1
          ? basedText.dataset.one
          : fill(basedText.dataset.many, '[count]', shown);
        if (label) basedText.textContent = label;
      }

      if (stars) {
        const filled = Math.round(average);
        [...stars.children].forEach((star, index) => {
          star.classList.toggle('mt-revs__star--on', index < filled);
        });
      }
    };

    const visiblePending = () =>
      state.pending.filter((item) => state.tab === 'all' || item.scope === state.tab);

    const distCells = [...root.querySelectorAll('[data-revs-dist]')];
    const hist = root.querySelector('[data-revs-hist]');

    const bumpHistogram = (rating) => {
      const cell = distCells.find((item) => Number(item.dataset.revsDist) === rating);
      if (!cell) return;
      cell.textContent = Number(cell.textContent) + 1;
      if (hist) hist.hidden = false;
    };

    const loadHistogram = async () => {
      if (!distCells.length) return;
      const counts = [0, 0, 0, 0, 0];
      try {
        for (const scope of ['product', 'shop']) {
          let page = 1;
          let seen = 0;
          let total = Infinity;
          while (seen < total && page <= 5) {
            const batch = await fetchType(state, scope, page, 100);
            total = scope === 'product' ? batch.product : batch.shop;
            if (!batch.reviews.length) break;
            batch.reviews.forEach((review) => {
              if (review.rating) counts[review.rating - 1] += 1;
            });
            seen += batch.reviews.length;
            page += 1;
          }
          if (seen < total) return;
        }
      } catch {
        return;
      }
      if (!distCells[0].isConnected) return;
      distCells.forEach((cell) => {
        cell.textContent = counts[Number(cell.dataset.revsDist) - 1];
      });
      if (hist) hist.hidden = counts.every((count) => count === 0);
    };

    const paint = (reviews, replace) => {
      if (replace) list.replaceChildren();
      const items = replace ? [...visiblePending(), ...reviews] : reviews;
      items.forEach((review, index) => {
        const item = row(review, ratingLabel);
        item.style.setProperty('--mt-reveal-i', Math.min(index, 5));
        list.append(item);
      });
      if (empty) empty.hidden = list.children.length > 0;
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    };

    const settled = (waiting, review) =>
      waiting.rating === review.rating
      && waiting.author === review.author
      && waiting.title === review.title;

    const load = async (replace) => {
      if (state.loading && !replace) return;
      state.loading = true;
      const token = ++state.token;
      let batches;
      try {
        batches = await Promise.all(scopes().map((scope) => fetchType(state, scope, state.page)));
      } catch {
        if (token === state.token) {
          state.loading = false;
          if (!replace) state.page -= 1;
          else if (empty && !list.children.length) empty.hidden = false;
        }
        return;
      }
      if (token !== state.token || !list.isConnected) return;
      state.loading = false;

      const reviews = batches.flatMap((batch) => batch.reviews).sort((a, b) => {
        if (state.picturesFirst) {
          const pictures = (b.picture ? 1 : 0) - (a.picture ? 1 : 0);
          if (pictures) return pictures;
        }
        return b.time - a.time;
      });
      state.counts = { product: batches[0].product, shop: batches[0].shop };
      const live = state.counts.product + state.counts.shop;

      const settledTimes = [];
      state.pending = state.pending.filter((waiting) => {
        const done = reviews.some((review) => settled(waiting, review));
        if (done && waiting.time) settledTimes.push(waiting.time);
        return !done;
      });
      if (settledTimes.length) window.mtReviewStore.drop(settledTimes);

      if (state.page === 1 && state.tab === 'all' && !state.picturesFirst) {
        state.average = trueAverage(live, reviews);
      }

      paint(reviews, replace);
      paintSummary();
      if (replace && !reviews.length && live > 0 && !state.recovered) {
        state.recovered = true;
        setTimeout(() => {
          if (list.isConnected) load(true);
        }, 1500);
      }
      if (more) {
        const active = state.tab === 'all'
          ? [state.counts.product, state.counts.shop]
          : [state.counts[state.tab]];
        const pages = Math.max(...active.map((count) => Math.ceil(count / BATCH)));
        more.hidden = state.page >= pages;
      }
    };

    const setTab = (key) => {
      state.tab = key;
      root.querySelectorAll('[data-revs-tab]').forEach((button) => {
        const on = button.dataset.revsTab === key;
        button.classList.toggle('mt-on', on);
        button.setAttribute('aria-pressed', String(on));
      });
    };

    root.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-revs-tab]');
      if (tab) {
        if (tab.getAttribute('aria-pressed') === 'true') return;
        setTab(tab.dataset.revsTab);
        state.page = 1;
        load(true);
        return;
      }
      const pictures = event.target.closest('[data-revs-pictures]');
      if (pictures) {
        state.picturesFirst = !state.picturesFirst;
        pictures.classList.toggle('mt-on', state.picturesFirst);
        pictures.setAttribute('aria-pressed', String(state.picturesFirst));
        state.page = 1;
        load(true);
        return;
      }
      if (event.target.closest('[data-revs-more]') && !state.loading) {
        state.page += 1;
        load(false);
      }
    });

    document.addEventListener('mt:review-added', (event) => {
      if (!list.isConnected) return;
      const detail = event.detail || {};
      const review = {
        scope: detail.scope === 'shop' ? 'shop' : 'product',
        author: detail.name || '',
        title: detail.title || '',
        body: detail.body || '',
        picture: detail.picture || '',
        rating: Number(detail.rating) || 0,
        time: detail.time || Date.now(),
      };
      state.pending.unshift(review);
      if (review.rating) bumpHistogram(review.rating);
      if (state.tab !== 'all') setTab('all');
      state.page = 1;
      const item = row(review, ratingLabel);
      item.style.setProperty('--mt-reveal-i', 0);
      list.prepend(item);
      if (empty) empty.hidden = true;
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      paintSummary();
      load(true);
    });

    load(true);
    loadHistogram();
  };

  const init = (scope) => {
    scope.querySelectorAll('[data-revs]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      initSection(root);
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
