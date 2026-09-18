if (!window.mtHeroInit) {
  window.mtHeroInit = true;

  const reducedMq = window.mtReducedMq;
  const desktopMq = window.matchMedia('(min-width: 750px)');
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

  const trackBanner = (slide) => {
    if (!slide || slide.dataset.bannerTracked) return;
    slide.dataset.bannerTracked = 'true';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_banner',
      event_parameters: {
        module_name: 'Top Banner',
        banner_slot: slide.dataset.bannerSlot,
        banner_name: slide.dataset.bannerName,
      },
    });
  };

  const applicableVideo = (video) => {
    const isPc = video.classList.contains('mt-hero__video--pc');
    const isMob = video.classList.contains('mt-hero__video--mob');
    return (!isPc && !isMob) || (isPc && desktopMq.matches) || (isMob && !desktopMq.matches);
  };

  const syncVideos = (slide, active) => {
    slide.querySelectorAll('video').forEach((video) => {
      if (applicableVideo(video) && active) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  };

  const setActiveDot = (hero, activeDot) => {
    hero.querySelectorAll('[data-hero-dot]').forEach((dot) => {
      dot.setAttribute('aria-current', String(dot === activeDot));
    });
  };

  const initSlides = () => {
    document.querySelectorAll('[data-hero]').forEach((hero) => {
      if (hero.dataset.heroReady) return;
      const slides = [...hero.querySelectorAll('[data-hero-slide]')];
      if (slides.length < 2) {
        trackBanner(slides[0]);
        if (slides[0] && !hero.dataset.heroVideoReady) {
          hero.dataset.heroVideoReady = 'true';
          syncVideos(slides[0], true);
          desktopMq.addEventListener('change', () => syncVideos(slides[0], true));
        }
        return;
      }
      hero.dataset.heroReady = 'true';
      const dots = [...hero.querySelectorAll('[data-hero-dot]')];
      let index = 0;
      let timer = 0;
      const show = (next) => {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          const active = i === index;
          slide.classList.toggle('mt-hero__slide--active', active);
          syncVideos(slide, active || i === 0);
        });
        setActiveDot(hero, dots[index]);
        trackBanner(slides[index]);
      };
      const stop = () => {
        clearInterval(timer);
        timer = 0;
      };
      const play = () => {
        if (timer || reducedMq.matches || document.hidden) return;
        const interval = (parseFloat(hero.dataset.heroInterval) || 5) * 1000;
        timer = setInterval(() => {
          if (!hero.isConnected) {
            stop();
            return;
          }
          show(index + 1);
        }, interval);
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
      desktopMq.addEventListener('change', () => {
        if (!hero.isConnected) return;
        show(index);
      });
      show(0);
      play();
    });
  };

  document.addEventListener('click', (event) => {
    const banner = event.target.closest?.('.mt-hero__cta, .mt-hero__slide-link, .mt-hero__panel-link');
    if (!banner) return;
    const slot = (!desktopMq.matches && banner.dataset.mobileBannerSlot) || banner.dataset.bannerSlot;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'click_banner',
      event_parameters: {
        module_name: 'Top Banner',
        banner_slot: slot,
        banner_name: banner.dataset.bannerName,
        button_name: banner.dataset.buttonName,
      },
    });
  });

  document.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  document.addEventListener('shopify:section:load', () => {
    queue();
    initSlides();
  });
  queue();
  initSlides();
}
