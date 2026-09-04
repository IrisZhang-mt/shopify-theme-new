if (!window.mtHeroInit) {
  window.mtHeroInit = true;

  const reducedMq = window.mtReducedMq;
  const slack = () => window.mtParallaxSlack || 150;

  const measure = () =>
    Array.from(document.querySelectorAll('.mt-hero')).map((hero) => {
      const rect = hero.getBoundingClientRect();
      return {
        media: hero.querySelectorAll('.mt-hero__media img, .mt-hero__media video'),
        visible: rect.bottom > 0 && rect.top < window.innerHeight,
        shift: Math.min(Math.max(-rect.top, 0) * 0.15, slack()),
      };
    });

  const apply = (items) => {
    items.forEach((item) => {
      if (!item.visible) return;
      item.media.forEach((media) => {
        media.style.transform = `translate3d(0, ${-item.shift}px, 0)`;
      });
    });
  };

  const queue = () => {
    if (reducedMq.matches) return;
    window.mtFrame(measure, apply);
  };

  const initSlides = () => {
    document.querySelectorAll('[data-hero]').forEach((hero) => {
      if (hero.dataset.heroReady) return;
      const slides = [...hero.querySelectorAll('[data-hero-slide]')];
      if (slides.length < 2) return;
      hero.dataset.heroReady = 'true';
      const dots = [...hero.querySelectorAll('[data-hero-dot]')];
      let index = 0;
      let timer = 0;
      const show = (next) => {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          const active = i === index;
          slide.classList.toggle('mt-hero__slide--active', active);
          slide.querySelectorAll('video').forEach((video) => {
            if (active || i === 0) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          });
        });
        dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
      };
      const stop = () => {
        clearInterval(timer);
        timer = 0;
      };
      const play = () => {
        if (timer || reducedMq.matches || document.hidden) return;
        timer = setInterval(() => {
          if (!hero.isConnected) {
            stop();
            return;
          }
          show(index + 1);
        }, 6000);
      };
      hero.addEventListener('pointerenter', stop);
      hero.addEventListener('pointerleave', play);
      hero.addEventListener('focusin', stop);
      hero.addEventListener('focusout', (event) => {
        if (!hero.contains(event.relatedTarget)) play();
      });
      dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
          stop();
          show(i);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (!hero.isConnected) return;
        if (document.hidden) stop();
        else play();
      });
      reducedMq.addEventListener('change', () => {
        if (!hero.isConnected) return;
        if (reducedMq.matches) stop();
        else play();
      });
      show(0);
      play();
    });
  };

  document.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  document.addEventListener('shopify:section:load', () => {
    queue();
    initSlides();
  });
  queue();
  initSlides();
}
