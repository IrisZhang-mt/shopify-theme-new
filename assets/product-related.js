if (!window.mtRelInit) {
  window.mtRelInit = true;

  const init = (scope) => {
    scope.querySelectorAll('[data-rel]').forEach((section) => {
      if (section.dataset.mtReady || !section.dataset.url) return;
      section.dataset.mtReady = 'true';

      const load = async () => {
        const pool = [...section.querySelectorAll('[data-rel-fallback] .mt-card')];
        let fresh = null;
        try {
          const res = await fetch(section.dataset.url);
          if (!res.ok) throw new Error(res.status);
          const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
          fresh = doc.querySelector('[data-rel]');
        } catch {
          fresh = null;
        }
        if (!section.isConnected) return;
        const row = fresh ? fresh.querySelector('.mt-pdp-rel__row') : null;
        if (row) {
          const keyOf = (card) => card.querySelector('.mt-card__link')?.getAttribute('href')?.split('?')[0];
          const seen = new Set([...row.querySelectorAll('.mt-card')].map(keyOf));
          for (const card of pool) {
            if (row.querySelectorAll('.mt-card').length >= 8) break;
            const key = keyOf(card);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            row.appendChild(card);
          }
        }
        if (!fresh || !fresh.querySelector('.mt-card')) {
          section.hidden = true;
          return;
        }
        section.replaceChildren(...fresh.children);
        section.classList.remove('mt-pdp-rel--pending');
        document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      };

      load();
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
