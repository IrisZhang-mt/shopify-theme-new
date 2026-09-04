if (!window.mtMotionInit) {
  window.mtMotionInit = true;

  window.mtReducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  window.mtCartCount = (count) => {
    document.querySelectorAll('.mt-header__cart').forEach((el) => {
      el.textContent = `(${count})`;
    });
  };

  const STAR_PATH = 'M6 .8l1.55 3.36 3.67.42-2.72 2.5.73 3.62L6 8.87l-3.23 1.83.73-3.62-2.72-2.5 3.67-.42z';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  window.mtStars = (rating, prefix, label, size) => {
    const wrap = document.createElement('span');
    wrap.className = `${prefix}__stars`;
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', label || `${rating}`);
    for (let index = 1; index <= 5; index += 1) {
      const star = document.createElementNS(SVG_NS, 'svg');
      star.setAttribute('width', size);
      star.setAttribute('height', size);
      star.setAttribute('viewBox', '0 0 12 12');
      star.setAttribute('fill', 'currentColor');
      if (index <= rating) star.setAttribute('class', `${prefix}__star--on`);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', STAR_PATH);
      star.append(path);
      wrap.append(star);
    }
    return wrap;
  };

  const REVIEW_STORE_KEY = 'mt-rev-pending';
  const REVIEW_STORE_TTL = 172800000;

  window.mtReviewStore = {
    read: () => {
      try {
        return JSON.parse(sessionStorage.getItem(REVIEW_STORE_KEY) || '[]').filter(
          (entry) => Date.now() - entry.time < REVIEW_STORE_TTL
        );
      } catch {
        return [];
      }
    },
    add: (entry) => {
      try {
        const entries = window.mtReviewStore.read();
        entries.unshift(entry);
        sessionStorage.setItem(REVIEW_STORE_KEY, JSON.stringify(entries.slice(0, 10)));
      } catch {
        return;
      }
    },
    drop: (times) => {
      try {
        const kept = window.mtReviewStore.read().filter((entry) => !times.includes(entry.time));
        sessionStorage.setItem(REVIEW_STORE_KEY, JSON.stringify(kept));
      } catch {
        return;
      }
    },
  };

  window.mtKeyboardFocus = (el) => {
    try {
      return Boolean(el && el.matches(':focus-visible'));
    } catch {
      return false;
    }
  };

  window.mtFocusTrap = (event, container, selector) => {
    const focusables = [
      ...container.querySelectorAll(selector || 'button:not(:disabled), a[href]'),
    ].filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const reducedMq = window.mtReducedMq;
  const hoverMq = window.matchMedia('(hover: hover)');
  const clamp = (value) => Math.min(Math.max(value, 0), 1);

  const rootStyle = getComputedStyle(document.documentElement);
  const slackRem = parseFloat(rootStyle.getPropertyValue('--mt-parallax-slack')) || 9.375;
  window.mtParallaxSlack = slackRem * parseFloat(rootStyle.fontSize);

  document.documentElement.classList.add('mt-motion');

  if (!window.location.hash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  window.mtStripParams = (keys) => {
    const url = new URL(window.location.href);
    if (!keys.some((key) => url.searchParams.has(key))) return;
    keys.forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    try {
      history.replaceState(history.state, '', url);
    } catch {}
  };

  if (window.location.search) window.mtStripParams(['contact_posted', 'customer_posted']);

  const settleReveal = (el) => {
    if (window.mtReducedMq.matches) {
      el.removeAttribute('data-reveal');
      return;
    }
    const timer = setTimeout(() => el.removeAttribute('data-reveal'), 1600);
    el.addEventListener(
      'transitionend',
      (event) => {
        if (event.target !== el) return;
        clearTimeout(timer);
        el.removeAttribute('data-reveal');
      },
      { once: true }
    );
  };

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('mt-in-view');
        revealObserver.unobserve(entry.target);
        settleReveal(entry.target);
      });
    },
    { threshold: 0.15 }
  );

  const observeReveals = () => {
    document.querySelectorAll('[data-reveal]:not(.mt-observed)').forEach((el) => {
      el.classList.add('mt-observed');
      revealObserver.observe(el);
    });
  };

  observeReveals();

  const tasks = new Map();
  let frameRaf = 0;
  let frameLast = 0;
  let scrollValue = window.scrollY;
  let scrollDirty = true;

  const schedule = () => {
    if (!frameRaf) frameRaf = requestAnimationFrame(runFrame);
  };

  window.mtFrame = (measure, apply) => {
    tasks.set(measure, apply);
    schedule();
  };

  const onScroll = () => {
    scrollDirty = true;
    schedule();
  };

  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', onScroll);

  const autoState = new WeakMap();
  let autoRows = [];

  const rowState = (row) => {
    let state = autoState.get(row);
    if (!state) {
      state = { dir: 1, pauseUntil: 0, pos: row.scrollLeft, written: row.scrollLeft, max: 0, visible: false, hover: false, tween: false, tweenFrom: 0, tweenTo: 0, tweenStart: 0, tweenDur: 0 };
      autoState.set(row, state);
    }
    return state;
  };

  const autoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      rowState(entry.target).visible = entry.isIntersecting;
    });
    schedule();
  });

  const eagerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        eagerObserver.unobserve(entry.target);
        entry.target.querySelectorAll('img[loading="lazy"]').forEach((img) => {
          img.loading = 'eager';
        });
      });
    },
    { rootMargin: '600px 0px' }
  );

  const autoResize = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const state = rowState(entry.target);
      state.max = entry.target.scrollWidth - entry.target.clientWidth;
    });
  });

  const onRowScroll = (event) => {
    const row = event.currentTarget;
    const state = rowState(row);
    if (Math.abs(row.scrollLeft - state.written) <= 1) return;
    state.tween = false;
    state.pos = row.scrollLeft;
    state.pauseUntil = performance.now() + 3000;
  };

  const onRowEnter = (event) => {
    rowState(event.currentTarget).hover = true;
  };

  const onRowLeave = (event) => {
    rowState(event.currentTarget).hover = false;
  };

  const onRowTouch = (event) => {
    rowState(event.currentTarget).pauseUntil = performance.now() + 4000;
  };

  const autoScan = () => {
    autoRows = Array.from(document.querySelectorAll('[data-autoplay]'));
    autoRows.forEach((row) => {
      const state = rowState(row);
      state.max = row.scrollWidth - row.clientWidth;
      if (row.dataset.mtAuto) return;
      row.dataset.mtAuto = 'true';
      row.addEventListener('scroll', onRowScroll, { passive: true });
      row.addEventListener('mouseenter', onRowEnter);
      row.addEventListener('mouseleave', onRowLeave);
      row.addEventListener('touchstart', onRowTouch, { passive: true });
      autoObserver.observe(row);
      autoResize.observe(row);
      eagerObserver.observe(row);
    });
    schedule();
  };

  const autoStep = (dt, now) => {
    if (reducedMq.matches) return false;
    let live = false;
    autoRows.forEach((row) => {
      const state = autoState.get(row);
      if (!state || !state.visible || row.hidden || !row.isConnected || state.max <= 0) return;
      live = true;
      if (state.tween) {
        const t = Math.min(1, (now - state.tweenStart) / state.tweenDur);
        state.pos = state.tweenFrom + (state.tweenTo - state.tweenFrom) * (1 - Math.pow(1 - t, 3));
        if (t >= 1) state.tween = false;
        state.written = state.pos;
        row.scrollLeft = state.pos;
        return;
      }
      if (now < state.pauseUntil || (hoverMq.matches && state.hover)) return;
      const speed = Number(row.dataset.autoplay) || 30;
      state.pos += speed * dt * state.dir;
      if (state.pos >= state.max) {
        state.pos = state.max;
        state.dir = -1;
      } else if (state.pos <= 0) {
        state.pos = 0;
        state.dir = 1;
      }
      state.written = state.pos;
      row.scrollLeft = state.pos;
    });
    return live;
  };

  let parallaxItems = [];

  const parallaxObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = parallaxItems.find((candidate) => candidate.wrap === entry.target);
        if (item) item.visible = entry.isIntersecting;
      });
      scrollDirty = true;
      schedule();
    },
    { rootMargin: '15% 0px' }
  );

  const parallaxMeasure = () => {
    parallaxItems.forEach((item) => {
      const rect = item.wrap.getBoundingClientRect();
      item.top = rect.top + scrollValue;
      item.height = rect.height;
    });
  };

  const parallaxScan = () => {
    parallaxObserver.disconnect();
    parallaxItems = Array.from(document.querySelectorAll('[data-mt-parallax]'))
      .map((wrap) => {
        const media = wrap.querySelector('img, video');
        return media ? { wrap, media, top: 0, height: 0, visible: false, last: null } : null;
      })
      .filter(Boolean);
    parallaxMeasure();
    parallaxItems.forEach((item) => parallaxObserver.observe(item.wrap));
    scrollDirty = true;
    schedule();
  };

  const parallaxStep = () => {
    if (reducedMq.matches) return;
    const vh = window.innerHeight;
    parallaxItems.forEach((item) => {
      if (!item.visible || !item.wrap.isConnected) return;
      const top = item.top - scrollValue;
      const shift = -clamp((vh - top) / (vh + item.height)) * window.mtParallaxSlack;
      if (item.last !== null && Math.abs(shift - item.last) < 0.2) return;
      item.last = shift;
      item.media.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
    });
  };

  const HSCROLL_MIN = 8;
  const HSCROLL_VERTICAL_SLACK = 40;

  const scrollableX = (node) => {
    let el = node;
    while (el && el !== document.body) {
      const spanX = el.scrollWidth - el.clientWidth;
      const spanY = el.scrollHeight - el.clientHeight;
      if (spanX > HSCROLL_MIN && spanY < HSCROLL_VERTICAL_SLACK) {
        const overflow = getComputedStyle(el).overflowX;
        if (overflow === 'auto' || overflow === 'scroll') return el;
      }
      el = el.parentElement;
    }
    return null;
  };

  const touchScrollable = (node) => {
    let el = node instanceof Element ? node : node?.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      if (el.scrollHeight - el.clientHeight > 1 && (style.overflowY === 'auto' || style.overflowY === 'scroll')) return el;
      if (el.scrollWidth - el.clientWidth > 1 && (style.overflowX === 'auto' || style.overflowX === 'scroll')) return el;
      el = el.parentElement;
    }
    return null;
  };

  const lockGuard = (event) => {
    if (event.touches.length > 1) return;
    if (!touchScrollable(event.target)) event.preventDefault();
  };

  const lockWheel = (event) => {
    if (!touchScrollable(event.target)) event.preventDefault();
  };

  const LOCK_RE = /\bmt-[a-z]+-lock\b/;
  let lockGuardOn = false;
  const syncLockGuard = () => {
    const locked = LOCK_RE.test(document.documentElement.className);
    if (locked === lockGuardOn) return;
    lockGuardOn = locked;
    if (locked) {
      document.addEventListener('touchmove', lockGuard, { passive: false });
      document.addEventListener('wheel', lockWheel, { passive: false });
    } else {
      document.removeEventListener('touchmove', lockGuard);
      document.removeEventListener('wheel', lockWheel);
    }
  };
  new MutationObserver(syncLockGuard).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  syncLockGuard();

  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) return;
      const row = scrollableX(event.target);
      if (!row) return;
      if (row.hasAttribute('data-wheel-lock')) {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) event.preventDefault();
        return;
      }
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = row.scrollWidth - row.clientWidth;
      if ((event.deltaY < 0 && row.scrollLeft <= 1) || (event.deltaY > 0 && row.scrollLeft >= max - 1)) return;
      const next = row.scrollLeft + event.deltaY;
      event.preventDefault();
      const target = Math.min(Math.max(next, 0), max);
      const state = autoState.get(row);
      if (state) {
        state.pos = target;
        state.written = target;
        state.pauseUntil = performance.now() + 3000;
      }
      row.scrollLeft = target;
    },
    { passive: false }
  );

  document.addEventListener('click', (event) => {
    const arrow = event.target.closest?.('[data-row-arrow]');
    if (!arrow) return;
    const row = arrow.closest('[data-row-stage]')?.querySelector('[data-autoplay]');
    if (!row) return;
    const dir = arrow.dataset.rowArrow === 'next' ? 1 : -1;
    const card = row.firstElementChild;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const pitch = card ? card.getBoundingClientRect().width + gap : row.clientWidth / 2;
    const state = rowState(row);
    const from = state.tween ? state.tweenTo : row.scrollLeft;
    const max = row.scrollWidth - row.clientWidth;
    const target = Math.min(Math.max(from + dir * pitch, 0), max);
    state.dir = dir;
    state.pauseUntil = performance.now() + 4000;
    if (reducedMq.matches) {
      state.tween = false;
      state.pos = target;
      state.written = target;
      row.scrollLeft = target;
      return;
    }
    state.tween = true;
    state.tweenFrom = row.scrollLeft;
    state.tweenTo = target;
    state.tweenStart = performance.now();
    state.tweenDur = 500;
    schedule();
  });

  const MEDIA = '[data-mt-parallax] img, [data-mt-parallax] video, .mt-hero__media img, .mt-hero__media video';

  const mediaScan = () => {
    document.querySelectorAll(MEDIA).forEach((el) => {
      if (el.dataset.mtMedia) return;
      el.dataset.mtMedia = 'true';
      const settle = () => el.classList.add('mt-media--in');
      const ready = el.tagName === 'VIDEO' ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
      if (ready) {
        settle();
        return;
      }
      el.classList.add('mt-media');
      el.addEventListener(el.tagName === 'VIDEO' ? 'loadeddata' : 'load', settle, { once: true });
      el.addEventListener('error', settle, { once: true });
    });
  };

  const decodeWarm = () => {
    const queue = [...document.querySelectorAll('img')].filter(
      (el) => !el.dataset.mtWarm && el.complete && el.naturalWidth > 300
    );
    const next = () => {
      const el = queue.shift();
      if (!el) return;
      el.dataset.mtWarm = 'true';
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 50));
      el.decode()
        .catch(() => {})
        .finally(() => idle(next));
    };
    next();
  };

  const rescan = () => {
    observeReveals();
    autoScan();
    parallaxScan();
    mediaScan();
  };

  document.addEventListener('shopify:section:load', rescan);
  document.addEventListener('mt:reveal-scan', rescan);
  window.addEventListener('resize', () => {
    autoScan();
    parallaxMeasure();
  });
  window.addEventListener('load', () => {
    parallaxMeasure();
    scrollDirty = true;
    schedule();
    decodeWarm();
  });
  reducedMq.addEventListener('change', schedule);

  window.mtScrollTo = (top) => {
    if (reducedMq.matches) {
      window.scrollTo(0, top);
    } else {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const wrapper = document.querySelector('.mt-scroll');
  const inner = document.querySelector('.mt-scroll__inner');
  let lerpStep = () => false;

  if (wrapper && inner) {
    const SPEED = 6.3;
    const root = document.documentElement;
    const pointerMq = window.matchMedia('(hover: hover) and (pointer: fine)');

    let active = false;
    let current = 0;
    let written = 0;
    let jumping = false;
    let jumpFrom = 0;
    let jumpTo = 0;
    let jumpStart = 0;
    let jumpDuration = 0;

    const setBodyHeight = () => {
      document.body.style.height = `${inner.offsetHeight}px`;
    };

    lerpStep = (dt, now) => {
      if (!active) return false;
      if (jumping) {
        const t = Math.min(1, (now - jumpStart) / jumpDuration);
        current = jumpFrom + (jumpTo - jumpFrom) * (1 - Math.pow(1 - t, 4));
        if (t >= 1 || Math.abs(jumpTo - current) < 0.5) {
          current = jumpTo;
          jumping = false;
        }
        written = current;
        wrapper.scrollTop = current;
        window.scrollTo(0, current);
        scrollValue = current;
        return jumping;
      }
      const target = window.scrollY;
      if (Math.abs(target - current) < 0.5) {
        current = target;
        written = current;
        wrapper.scrollTop = current;
        scrollValue = current;
        return false;
      }
      current += (target - current) * (1 - Math.exp(-SPEED * dt));
      written = current;
      wrapper.scrollTop = current;
      scrollValue = current;
      return true;
    };

    const observer = new ResizeObserver(() => {
      if (!active) return;
      setBodyHeight();
      parallaxMeasure();
      schedule();
    });

    const enable = () => {
      if (active) return;
      active = true;
      current = window.scrollY;
      written = current;
      scrollValue = current;
      root.classList.add('mt-smooth');
      setBodyHeight();
      wrapper.scrollTop = current;
      observer.observe(inner);
      parallaxMeasure();
      schedule();
    };

    const disable = () => {
      if (!active) return;
      active = false;
      jumping = false;
      observer.disconnect();
      root.classList.remove('mt-smooth');
      document.body.style.height = '';
      wrapper.scrollTop = 0;
      window.scrollTo(0, current);
      parallaxMeasure();
      schedule();
    };

    const designMode = window.Shopify && window.Shopify.designMode;

    const update = () => {
      if (pointerMq.matches && !reducedMq.matches && !designMode) {
        enable();
      } else {
        disable();
      }
    };

    const jump = (target) => {
      const limit = Math.max(document.body.scrollHeight - window.innerHeight, 0);
      jumpTo = Math.min(Math.max(target, 0), limit);
      jumpFrom = current;
      if (jumpTo === jumpFrom) return;
      jumpDuration = Math.min(900, Math.max(450, Math.abs(jumpTo - jumpFrom) * 0.25));
      jumpStart = performance.now();
      jumping = true;
      schedule();
    };

    const abortJump = () => {
      if (!jumping) return;
      jumping = false;
      schedule();
    };

    window.mtScrollTo = (top) => {
      if (reducedMq.matches) {
        window.scrollTo(0, top);
      } else if (active) {
        jump(top);
      } else {
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };

    window.addEventListener('wheel', abortJump, { passive: true });
    window.addEventListener('touchstart', abortJump, { passive: true });
    wrapper.addEventListener(
      'scroll',
      () => {
        if (!active || jumping) return;
        if (Math.abs(wrapper.scrollTop - written) <= 1) return;
        current = wrapper.scrollTop;
        written = current;
        scrollValue = current;
        window.scrollTo(0, current);
      },
      { passive: true }
    );
    pointerMq.addEventListener('change', update);
    reducedMq.addEventListener('change', update);
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted || !active) return;
      current = window.scrollY;
      written = current;
      scrollValue = current;
      setBodyHeight();
      wrapper.scrollTop = current;
      parallaxMeasure();
      schedule();
    });
    update();
  }

  function runFrame(now) {
    frameRaf = 0;
    const dt = frameLast ? Math.min((now - frameLast) / 1000, 0.1) : 0;
    frameLast = now;

    const lerping = lerpStep(dt, now);
    if (!lerping) scrollValue = window.scrollY;

    const rolling = autoStep(dt, now);

    if (scrollDirty || lerping) {
      parallaxStep();
      scrollDirty = false;
    }

    if (tasks.size) {
      const pending = [...tasks];
      tasks.clear();
      const measured = pending.map(([measure]) => measure());
      pending.forEach(([, apply], index) => {
        if (apply) apply(measured[index]);
      });
    }

    if (lerping || rolling || tasks.size) schedule();
  }

  autoScan();
  parallaxScan();
  mediaScan();
}
