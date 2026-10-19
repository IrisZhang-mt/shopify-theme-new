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

  const tabsOf = (nav) => [...nav.querySelectorAll('[data-atabs-target]')];
  const targetOf = (tab) => (tab.dataset.atabsTarget ? document.getElementById(tab.dataset.atabsTarget) : null);

  // The last tab's region is its target plus the section right after it
  // (on the campaign page: the banner and its product grid).
  const regionEnd = (nav) => {
    const last = tabsOf(nav).map(targetOf).filter(Boolean).at(-1);
    if (!last) return Infinity;
    const section = last.closest('.shopify-section') || last;
    return (section.nextElementSibling || section).getBoundingClientRect().bottom;
  };

  const setActive = (nav, index) => {
    tabsOf(nav).forEach((tab, i) => {
      tab.classList.toggle('is-active', i === index);
      if (i === index) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
  };

  // While a click-initiated smooth scroll runs, scroll-spy stays out of the way.
  const locked = new WeakSet();

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

    if (locked.has(nav)) return;
    const line = headerBottom + stuckH + 8;
    let active = 0;
    tabsOf(nav).forEach((tab, i) => {
      const target = targetOf(tab);
      if (target && target.getBoundingClientRect().top <= line) active = i;
    });
    setActive(nav, active);
  };

  const scrollToTarget = (nav, target, behavior) => {
    // Once scrolled, the announcement bar is gone and the header sits at the top.
    const offset = (header()?.offsetHeight || 0) + stuckHeight(nav);
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
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
    locked.add(nav);
    const release = () => {
      locked.delete(nav);
      queue();
    };
    if ('onscrollend' in window) window.addEventListener('scrollend', release, { once: true });
    setTimeout(release, 1200);
    scrollToTarget(nav, target, reducedMq.matches ? 'auto' : 'smooth');
  });

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

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  window.addEventListener('pageshow', queue);
  document.addEventListener('shopify:section:load', queue);
  document.addEventListener('shopify:section:unload', queue);
  queue();
}
