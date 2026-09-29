if (!window.mtVideoGridInit) {
  window.mtVideoGridInit = true;

  const desktopMq = window.matchMedia('(min-width: 750px)');
  const WRAP_MS = 400;

  const applicableVideo = (video) => {
    const isPc = video.classList.contains('mt-video-grid__video--pc');
    const isMob = video.classList.contains('mt-video-grid__video--mob');
    if (!isPc && !isMob) return true;
    return desktopMq.matches ? isPc : isMob;
  };

  const syncVideos = (cards, activeCard) => {
    cards.forEach((card) => {
      card.querySelectorAll('video').forEach((video) => {
        if (card === activeCard && applicableVideo(video)) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    });
  };

  // Centers by nudging the track's current transform, so it works regardless
  // of the active slide's flex-basis (51% vs 66%) without hardcoding widths.
  const center = (stage, track, slide) => {
    const stageRect = stage.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(window.getComputedStyle(track).transform);
    const currentX = matrix.m41;
    const delta = (stageRect.left + stageRect.width / 2) - (slideRect.left + slideRect.width / 2);
    track.style.transform = `translateX(${currentX + delta}px)`;
  };

  const setup = (root) => {
    if (root.dataset.mtReady) return;
    root.dataset.mtReady = 'true';

    const stage = root.querySelector('[data-video-grid-stage]');
    const track = root.querySelector('[data-video-grid-track]');
    const cards = Array.from(root.querySelectorAll('[data-video-grid-card]'));
    const prevBtn = root.querySelector('[data-video-grid-arrow="prev"]');
    const nextBtn = root.querySelector('[data-video-grid-arrow="next"]');
    if (!stage || !track || !cards.length) return;

    if (cards.length < 2) {
      prevBtn?.setAttribute('hidden', '');
      nextBtn?.setAttribute('hidden', '');
      track.querySelectorAll('video').forEach((video) => {
        if (applicableVideo(video)) video.play().catch(() => {});
      });
      cards[0].setAttribute('data-active', '');
      desktopMq.addEventListener('change', () => syncVideos(cards, cards[0]));
      return;
    }

    // Clone the first/last real card onto each end of the track so that
    // repeatedly clicking "next" past the last card keeps sliding forward
    // into a lookalike clone instead of yanking the track back to card 1.
    // Once the slide transition into a clone finishes, we silently jump
    // (no transition) onto the matching real card at the same visual spot.
    const cloneBefore = cards[cards.length - 1].cloneNode(true);
    const cloneAfter = cards[0].cloneNode(true);
    [cloneBefore, cloneAfter].forEach((clone) => {
      clone.removeAttribute('data-video-grid-card');
      clone.removeAttribute('data-active');
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('video').forEach((video) => video.removeAttribute('autoplay'));
    });
    track.insertBefore(cloneBefore, cards[0]);
    track.appendChild(cloneAfter);

    const slides = Array.from(track.children);
    let position = 1; // index into `slides`; 1 is the first real card
    let wrapTimer = null;

    const realIndexFor = (pos) => {
      if (pos === 0) return cards.length - 1;
      if (pos === slides.length - 1) return 0;
      return pos - 1;
    };

    const applyActive = (pos) => {
      slides.forEach((slide, i) => {
        if (i === pos) slide.setAttribute('data-active', '');
        else slide.removeAttribute('data-active');
      });
    };

    const settle = () => {
      clearTimeout(wrapTimer);
      if (position === 0) {
        position = slides.length - 2; // last real card
      } else if (position === slides.length - 1) {
        position = 1; // first real card
      } else {
        return;
      }
      track.style.transition = 'none';
      applyActive(position);
      center(stage, track, slides[position]);
      void track.offsetWidth; // flush the jump before re-enabling the transition
      track.style.transition = '';
    };

    // Ignored while a transition is in flight so `position` only ever moves
    // one slide at a time and never overruns the cloned ends of `slides`.
    let busy = false;

    const goTo = (nextPosition) => {
      if (busy) return;
      busy = true;
      position = nextPosition;
      applyActive(position);
      center(stage, track, slides[position]);
      syncVideos(cards, cards[realIndexFor(position)]);
      clearTimeout(wrapTimer);
      wrapTimer = setTimeout(() => {
        settle();
        busy = false;
      }, WRAP_MS);
    };

    prevBtn.addEventListener('click', () => goTo(position - 1));
    nextBtn.addEventListener('click', () => goTo(position + 1));

    let startX = 0;
    let startY = 0;
    let tracking = false;
    track.addEventListener(
      'touchstart',
      (event) => {
        if (event.touches.length > 1) {
          tracking = false;
          return;
        }
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        tracking = true;
      },
      { passive: true }
    );
    track.addEventListener('touchcancel', () => {
      tracking = false;
    });
    track.addEventListener(
      'touchend',
      (event) => {
        if (!tracking) return;
        tracking = false;
        const touch = event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        goTo(dx < 0 ? position + 1 : position - 1);
      },
      { passive: true }
    );

    window.addEventListener('resize', () => center(stage, track, slides[position]));
    desktopMq.addEventListener('change', () => {
      center(stage, track, slides[position]);
      syncVideos(cards, cards[realIndexFor(position)]);
    });

    applyActive(position);
    center(stage, track, slides[position]);
    syncVideos(cards, cards[realIndexFor(position)]);
  };

  const initAll = (scope) => {
    scope.querySelectorAll('[data-video-grid]').forEach(setup);
  };

  initAll(document);
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
}
