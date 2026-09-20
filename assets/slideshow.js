if (!window.mtSlideshowInit) {
  window.mtSlideshowInit = true;

  const reducedMq = window.mtReducedMq;

  const trackBanner = (moduleName, slide) => {
    if (!slide || slide.dataset.bannerTracked) return;
    slide.dataset.bannerTracked = 'true';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'view_banner',
      event_parameters: {
        module_name: moduleName,
        banner_slot: slide.dataset.bannerSlot,
        banner_name: slide.dataset.bannerName,
      },
    });
  };

  const syncVideos = (slide, active) => {
    slide.querySelectorAll('video').forEach((video) => {
      if (active) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  };

  const setActiveDot = (root, activeDot) => {
    root.querySelectorAll('[data-slideshow-dot]').forEach((dot) => {
      dot.setAttribute('aria-current', String(dot === activeDot));
    });
  };

  const init = () => {
    document.querySelectorAll('[data-slideshow]').forEach((root) => {
      if (root.dataset.slideshowReady) return;
      const moduleName = root.dataset.slideshowModule || 'Slideshow';
      const slides = [...root.querySelectorAll('[data-slideshow-slide]')];
      if (!slides.length) return;

      if (slides.length < 2) {
        syncVideos(slides[0], true);
        trackBanner(moduleName, slides[0]);
        return;
      }

      root.dataset.slideshowReady = 'true';
      const dots = [...root.querySelectorAll('[data-slideshow-dot]')];
      const autoplay = root.dataset.slideshowAutoplay === 'true';
      let index = 0;
      let timer = 0;

      const show = (next) => {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          const active = i === index;
          slide.classList.toggle('mt-slideshow__slide--active', active);
          syncVideos(slide, active);
        });
        setActiveDot(root, dots[index]);
        trackBanner(moduleName, slides[index]);
      };

      const stop = () => {
        clearInterval(timer);
        timer = 0;
      };

      const play = () => {
        if (!autoplay || timer || reducedMq.matches || document.hidden) return;
        const interval = (parseFloat(root.dataset.slideshowInterval) || 5) * 1000;
        timer = setInterval(() => {
          if (!root.isConnected) {
            stop();
            return;
          }
          show(index + 1);
        }, interval);
      };

      root.addEventListener('pointerenter', stop);
      root.addEventListener('pointerleave', play);
      root.addEventListener('focusin', stop);
      root.addEventListener('focusout', (event) => {
        if (!root.contains(event.relatedTarget)) play();
      });

      dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
          stop();
          show(i);
        });
      });

      document.addEventListener('visibilitychange', () => {
        if (!root.isConnected) return;
        if (document.hidden) stop();
        else play();
      });

      reducedMq.addEventListener('change', () => {
        if (!root.isConnected) return;
        if (reducedMq.matches) stop();
        else play();
      });

      show(0);
      play();
    });
  };

  document.addEventListener('click', (event) => {
    const banner = event.target.closest?.('.mt-slideshow__cta, .mt-slideshow__slide-link');
    if (!banner) return;
    const moduleName = banner.closest('[data-slideshow]')?.dataset.slideshowModule || 'Slideshow';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'click_banner',
      event_parameters: {
        module_name: moduleName,
        banner_slot: banner.dataset.bannerSlot,
        banner_name: banner.dataset.bannerName,
        button_name: banner.dataset.buttonName,
      },
    });
  });

  document.addEventListener('shopify:section:load', init);
  init();
}
