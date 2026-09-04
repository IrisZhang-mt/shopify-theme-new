if (!window.mtBestSellersInit) {
  window.mtBestSellersInit = true;

  const panelState = new WeakMap();

  const getPanels = (section) => {
    let state = panelState.get(section);
    if (state) return state;
    const panels = new Map();
    section.querySelectorAll('template[data-bs-panel]').forEach((template) => {
      panels.set(template.dataset.bsPanel, template.content);
      template.remove();
    });
    state = { panels, current: '0' };
    panelState.set(section, state);
    return state;
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.mt-bs__filter');
    if (!button) return;
    const section = button.closest('.mt-bs');
    const row = section.querySelector('[data-bs-row]');
    const key = button.dataset.bsTarget;
    const state = getPanels(section);
    if (key === state.current) return;

    const stash = document.createDocumentFragment();
    stash.append(...row.childNodes);
    state.panels.set(state.current, stash);

    const next = state.panels.get(key);
    if (next) {
      next.querySelectorAll?.('[data-reveal]').forEach((el) => {
        el.classList.remove('mt-in-view', 'mt-observed');
      });
      row.append(next);
    }
    state.current = key;
    row.scrollLeft = 0;

    section.querySelectorAll('.mt-bs__filter').forEach((item) => {
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    const cta = section.querySelector('[data-bs-cta]');
    if (cta) {
      cta.href = button.dataset.bsUrl;
      const text = cta.querySelector('[data-bs-cta-text]');
      if (text) text.textContent = (window.mtStrings?.shopCollection || 'Shop [label]').replace('[label]', button.dataset.bsLabel);
    }
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
  });
}
