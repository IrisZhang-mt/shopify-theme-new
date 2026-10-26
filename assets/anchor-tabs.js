if (!window.mtAnchorTabsInit) {
  window.mtAnchorTabsInit = true;

  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = () => document.querySelector('.section-header');

  const remToPx = (value) => {
    const n = parseFloat(value) || 0;
    if (!value.trim().endsWith('rem')) return n;
    return n * parseFloat(getComputedStyle(document.documentElement).fontSize);
  };
  const stuckHeight = (nav) => remToPx(getComputedStyle(nav).getPropertyValue('--mt-atabs-stuck-h'));

  // With motion.js smooth scrolling on (html.mt-smooth) the page is drawn from .mt-scroll,
  // whose scrollTop eases behind window.scrollY; on-screen positions follow that one.
  const smoothWrapper = () =>
    document.documentElement.classList.contains('mt-smooth') ? document.querySelector('.mt-scroll') : null;
  const visualScrollY = () => smoothWrapper()?.scrollTop ?? window.scrollY;

  const tabsOf = (nav) => [...nav.querySelectorAll('[data-atabs-target]')];
  const targetOf = (tab) => (tab.dataset.atabsTarget ? document.getElementById(tab.dataset.atabsTarget) : null);

  // The last tab's region: a Full image target covers itself plus the section
  // right after it (the banner and its product grid); any other target (e.g. a
  // Product grid) covers just its own section.
  const regionEnd = (nav) => {
    const last = tabsOf(nav).map(targetOf).filter(Boolean).at(-1);
    if (!last) return Infinity;
    const section = last.closest('.shopify-section') || last;
    const end = last.matches('.mt-full-image') ? section.nextElementSibling || section : section;
    return end.getBoundingClientRect().bottom;
  };

  const setActive = (nav, index) => {
    tabsOf(nav).forEach((tab, i) => {
      tab.classList.toggle('is-active', i === index);
      if (i === index) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
  };

  // While a click-initiated scroll runs, scroll-spy stays out of the way until the page
  // is drawn at the requested position (nav → that scroll position).
  const locked = new WeakMap();

  const update = (nav) => {
    const headerBottom = Math.max(0, header()?.getBoundingClientRect().bottom || 0);
    const stuckH = stuckHeight(nav);
    const navTop = nav.getBoundingClientRect().top;
    const stick = navTop < headerBottom && regionEnd(nav) > headerBottom + stuckH;

    if (stick && !nav.classList.contains('is-stuck')) {
      nav.style.height = `${nav.offsetHeight}px`;
      nav.classList.add('is-stuck');
    } else if (!stick && nav.classList.contains('is-stuck')) {
      nav.classList.remove('is-stuck');
      nav.style.height = '';
    }
    nav.style.setProperty('--mt-atabs-top', `${headerBottom}px`);

    if (locked.has(nav)) {
      if (Math.abs(visualScrollY() - locked.get(nav)) > 2) return;
      locked.delete(nav);
    }
    const line = headerBottom + stuckH + 8;
    let active = 0;
    tabsOf(nav).forEach((tab, i) => {
      const target = targetOf(tab);
      if (target && target.getBoundingClientRect().top <= line) active = i;
    });
    setActive(nav, active);
  };

  // Once scrolled, the announcement bar is gone and the header sits at the top.
  const scrollTopFor = (nav, target) => {
    const offset = (header()?.offsetHeight || 0) + stuckHeight(nav);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, Math.min(target.getBoundingClientRect().top + visualScrollY() - offset, max));
  };

  const scrollToTarget = (nav, target, behavior) => {
    const top = scrollTopFor(nav, target);
    // mtScrollTo drives motion.js's smooth scroll directly instead of easing twice.
    if (behavior === 'smooth' && window.mtScrollTo) window.mtScrollTo(top);
    else window.scrollTo({ top, behavior });
    return top;
  };

  let frame = 0;
  const queue = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      document.querySelectorAll('[data-atabs]').forEach(update);
    });
  };

  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-atabs-target]');
    if (!tab) return;
    const nav = tab.closest('[data-atabs]');
    const target = targetOf(tab);
    // Always stay on the clean URL; a missing target simply does nothing.
    event.preventDefault();
    if (!nav || !target) return;

    setActive(nav, tabsOf(nav).indexOf(tab));
    const top = scrollToTarget(nav, target, reducedMq.matches ? 'auto' : 'smooth');
    locked.set(nav, top);
    // Fallback in case the page never gets exactly there.
    setTimeout(() => {
      if (locked.get(nav) !== top) return;
      locked.delete(nav);
      queue();
    }, 2000);
    queue();
  });

  // The user took over the scroll: hand control back to scroll-spy.
  const unlockAll = () => {
    document.querySelectorAll('[data-atabs]').forEach((nav) => locked.delete(nav));
    queue();
  };
  window.addEventListener('wheel', unlockAll, { passive: true });
  window.addEventListener('touchstart', unlockAll, { passive: true });

  // A shared link with #anchor: land below the header and the stuck bar.
  window.addEventListener('load', () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    document.querySelectorAll('[data-atabs]').forEach((nav) => {
      const tab = tabsOf(nav).find((t) => t.dataset.atabsTarget === id);
      const target = tab && targetOf(tab);
      if (target) scrollToTarget(nav, target, 'auto');
    });
  });

  // The reserved in-page height depends on the breakpoint, so re-measure from scratch.
  const reset = () => {
    document.querySelectorAll('[data-atabs].is-stuck').forEach((nav) => {
      nav.classList.remove('is-stuck');
      nav.style.height = '';
    });
    queue();
  };

  window.addEventListener('scroll', queue, { passive: true });
  // The smooth-scroll wrapper keeps moving after window scroll events stop.
  document.querySelector('.mt-scroll')?.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', reset);
  window.addEventListener('pageshow', queue);
  document.addEventListener('shopify:section:load', queue);
  document.addEventListener('shopify:section:unload', queue);
  queue();
}
