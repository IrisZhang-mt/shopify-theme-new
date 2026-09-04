if (!window.mtActivitiesInit) {
  window.mtActivitiesInit = true;

  const reducedMq = window.mtReducedMq;
  const hoverMq = window.matchMedia('(hover: hover)');
  const FLIP = 140;
  const flipAt = new WeakMap();

  const preload =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.querySelectorAll('.mt-act__slide').forEach((img) => {
                img.loading = 'eager';
              });
              observer.unobserve(entry.target);
            });
          },
          { rootMargin: '50% 0px' }
        )
      : null;

  let sections = [];
  const onScreen = new WeakMap();

  const viewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => onScreen.set(entry.target, entry.isIntersecting));
    start();
  });

  const centerObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !hoverMq.matches) setActive(entry.target);
            });
          },
          { rootMargin: '-42% 0px -42% 0px' }
        )
      : null;

  const measure = () => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    sections.forEach((section) => {
      if (!section.isConnected) return;
      const sectionStyle = getComputedStyle(section);
      const limit =
        section.clientWidth -
        (parseFloat(sectionStyle.paddingLeft) || 0) -
        (parseFloat(sectionStyle.paddingRight) || 0);
      section.querySelectorAll('.mt-act__row').forEach((row) => {
        const media = row.querySelector('.mt-act__media');
        if (!media) return;
        const rowStyle = getComputedStyle(row);
        const gap = parseFloat(rowStyle.columnGap) || 0;
        const mediaValue = rowStyle.getPropertyValue('--mt-act-media-w').trim();
        const mediaWidth = parseFloat(mediaValue) * (mediaValue.includes('rem') ? rem : 1) || 0;
        let labels = 0;
        row.querySelectorAll('.mt-act__label').forEach((label) => {
          labels += label.offsetWidth;
        });
        row.classList.toggle('mt-act__row--tight', labels + mediaWidth + gap * 2 > limit + 1);
      });
    });
  };

  const scan = () => {
    sections = [...document.querySelectorAll('.mt-act')];
    sections.forEach((section) => {
      if (preload) preload.observe(section);
      viewObserver.observe(section);
      if (centerObserver && !hoverMq.matches) {
        section.querySelectorAll('.mt-act__row').forEach((row) => centerObserver.observe(row));
      }
    });
    measure();
    start();
  };

  const stamp = (row, delay) => {
    const media = row.querySelector('.mt-act__media');
    if (media) flipAt.set(media, performance.now() + delay);
  };

  const setActive = (row) => {
    row.parentElement.querySelectorAll('.mt-act__row').forEach((item) => {
      const on = item === row;
      if (on && !item.classList.contains('mt-act__row--active')) {
        item.querySelectorAll('.mt-act__slide--on').forEach((slide) => {
          slide.classList.remove('mt-act__slide--on');
        });
        stamp(item, FLIP);
      }
      item.classList.toggle('mt-act__row--active', on);
    });
    start();
  };

  const clear = (section) => {
    section.querySelectorAll('.mt-act__row--active').forEach((row) => {
      row.classList.remove('mt-act__row--active');
    });
  };

  document.addEventListener('mouseover', (event) => {
    if (!hoverMq.matches) return;
    const row = event.target.closest?.('.mt-act__row');
    if (!row) return;
    const wasActive = row.classList.contains('mt-act__row--active');
    setActive(row);
    if (wasActive && !row.contains(event.relatedTarget)) stamp(row, FLIP);
  });

  document.addEventListener('mouseout', (event) => {
    const section = event.target.closest?.('.mt-act');
    if (section && !section.contains(event.relatedTarget)) clear(section);
  });

  document.addEventListener('focusin', (event) => {
    const row = event.target.closest?.('.mt-act__row');
    if (row) setActive(row);
  });

  document.addEventListener('focusout', (event) => {
    const section = event.target.closest?.('.mt-act');
    if (section && !section.contains(event.relatedTarget)) clear(section);
  });

  const flip = (media, now) => {
    if (!flipAt.has(media)) {
      flipAt.set(media, now + FLIP);
      return;
    }
    if (now < flipAt.get(media)) return;
    const slides = media.children;
    if (slides.length < 2) return;
    let index = 0;
    for (let i = 0; i < slides.length; i += 1) {
      if (slides[i].classList.contains('mt-act__slide--on')) {
        index = i;
        break;
      }
    }
    slides[index].classList.remove('mt-act__slide--on');
    slides[(index + 1) % slides.length].classList.add('mt-act__slide--on');
    flipAt.set(media, now + FLIP);
  };

  let raf = 0;

  const step = (now) => {
    raf = 0;
    if (reducedMq.matches) return;
    let live = false;
    sections.forEach((section) => {
      if (!section.isConnected || !onScreen.get(section)) return;
      section.querySelectorAll('.mt-act__row--active .mt-act__media').forEach((media) => {
        live = true;
        flip(media, now);
      });
    });
    if (live) raf = requestAnimationFrame(step);
  };

  function start() {
    if (raf || reducedMq.matches || document.hidden) return;
    raf = requestAnimationFrame(step);
  }

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      measure();
    });
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measure);
  }

  document.addEventListener('visibilitychange', start);
  reducedMq.addEventListener('change', start);
  document.addEventListener('shopify:section:load', scan);
  scan();
}
