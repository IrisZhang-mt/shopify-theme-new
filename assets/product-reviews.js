if (!window.mtRevInit) {
  window.mtRevInit = true;

  const ENDPOINT = 'https://judge.me/reviews/reviews_for_widget';
  const TIMEOUT = 12000;
  const SWAP_DELAY = 250;
  const SORTS = {
    all: { sort_by: 'created_at', sort_dir: 'desc' },
    images: { sort_by: 'pictures_first' },
    high: { sort_by: 'rating', sort_dir: 'desc' },
    low: { sort_by: 'rating', sort_dir: 'asc' },
  };

  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  };

  const plain = (html) => {
    const holder = document.createElement('template');
    holder.innerHTML = html || '';
    return holder.content.textContent.trim();
  };

  const card = (review, ratingLabel) => {
    const item = node('article', 'mt-rev__item');
    item.setAttribute('data-rev-item', '');
    item.setAttribute('data-reveal', '');
    item.dataset.rating = review.rating;

    const who = node('div', 'mt-rev__who');
    who.append(node('p', 'mt-rev__name', review.reviewer_name));
    if (review.rating) {
      who.append(window.mtStars(review.rating, 'mt-rev', ratingLabel.replace('[rating]', review.rating), 12));
    }

    const comment = node('div', 'mt-rev__comment');
    if (review.title) comment.append(node('p', 'mt-rev__heading', review.title));
    const body = plain(review.body_html);
    if (body) comment.append(node('p', 'mt-rev__text', body));
    item.append(who, comment);

    const picture = review.pictures_urls && review.pictures_urls[0];
    if (picture) {
      item.setAttribute('data-has-image', '');
      const media = node('div', 'mt-rev__media');
      const image = new Image(99, 130);
      image.src = picture.compact || picture.original;
      image.alt = review.reviewer_name || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      media.append(image);
      item.append(media);
    }
    return item;
  };

  const fetchPage = async (state, page) => {
    const params = new URLSearchParams({
      shop_domain: state.shop,
      url: state.shop,
      platform: 'shopify',
      product_id: state.product,
      page,
      per_page: state.perPage,
      ...SORTS[state.sort],
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const response = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const initSection = (root) => {
    const list = root.querySelector('[data-rev-list]');
    const more = root.querySelector('[data-rev-more]');
    const tags = root.querySelector('[data-rev-tags]');
    const empty = root.querySelector('[data-rev-empty]');
    if (!list) return;

    const reducedMq = window.mtReducedMq;
    const ratingLabel = root.dataset.revRatingLabel || '[rating]';
    const state = {
      shop: root.dataset.revShop,
      product: root.dataset.revProduct,
      perPage: Number(root.dataset.revPerPage) || 5,
      sort: 'all',
      page: 1,
      token: 0,
      loading: false,
      swapTimer: 0,
      pending: [],
    };

    state.pending = window.mtReviewStore.read()
      .filter((entry) => entry.scope === 'product' && String(entry.productId) === String(state.product))
      .map((entry) => ({
        rating: Number(entry.rating) || 0,
        reviewer_name: entry.name || '',
        title: entry.title || '',
        body_html: entry.body || '',
        pictures_urls: [],
        time: entry.time,
      }));

    const paint = (reviews, replace) => {
      if (replace) list.replaceChildren();
      const items = replace ? [...state.pending, ...reviews] : reviews;
      items.forEach((review, index) => {
        const item = card(review, ratingLabel);
        item.style.setProperty('--mt-reveal-i', Math.min(index, 5));
        list.append(item);
      });
      const filled = list.children.length > 0;
      if (empty) empty.hidden = filled;
      if (tags) tags.hidden = !filled;
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    };

    const settled = (waiting, review) =>
      waiting.rating === Number(review.rating)
      && waiting.reviewer_name === (review.reviewer_name || '')
      && waiting.title === (review.title || '');

    const load = async (replace) => {
      if (state.loading && !replace) return;
      state.loading = true;
      const token = ++state.token;
      let data;
      try {
        data = await fetchPage(state, state.page);
      } catch {
        if (token === state.token) {
          state.loading = false;
          if (!replace) state.page -= 1;
          list.classList.remove('mt-rev__list--swap');
        }
        return;
      }
      if (token !== state.token || !list.isConnected) return;
      state.loading = false;

      const reviews = data.reviews || [];

      const settledTimes = [];
      state.pending = state.pending.filter((waiting) => {
        const done = reviews.some((review) => settled(waiting, review));
        if (done && waiting.time) settledTimes.push(waiting.time);
        return !done;
      });
      if (settledTimes.length) window.mtReviewStore.drop(settledTimes);

      paint(reviews, replace);
      if (more) more.hidden = state.page >= (data.pagination ? data.pagination.total_pages : 0);
      list.classList.remove('mt-rev__list--swap');
    };

    const swap = () => {
      clearTimeout(state.swapTimer);
      if (reducedMq.matches) {
        load(true);
        return;
      }
      list.classList.add('mt-rev__list--swap');
      state.swapTimer = setTimeout(() => load(true), SWAP_DELAY);
    };

    const setSort = (key) => {
      state.sort = key;
      root.querySelectorAll('[data-rev-sort]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.revSort === key));
      });
    };

    root.addEventListener('click', (event) => {
      const tag = event.target.closest('[data-rev-sort]');
      if (tag) {
        if (tag.getAttribute('aria-pressed') === 'true') return;
        setSort(tag.dataset.revSort);
        state.page = 1;
        swap();
        return;
      }
      if (event.target.closest('[data-rev-more]') && !state.loading) {
        state.page += 1;
        load(false);
      }
    });

    document.addEventListener('mt:review-added', (event) => {
      const detail = event.detail || {};
      if (!list.isConnected || detail.scope !== 'product') return;
      if (String(detail.productId) !== String(state.product)) return;
      const review = {
        rating: Number(detail.rating) || 0,
        reviewer_name: detail.name || '',
        title: detail.title || '',
        body_html: detail.body || '',
        pictures_urls: detail.picture ? [{ compact: detail.picture }] : [],
        time: detail.time || Date.now(),
      };
      state.pending.unshift(review);
      state.page = 1;
      setSort('all');
      const item = card(review, ratingLabel);
      item.style.setProperty('--mt-reveal-i', 0);
      list.prepend(item);
      if (empty) empty.hidden = true;
      if (tags) tags.hidden = false;
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      load(true);
    });

    if (list.children.length === 0 || state.pending.length) load(true);
  };

  const init = (scope) => {
    scope.querySelectorAll('[data-rev]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      initSection(root);
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
