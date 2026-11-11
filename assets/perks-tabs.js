if (!window.mtPerksTabsInit) {
  window.mtPerksTabsInit = true;

  const tabsOf = (root) => [...root.querySelectorAll('[data-perks-tab]')];

  const setActive = (root, index) => {
    const tabs = tabsOf(root);
    const panels = [...root.querySelectorAll('[data-perks-panel]')];
    const dots = [...root.querySelectorAll('[data-perks-dot]')];
    if (!tabs[index] || tabs[index].classList.contains('is-active')) return;

    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    panels.forEach((panel, i) => {
      const on = i === index;
      panel.hidden = !on;
      panel.classList.remove('is-entering');
      if (on) {
        void panel.offsetWidth; // restart the fade when tabs are switched quickly
        panel.classList.add('is-entering');
      }
    });
  };

  const push = (eventName, parameters) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({ event: 'ga4Event', event_name: eventName, event_parameters: parameters });
  };

  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-perks-tab]');
    const root = tab?.closest('[data-perks]');
    if (!root) return;
    setActive(root, tabsOf(root).indexOf(tab));

    // GA4 (sheet No.84 / No.85). A tab with [data-spin-open] is also opened by spin-wheel.js.
    const moduleName = root.dataset.moduleName;
    push('select_content_category', {
      module_name: moduleName,
      button_name: tab.querySelector('.mt-perks__title')?.textContent.replace(/\s+/g, ' ').trim(),
    });
    if (tab.hasAttribute('data-spin-open')) {
      push('spin_entry', {
        module_name: moduleName,
        login_status: root.hasAttribute('data-logged-in') ? 'logged_in' : 'guest',
      });
    }
  });

  // Arrow keys move between tabs (switches the grid only — no dialog, no GA4).
  document.addEventListener('keydown', (event) => {
    const tab = event.target.closest?.('[data-perks-tab]');
    const root = tab?.closest('[data-perks]');
    if (!root) return;
    const tabs = tabsOf(root);
    const current = tabs.indexOf(tab);
    const last = tabs.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(root, next);
    tabs[next].focus();
  });

  // Theme editor: selecting a tab block shows its grid.
  document.addEventListener('shopify:block:select', (event) => {
    const tab = event.target.closest?.('[data-perks-tab]');
    const root = tab?.closest('[data-perks]');
    if (root) setActive(root, tabsOf(root).indexOf(tab));
  });
}
