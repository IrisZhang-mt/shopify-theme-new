if (!window.mtAnnounceInit) {
  window.mtAnnounceInit = true;

  const timers = new WeakMap();
  const paused = new WeakSet();
  const bound = new WeakSet();

  const slidesOf = (bar) => Array.from(bar.querySelectorAll('[data-announce-slide]'));

  const show = (bar, next) => {
    const slides = slidesOf(bar);
    slides.forEach((slide, index) => {
      const on = index === next;
      slide.classList.toggle('mt-on', on);
      slide.setAttribute('aria-hidden', on ? 'false' : 'true');
      slide.querySelectorAll('a[href], button').forEach((focusable) => {
        if (on) focusable.removeAttribute('tabindex');
        else focusable.setAttribute('tabindex', '-1');
      });
    });
    bar.dataset.announceIndex = String(next);
  };

  const stop = (bar) => {
    const timer = timers.get(bar);
    if (timer) clearInterval(timer);
    timers.delete(bar);
  };

  const start = (bar) => {
    stop(bar);
    const slides = slidesOf(bar);
    if (slides.length < 2) return;
    const every = Math.max(3, Number(bar.dataset.announceEvery) || 5) * 1000;
    timers.set(
      bar,
      setInterval(() => {
        if (document.hidden || paused.has(bar) || !bar.isConnected) return;
        const current = Number(bar.dataset.announceIndex) || 0;
        show(bar, (current + 1) % slides.length);
      }, every)
    );
  };

  const bind = (bar) => {
    if (bound.has(bar)) return;
    bound.add(bar);
    bar.addEventListener('mouseenter', () => paused.add(bar));
    bar.addEventListener('mouseleave', () => paused.delete(bar));
    bar.addEventListener('focusin', () => paused.add(bar));
    bar.addEventListener('focusout', () => paused.delete(bar));
  };

  const scan = () => {
    document.querySelectorAll('[data-announce]').forEach((bar) => {
      if (!bar.dataset.announceIndex) show(bar, 0);
      bind(bar);
      start(bar);
    });
    queueOffset();
  };

  let offsetFrame = 0;
  const writeOffset = () => {
    offsetFrame = 0;
    const bar = document.querySelector('[data-announce]');
    const offset = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
    document.documentElement.style.setProperty('--mt-announce-offset', `${offset}px`);
  };
  function queueOffset() {
    if (offsetFrame) return;
    offsetFrame = requestAnimationFrame(writeOffset);
  }

  window.addEventListener('scroll', queueOffset, { passive: true });
  window.addEventListener('resize', queueOffset);
  window.addEventListener('pageshow', queueOffset);
  window.addEventListener('orientationchange', queueOffset);

  document.addEventListener('shopify:section:load', scan);
  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll?.('[data-announce]').forEach(stop);
    queueOffset();
  });

  scan();
}
