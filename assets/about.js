if (!window.mtAboutInit) {
  window.mtAboutInit = true;

  const reducedMq = window.mtReducedMq;
  const deskMq = window.matchMedia('(min-width: 750px)');

  const splitScrub = () => {
    if (reducedMq.matches) return;
    document.querySelectorAll('[data-abt-scrub]:not(.mt-split)').forEach((block) => {
      block.classList.add('mt-split');
      const words = [];
      block.querySelectorAll('p').forEach((p) => {
        const parts = p.textContent.split(/\s+/).filter(Boolean);
        p.textContent = '';
        parts.forEach((word) => {
          const span = document.createElement('span');
          span.className = 'mt-abt-intro__w';
          span.textContent = word;
          p.append(span, ' ');
          words.push(span);
        });
      });
      block.mtWords = words;
      block.mtCount = 0;
    });
  };

  const clamp = (value) => Math.min(Math.max(value, 0), 1);

  const measure = () => {
    const vh = window.innerHeight;
    const scrubs = [];
    const shades = [];

    if (!reducedMq.matches) {
      document.querySelectorAll('[data-abt-scrub].mt-split').forEach((block) => {
        const words = block.mtWords;
        if (!words || !words.length) return;
        const rect = block.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const progress = clamp((vh * 0.85 - rect.top) / (rect.height + vh * 0.35));
        const count = Math.round(progress * words.length);
        if (count !== block.mtCount) scrubs.push({ block, words, count });
      });
    }

    const cards = document.querySelectorAll('.mt-fab__card');
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next || !deskMq.matches || reducedMq.matches) {
        shades.push({ card, shade: null });
        return;
      }
      const covered = clamp(1 - next.getBoundingClientRect().top / vh);
      shades.push({ card, shade: (covered * 0.35).toFixed(3) });
    });

    const hero = document.querySelector('[data-abt-hero]:not([hidden])');
    const toggle = hero && hero.querySelector('[data-abt-toggle]');
    const float = toggle ? hero.getBoundingClientRect().bottom < vh : false;

    return { scrubs, shades, toggle, float };
  };

  const apply = ({ scrubs, shades, toggle, float }) => {
    scrubs.forEach(({ block, words, count }) => {
      const from = Math.min(count, block.mtCount);
      const to = Math.max(count, block.mtCount);
      for (let i = from; i < to; i += 1) {
        words[i].classList.toggle('mt-on', i < count);
      }
      block.mtCount = count;
    });
    shades.forEach(({ card, shade }) => {
      if (shade === null) {
        card.style.removeProperty('--mt-fab-shade');
      } else {
        card.style.setProperty('--mt-fab-shade', shade);
      }
    });
    if (toggle) toggle.classList.toggle('mt-abt-toggle--float', float);
  };

  const queue = () => window.mtFrame(measure, apply);

  const switchView = (view, animate) => {
    const tagged = document.querySelectorAll('[data-abt-view]');
    if (!tagged.length) return;
    tagged.forEach((el) => {
      const show = el.dataset.abtView === view;
      if (show && el.hidden && animate && !reducedMq.matches) {
        el.querySelectorAll('[data-reveal]').forEach((item) => {
          item.classList.remove('mt-in-view', 'mt-observed');
        });
      }
      el.hidden = !show;
      el.querySelectorAll('video').forEach((video) => {
        if (show) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    });
    if (animate) {
      window.scrollTo(0, 0);
      const wrap = document.querySelector('.mt-scroll');
      if (wrap) wrap.scrollTop = 0;
    }
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    try {
      const url = view === 'materials' ? '#our-materials' : window.location.pathname + window.location.search;
      history.replaceState(history.state, '', url);
    } catch {}
    queue();
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-abt-switch]');
    if (!button) return;
    const view = button.dataset.abtSwitch;
    if (document.querySelector(`[data-abt-view="${view}"]:not([hidden])`)) return;
    switchView(view, true);
  });

  document.addEventListener('shopify:section:select', (event) => {
    const tagged = event.target.querySelector('[data-abt-view]');
    if (tagged && tagged.hidden) switchView(tagged.dataset.abtView, false);
  });

  document.addEventListener(
    'play',
    (event) => {
      if (event.target.closest && event.target.closest('[data-abt-view][hidden]')) {
        event.target.pause();
      }
    },
    true
  );

  const syncToHash = (animate) => {
    const view = window.location.hash === '#our-materials' ? 'materials' : 'story';
    if (document.querySelector(`[data-abt-view="${view}"]:not([hidden])`)) return;
    switchView(view, animate);
  };

  splitScrub();
  syncToHash(false);
  queue();

  window.addEventListener('hashchange', () => syncToHash(true));

  document.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  window.addEventListener('load', queue);
  reducedMq.addEventListener('change', () => {
    splitScrub();
    queue();
  });
  deskMq.addEventListener('change', queue);
  document.addEventListener('shopify:section:load', () => {
    splitScrub();
    queue();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      syncToHash(false);
      queue();
    }
  });
}
