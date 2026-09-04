if (!window.mtFaqsInit) {
  window.mtFaqsInit = true;

  const OFFSET = 80;

  const measure = () =>
    Array.from(document.querySelectorAll('[data-faqs]')).map((root) => {
      const groups = root.querySelectorAll('[data-faqs-group][id]');
      let current = groups.length ? groups[0].id : '';
      groups.forEach((group) => {
        if (group.getBoundingClientRect().top <= OFFSET + 40) current = group.id;
      });
      return { chips: root.querySelectorAll('[data-faqs-chip]'), current };
    });

  const apply = (roots) => {
    roots.forEach(({ chips, current }) => {
      chips.forEach((chip) => {
        chip.classList.toggle('mt-on', chip.getAttribute('href') === '#' + current);
      });
    });
  };

  const queue = () => window.mtFrame(measure, apply);

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-faqs-toggle]');
    if (toggle) {
      const item = toggle.closest('[data-faqs-item]');
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      item.classList.toggle('mt-faqs__item--open', open);
      return;
    }
    const chip = event.target.closest('[data-faqs-chip]');
    if (!chip) return;
    const target = document.querySelector(chip.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    let top = -OFFSET;
    let node = target;
    while (node) {
      top += node.offsetTop;
      node = node.offsetParent;
    }
    if (window.mtScrollTo) {
      window.mtScrollTo(top);
    } else {
      window.scrollTo(0, top);
    }
    try {
      history.replaceState(history.state, '', chip.getAttribute('href'));
    } catch {}
  });

  document.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  document.addEventListener('shopify:section:load', queue);
  queue();
}
