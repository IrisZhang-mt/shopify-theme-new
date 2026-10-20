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

  const loadSlide = (slide) => {
    slide.querySelectorAll('[data-srcset]').forEach((el) => {
      el.srcset = el.dataset.srcset;
      el.removeAttribute('data-srcset');
    });
  };

  const slideReady = (slide) =>
    !slide.querySelector('[data-srcset]') && [...slide.querySelectorAll('img')].every((img) => img.complete);

  const setActiveDot = (hero, activeDot) => {
    hero.querySelectorAll('[data-hero-dot]').forEach((dot) => {
      dot.setAttribute('aria-current', String(dot === activeDot));
    });
  };

  const initSlides = () => {
    document.querySelectorAll('[data-hero]').forEach((hero) => {
      if (hero.dataset.heroReady) return;
      const domSlides = [...hero.querySelectorAll('[data-hero-slide]')];
      // The panel slide is always first in the DOM (it's the in-flow base layer); display order is banner_slot.
      const base = domSlides[0];
      const slides = [...domSlides].sort((a, b) => parseFloat(a.dataset.bannerSlot) - parseFloat(b.dataset.bannerSlot));
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
      let baseShown = false;
      const show = (next) => {
        index = (next + slides.length) % slides.length;
        loadSlide(slides[index]);
        if (slides[index] === base) baseShown = true;
        slides.forEach((slide, i) => {
          const active = i === index;
          slide.classList.toggle('mt-hero__slide--active', active);
          syncVideos(slide, active || (slide === base && baseShown));
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
          const upcoming = slides[(index + 1) % slides.length];
          if (!slideReady(upcoming)) {
            loadSlide(upcoming);
            return;
          }
          show(index + 1);
        }, interval);
      };
      // Later slides start loading halfway through the first interval, after the
      // first slide has had the bandwidth to itself.
      setTimeout(() => slides.slice(1).forEach(loadSlide), (parseFloat(hero.dataset.heroInterval) || 5) * 500);
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
      document.addEventListener('mt:lock-change', (event) => {
        if (!hero.isConnected) return;
        if (event.detail.locked) stop();
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

  const initSwipe = () => {
    document.querySelectorAll('[data-hero]').forEach((hero) => {
      if (hero.dataset.heroSwipeReady) return;
      hero.dataset.heroSwipeReady = 'true';
      let startX = 0;
      let startY = 0;
      let tracking = false;
      hero.addEventListener(
        'touchstart',
        (event) => {
          if (desktopMq.matches || event.touches.length > 1) {
            tracking = false;
            return;
          }
          startX = event.touches[0].clientX;
          startY = event.touches[0].clientY;
          tracking = true;
        },
        { passive: true }
      );
      hero.addEventListener('touchcancel', () => {
        tracking = false;
      });
      hero.addEventListener(
        'touchend',
        (event) => {
          if (!tracking) return;
          tracking = false;
          const touch = event.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
          const dots = [...hero.querySelectorAll('[data-hero-dot]')];
          if (dots.length < 2) return;
          const current = dots.findIndex((dot) => dot.getAttribute('aria-current') === 'true');
          const from = current === -1 ? 0 : current;
          const next = dx < 0 ? (from + 1) % dots.length : (from - 1 + dots.length) % dots.length;
          dots[next].click();
        },
        { passive: true }
      );
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
    initSwipe();
  });
  queue();
  initSlides();
  initSwipe();
}
