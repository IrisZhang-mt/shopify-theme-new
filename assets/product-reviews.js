if (!window.mtRevInit) {
  window.mtRevInit = true;

  const ENDPOINT = 'https://judge.me/reviews/reviews_for_widget';
  const TIMEOUT = 12000;
  const SWAP_DELAY = 250;
  const LB_CLOSE_DELAY = 300;
  const PER_PAGE = 5;
  const CARD_PHOTOS = 4;
  const THUMB_WIDTH = 240;
  const FULL_WIDTH = 1024;
  const DEFAULT_SORT = 'images';
  const SORTS = {
    all: { sort_by: 'created_at', sort_dir: 'desc' },
    images: { sort_by: 'pictures_first' },
    high: { sort_by: 'rating', sort_dir: 'desc' },
    // with_pictures filters to photo reviews (newest first) instead of reordering.
    photos: { sort_by: 'with_pictures' },
  };

  const reducedMq = window.mtReducedMq;

  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = value;
    return element;
  };

  const fill = (template, values) =>
    Object.entries(values).reduce((text, [key, value]) => text.replace(`[${key}]`, value), template || '');

  // Judge.me's image CDN resizes by the width param and serves WebP when the browser accepts it.
  const sized = (url, width) => {
    try {
      const parsed = new URL(url, window.location.href);
      parsed.searchParams.set('width', width);
      return parsed.href;
    } catch {
      return url;
    }
  };

  const parseReviews = (html) => {
    const holder = document.createElement('template');
    holder.innerHTML = html || '';
    return [...holder.content.querySelectorAll('.jdgm-rev')].map((el) => {
      const text = (selector) => el.querySelector(selector)?.textContent.trim() || '';
      const body = el.querySelector('.jdgm-rev__body');
      const paragraphs = body ? [...body.querySelectorAll('p')].map((p) => p.textContent.trim()).filter(Boolean) : [];
      const reply = el.querySelector('.jdgm-rev__reply-content') || el.querySelector('.jdgm-rev__reply');
      return {
        rating: Number(el.querySelector('.jdgm-rev__rating')?.dataset.score) || 0,
        reviewer_name: text('.jdgm-rev__author'),
        title: text('.jdgm-rev__title'),
        body: paragraphs.length ? paragraphs.join('\n') : body?.textContent.trim() || '',
        date: el.querySelector('.jdgm-rev__timestamp')?.getAttribute('datetime') || '',
        verified: el.dataset.verifiedBuyer === 'true',
        reply: reply?.textContent.trim() || '',
        pictures: [...el.querySelectorAll('.jdgm-rev__pic-img')]
          .map((img) => {
            const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
            const full = img.closest('.jdgm-rev__pic-link')?.getAttribute('href') || src;
            return src ? { thumb: sized(src, THUMB_WIDTH), full: sized(full, FULL_WIDTH) } : null;
          })
          .filter(Boolean),
      };
    });
  };

  const formatDate = (value, locale) => {
    const time = typeof value === 'number' ? value : Date.parse(value);
    if (!time || Number.isNaN(time)) return '';
    try {
      return new Intl.DateTimeFormat(locale || 'en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(time);
    } catch {
      return '';
    }
  };

  const fetchPage = async (state, { sort, star, page, perPage }) => {
    const params = new URLSearchParams({
      shop_domain: state.shop,
      url: state.shop,
      platform: 'shopify',
      product_id: state.product,
      page,
      per_page: perPage || PER_PAGE,
      ...SORTS[sort],
    });
    if (star) params.set('filter_rating', star);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const response = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(response.status);
      const data = await response.json();
      return { reviews: parseReviews(data.html), total: Number(data.total_count) || 0 };
    } finally {
      clearTimeout(timer);
    }
  };

  // Five per_page=1 requests: the endpoint has no histogram, but total_count respects filter_rating.
  const fetchCounts = async (state) => {
    try {
      const totals = await Promise.all(
        [1, 2, 3, 4, 5].map((star) => fetchPage(state, { sort: 'all', star, page: 1, perPage: 1 }))
      );
      return totals.map((result) => result.total);
    } catch {
      return null;
    }
  };

  const whenNear = (root, callback) => {
    if (!('IntersectionObserver' in window) || window.Shopify?.designMode) {
      callback();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        callback();
      },
      { rootMargin: '100% 0px' }
    );
    observer.observe(root);
  };

  const initSection = (root) => {
    const list = root.querySelector('[data-rev-list]');
    if (!list) return;

    const $ = (selector) => root.querySelector(selector);
    const summary = $('[data-rev-summary]');
    const photos = $('[data-rev-photos]');
    const wall = $('[data-rev-wall]');
    const status = $('[data-rev-status]');
    const none = $('[data-rev-none]');
    const more = $('[data-rev-more]');
    const foot = $('[data-rev-foot]');
    const labels = root.dataset;

    const lb = $('[data-rev-lb]');
    document.querySelectorAll(`body > [data-rev-lb="${lb?.dataset.revLb}"]`).forEach((stale) => stale.remove());

    const state = {
      shop: labels.revShop,
      product: labels.revProduct,
      locale: labels.revLocale,
      sort: DEFAULT_SORT,
      star: 0,
      page: 1,
      total: 0,
      loaded: 0,
      counts: null,
      wall: [],
      ready: false,
      token: 0,
      loading: false,
      swapTimer: 0,
      pending: [],
      lb: null,
    };
    const reviewOf = new WeakMap();

    state.pending = window.mtReviewStore
      .read()
      .filter((entry) => entry.scope === 'product' && String(entry.productId) === String(state.product))
      .map((entry) => ({
        rating: Number(entry.rating) || 0,
        reviewer_name: entry.name || '',
        title: entry.title || '',
        body: entry.body || '',
        date: entry.time,
        reply: '',
        pictures: [],
        time: entry.time,
      }));

    const setView = (view) => {
      root.dataset.revView = view;
      $('[data-rev-skeleton]').hidden = view !== 'loading';
      $('[data-rev-error]').hidden = view !== 'error';
      $('[data-rev-empty]').hidden = view !== 'empty';
    };

    const ratingLabel = (rating) => fill(labels.revRatingLabel, { rating });

    const stars = (rating) => window.mtStars(rating, 'mt-rev', ratingLabel(rating), 12);

    const tile = (picture, index, count, extra, className) => {
      const button = node('button', className);
      button.type = 'button';
      button.dataset.revPhoto = index;
      button.setAttribute('aria-label', fill(labels.revPhotoLabel, { index: index + 1, count }));
      const image = new Image(THUMB_WIDTH, THUMB_WIDTH);
      image.src = picture.thumb;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      button.append(image);
      if (extra > 0) {
        const overlay = node('span', 'mt-rev__tile-more');
        overlay.append(node('span', 'mt-rev__tile-more-count', `+${extra}`), node('span', 'mt-rev__tile-more-word', labels.revPhotosWord));
        button.append(overlay);
      }
      return button;
    };

    const card = (review) => {
      const item = node('article', 'mt-rev__item');
      item.setAttribute('data-rev-item', '');
      item.setAttribute('data-reveal', '');
      if (review.verified) item.dataset.verified = '';
      reviewOf.set(item, review);

      const who = node('div', 'mt-rev__who');
      who.append(node('p', 'mt-rev__name', review.reviewer_name));
      if (review.rating) who.append(stars(review.rating));
      const date = formatDate(review.date, state.locale);
      if (date) who.append(node('p', 'mt-rev__date', date));

      const comment = node('div', 'mt-rev__comment');
      if (review.title) comment.append(node('p', 'mt-rev__heading', review.title));
      if (review.body) {
        comment.append(node('p', 'mt-rev__text', review.body));
        const toggle = node('button', 'mt-rev__link mt-rev__toggle', labels.revReadMore);
        toggle.type = 'button';
        toggle.hidden = true;
        toggle.setAttribute('data-rev-toggle', '');
        toggle.setAttribute('aria-expanded', 'false');
        comment.append(toggle);
      }
      const count = review.pictures.length;
      if (count) {
        const row = node('div', `mt-rev__pics${count === 1 ? ' mt-rev__pics--single' : ''}`);
        review.pictures.slice(0, CARD_PHOTOS).forEach((picture, index) => {
          const extra = count > CARD_PHOTOS && index === CARD_PHOTOS - 1 ? count - index : 0;
          row.append(tile(picture, index, count, extra, 'mt-rev__pic'));
        });
        comment.append(row);
      }
      if (review.reply) {
        const reply = node('div', 'mt-rev__reply');
        reply.append(node('p', 'mt-rev__reply-label', labels.revReply), node('p', 'mt-rev__reply-text', review.reply));
        comment.append(reply);
      }

      item.append(who, comment);
      return item;
    };

    // Read more only shows when the clamped text actually overflows its two lines.
    const measure = () => {
      list.querySelectorAll('[data-rev-toggle][aria-expanded="false"]').forEach((toggle) => {
        const text = toggle.previousElementSibling;
        toggle.hidden = text.scrollHeight <= text.clientHeight + 1;
      });
    };

    const paintSummary = () => {
      const counts = state.counts;
      const total = counts ? counts.reduce((sum, count) => sum + count, 0) : 0;
      summary.hidden = !total;
      if (!total) return;
      const average = counts.reduce((sum, count, index) => sum + count * (index + 1), 0) / total;
      const shown = average.toFixed(1);
      $('[data-rev-avg]').textContent = shown;
      const avgStars = $('[data-rev-avg-stars]');
      avgStars.setAttribute('aria-label', ratingLabel(shown));
      [...avgStars.children].forEach((star, index) => {
        star.classList.toggle('mt-rev__star--on', index < Math.round(average));
      });
      $('[data-rev-based]').textContent =
        total === 1 ? labels.revBasedOne : fill(labels.revBasedMany, { count: total });
      $('[data-rev-count]').textContent =
        total === 1 ? labels.revCountOne : fill(labels.revCountMany, { count: total });
      summary.toggleAttribute('data-filtered', state.star > 0);
      root.querySelectorAll('[data-rev-star]').forEach((row) => {
        const star = Number(row.dataset.revStar);
        const count = counts[star - 1];
        row.querySelector('[data-rev-dist-fill]').style.width = `${(count / total) * 100}%`;
        row.querySelector('[data-rev-dist-count]').textContent = count;
        row.disabled = count === 0;
        row.setAttribute('aria-pressed', String(state.star === star));
      });
    };

    const paintWall = (reviews) => {
      state.wall = reviews.flatMap((review) => review.pictures.map((picture) => ({ picture, review })));
      const count = state.wall.length;
      photos.hidden = !count;
      if (!count) return;
      $('[data-rev-photos-count]').textContent = fill(labels.revPhotosTitle, { count });
      wall.replaceChildren(
        ...state.wall.map(({ picture }, index) => {
          const extra = count > 8 && index === 7 ? count - index : 0;
          return tile(picture, index, count, extra, 'mt-rev__wall-tile');
        })
      );
    };

    const filterText = (prefix) => {
      const key = state.star && state.sort === 'photos' ? 'Both' : state.star ? 'Star' : 'Photos';
      return fill(labels[`${prefix}${key}`], { star: state.star, count: state.total });
    };

    const filtered = () => state.star > 0 || state.sort === 'photos';

    const paintControls = () => {
      root.querySelectorAll('[data-rev-sort]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.revSort === state.sort));
      });
      status.hidden = !filtered();
      if (filtered()) {
        $('[data-rev-status-long]').textContent = filterText('revShowing');
        $('[data-rev-status-short]').textContent = filterText('revShort');
      }
    };

    const visiblePending = () =>
      state.pending.filter(
        (review) =>
          (!state.star || review.rating === state.star) && (state.sort !== 'photos' || review.pictures.length)
      );

    const paintList = (reviews, replace) => {
      if (replace) list.replaceChildren();
      const items = replace ? [...visiblePending(), ...reviews] : reviews;
      items.forEach((review, index) => {
        const item = card(review);
        item.style.setProperty('--mt-reveal-i', Math.min(index, 5));
        list.append(item);
      });
      none.hidden = list.children.length > 0;
      if (!none.hidden) {
        $('[data-rev-none-title]').textContent = filterText('revNone');
      }
      const remaining = state.total - state.loaded;
      foot.hidden = remaining <= 0;
      more.textContent = fill(labels.revLoadMore, { count: remaining });
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      requestAnimationFrame(measure);
    };

    const settled = (waiting, review) =>
      waiting.rating === review.rating
      && waiting.reviewer_name === review.reviewer_name
      && waiting.title === review.title;

    const settle = (reviews) => {
      const settledTimes = [];
      state.pending = state.pending.filter((waiting) => {
        const done = reviews.some((review) => settled(waiting, review));
        if (done && waiting.time) settledTimes.push(waiting.time);
        return !done;
      });
      if (settledTimes.length) window.mtReviewStore.drop(settledTimes);
    };

    // First load: the default sort's first page doubles as the photo wall, so the wall never refetches.
    const start = async () => {
      setView('loading');
      state.loading = true;
      const token = ++state.token;
      let first;
      let counts;
      try {
        [first, counts] = await Promise.all([
          fetchPage(state, { sort: DEFAULT_SORT, star: 0, page: 1 }),
          fetchCounts(state),
        ]);
      } catch {
        if (token === state.token) {
          state.loading = false;
          setView('error');
        }
        return;
      }
      if (token !== state.token || !list.isConnected) return;
      state.loading = false;
      settle(first.reviews);
      if (!first.total && !state.pending.length) {
        setView('empty');
        return;
      }
      state.ready = true;
      state.sort = DEFAULT_SORT;
      state.star = 0;
      state.page = 1;
      state.total = first.total;
      state.loaded = first.reviews.length;
      state.counts = counts;
      setView('ready');
      paintSummary();
      paintWall(first.reviews);
      paintControls();
      paintList(first.reviews, true);
    };

    const load = async (replace) => {
      if (state.loading && !replace) return;
      state.loading = true;
      const token = ++state.token;
      let data;
      try {
        data = await fetchPage(state, { sort: state.sort, star: state.star, page: state.page });
      } catch {
        if (token === state.token) {
          state.loading = false;
          list.classList.remove('mt-rev__list--swap');
          if (replace) setView('error');
          else state.page -= 1;
        }
        return;
      }
      if (token !== state.token || !list.isConnected) return;
      state.loading = false;
      settle(data.reviews);
      state.total = data.total;
      state.loaded = replace ? data.reviews.length : state.loaded + data.reviews.length;
      setView('ready');
      paintControls();
      paintList(data.reviews, replace);
      list.classList.remove('mt-rev__list--swap');
    };

    const swap = () => {
      clearTimeout(state.swapTimer);
      paintControls();
      paintSummary();
      if (reducedMq.matches) {
        load(true);
        return;
      }
      list.classList.add('mt-rev__list--swap');
      state.swapTimer = setTimeout(() => load(true), SWAP_DELAY);
    };

    const reset = () => {
      state.sort = DEFAULT_SORT;
      state.star = 0;
      state.page = 1;
    };

    /* ---------- Lightbox ---------- */

    const lbImage = lb.querySelector('[data-rev-lb-img]');
    const lbMeta = lb.querySelector('[data-rev-lb-meta]');

    const paintLightbox = () => {
      const { items, index } = state.lb;
      const { picture, review } = items[index];
      lbImage.src = picture.full;
      lbImage.alt = review.reviewer_name || '';
      lb.querySelector('[data-rev-lb-count]').textContent = fill(labels.revLbCounter, {
        index: index + 1,
        count: items.length,
      });
      lb.querySelector('[data-rev-lb-arrows]').hidden = items.length < 2;
      const meta = [];
      if (review.rating) meta.push(stars(review.rating));
      meta.push(node('p', 'mt-rev-lb__name', review.reviewer_name));
      const date = formatDate(review.date, state.locale);
      if (date) meta.push(node('p', 'mt-rev-lb__date', date));
      if (review.title) meta.push(node('p', 'mt-rev-lb__title', review.title));
      if (review.body) meta.push(node('p', 'mt-rev-lb__text', review.body));
      lbMeta.replaceChildren(...meta);
      [items[index + 1], items[index - 1]].forEach((neighbour) => {
        if (neighbour) new Image().src = neighbour.picture.full;
      });
    };

    const openLightbox = (items, index, trigger) => {
      if (!items.length) return;
      if (lb.parentElement !== document.body) document.body.append(lb);
      clearTimeout(state.lbTimer);
      state.lb = { items, index, trigger: window.mtKeyboardFocus(trigger) ? trigger : null };
      paintLightbox();
      lb.hidden = false;
      document.documentElement.classList.add('mt-rev-lock');
      requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('mt-rev-lb--open')));
      lb.querySelector('[data-rev-lb-box]').focus({ preventScroll: true });
    };

    const closeLightbox = () => {
      if (!state.lb) return;
      const { trigger } = state.lb;
      state.lb = null;
      lb.classList.remove('mt-rev-lb--open');
      document.documentElement.classList.remove('mt-rev-lock');
      const finish = () => {
        lb.hidden = true;
        lbImage.removeAttribute('src');
      };
      if (reducedMq.matches) finish();
      else state.lbTimer = setTimeout(finish, LB_CLOSE_DELAY);
      trigger?.focus({ preventScroll: true });
    };

    const stepLightbox = (delta) => {
      if (!state.lb || state.lb.items.length < 2) return;
      const count = state.lb.items.length;
      state.lb.index = (state.lb.index + delta + count) % count;
      paintLightbox();
    };

    lb.addEventListener('click', (event) => {
      const step = event.target.closest('[data-rev-lb-step]');
      if (step) {
        stepLightbox(Number(step.dataset.revLbStep));
        return;
      }
      if (event.target.closest('[data-rev-lb-close]')) closeLightbox();
    });

    const swipe = { x: 0, y: 0 };
    const lbPhoto = lb.querySelector('[data-rev-lb-photo]');
    lbPhoto.addEventListener(
      'touchstart',
      (event) => {
        swipe.x = event.touches[0].clientX;
        swipe.y = event.touches[0].clientY;
      },
      { passive: true }
    );
    lbPhoto.addEventListener(
      'touchend',
      (event) => {
        const dx = event.changedTouches[0].clientX - swipe.x;
        const dy = event.changedTouches[0].clientY - swipe.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepLightbox(dx < 0 ? 1 : -1);
        else if (dy > 70 && dy > Math.abs(dx)) closeLightbox();
      },
      { passive: true }
    );

    document.addEventListener('keydown', (event) => {
      if (!state.lb) return;
      if (event.key === 'Escape') closeLightbox();
      else if (event.key === 'ArrowLeft') stepLightbox(-1);
      else if (event.key === 'ArrowRight') stepLightbox(1);
      else if (event.key === 'Tab') window.mtFocusTrap(event, lb);
    });

    /* ---------- Events ---------- */

    root.addEventListener('click', (event) => {
      const sort = event.target.closest('[data-rev-sort]');
      if (sort) {
        if (sort.getAttribute('aria-pressed') === 'true') return;
        state.sort = sort.dataset.revSort;
        state.page = 1;
        swap();
        return;
      }
      const row = event.target.closest('[data-rev-star]');
      if (row) {
        if (row.disabled) return;
        const star = Number(row.dataset.revStar);
        state.star = state.star === star ? 0 : star;
        state.page = 1;
        swap();
        return;
      }
      if (event.target.closest('[data-rev-clear]')) {
        reset();
        swap();
        return;
      }
      const toggle = event.target.closest('[data-rev-toggle]');
      if (toggle) {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.previousElementSibling.classList.toggle('mt-rev__text--open', open);
        toggle.textContent = open ? labels.revShowLess : labels.revReadMore;
        return;
      }
      const photo = event.target.closest('[data-rev-photo]');
      if (photo) {
        const item = photo.closest('[data-rev-item]');
        const items = item
          ? reviewOf.get(item).pictures.map((picture) => ({ picture, review: reviewOf.get(item) }))
          : state.wall;
        openLightbox(items, Number(photo.dataset.revPhoto), photo);
        return;
      }
      const viewAll = event.target.closest('[data-rev-view-all]');
      if (viewAll) {
        openLightbox(state.wall, 0, viewAll);
        return;
      }
      if (event.target.closest('[data-rev-retry]')) {
        if (state.ready) load(true);
        else start();
        return;
      }
      if (event.target.closest('[data-rev-more]') && !state.loading) {
        state.page += 1;
        load(false);
      }
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 150);
    });
    document.fonts?.ready.then(measure);

    document.addEventListener('mt:review-added', (event) => {
      const detail = event.detail || {};
      if (!list.isConnected || detail.scope !== 'product') return;
      if (String(detail.productId) !== String(state.product)) return;
      const previews = detail.pictures || (detail.picture ? [detail.picture] : []);
      state.pending.unshift({
        rating: Number(detail.rating) || 0,
        reviewer_name: detail.name || '',
        title: detail.title || '',
        body: detail.body || '',
        date: detail.time || Date.now(),
        reply: '',
        pictures: previews.map((preview) => ({ thumb: preview, full: preview })),
        time: detail.time || Date.now(),
      });
      reset();
      state.ready = true;
      setView('ready');
      swap();
    });

    whenNear(root, start);
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
