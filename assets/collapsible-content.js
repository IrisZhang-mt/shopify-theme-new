if (!window.mtCollapseInit) {
  window.mtCollapseInit = true;

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('[data-collapse-toggle]');
    if (!toggle) return;
    const item = toggle.closest('[data-collapse-item]');
    if (!item) return;
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    item.classList.toggle('mt-collapse__item--open', open);
  });
}
